import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { VideoWithMetadata, videoService } from '../services/videoService';
import { getInterFontConfig } from '../utils/fontUtils';
import { Sparkles, AlertCircle } from 'lucide-react-native';

interface VideoDetailsSheetProps {
  visible: boolean;
  video: VideoWithMetadata;
  onClose: () => void;
}

export function VideoDetailsSheet({ visible, video, onClose }: VideoDetailsSheetProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Animation values
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Backdrop opacity based on sheet position during swipe
  const swipeBackdropOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });
  
  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Allow immediate response on drag handle area
        const touchY = evt.nativeEvent.locationY;
        return touchY < 50; // Drag handle area
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Check if touch is on drag handle or if scrolled to top
        const touchY = evt.nativeEvent.locationY;
        const isOnDragHandle = touchY < 50;
        const isSwipingDown = gestureState.dy > 0;
        const isAtTop = scrollOffset.current <= 0;
        
        return isOnDragHandle || (isSwipingDown && isAtTop && Math.abs(gestureState.dy) > 10);
      },
      onPanResponderMove: (_, gestureState) => {
        // Move the sheet with the finger
        const newValue = Math.max(0, gestureState.dy);
        translateY.setValue(newValue);
        // Update backdrop opacity during swipe
        const opacity = 0.4 * (1 - newValue / screenHeight);
        backdropOpacity.setValue(opacity);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Determine if we should close or snap back
        const shouldClose = gestureState.dy > 100 || gestureState.vy > 0.5;
        
        if (shouldClose) {
          // Animate out and close
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: screenHeight,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            translateY.setValue(0);
            backdropOpacity.setValue(0);
            onClose();
          });
        } else {
          // Snap back to position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0.4,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible && video.ai_status === 'completed') {
      setLoadingSummary(true);
      videoService.getVideoSummary(video.id).then(content => {
        setSummary(content);
        setLoadingSummary(false);
      }).catch(() => {
        setLoadingSummary(false);
      });
    } else if (!visible) {
      // Reset summary when closing
      setSummary(null);
    }
  }, [visible, video.id, video.ai_status]);
  
  // Handle entrance/exit animations
  useEffect(() => {
    if (visible) {
      // Reset positions
      translateY.setValue(screenHeight);
      backdropOpacity.setValue(0);
      
      // Animate entrance
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.4,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      backdropOpacity.setValue(0);
    }
  }, [visible, translateY, backdropOpacity]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);

    // Date part: e.g., "Jul 21, 2025"
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Time part: e.g., "04:52 PM"
    const timePart = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Combine with @ instead of 'at'
    return `${datePart} @ ${timePart}`;
  };


  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Animated Backdrop */}
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        {/* Bottom Sheet */}
        <Animated.View 
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Sheet Content */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.content}
            showsVerticalScrollIndicator={true}
            bounces={true}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
          >
          {/* Video Title */}
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>

          {/* Upload Date, Duration, and File Size */}
          <Text style={styles.subtitle}>
            {formatDate(video.created_at)} • {formatDuration(video.duration)} • {formatFileSize(video.file_size)}
          </Text>

          {/* File Size Limitations Warning */}
          {video.file_size && video.file_size > 50 * 1024 * 1024 ? (
            <View style={styles.metadataSection}>
              <View style={styles.warningContainer}>
                <AlertCircle size={24} color="#FF9500" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Video File</Text>
                  <Text style={styles.warningText}>
                    This video is over 50MB. Playback and AI features may be limited. Consider uploading a smaller file for the best experience.
                  </Text>
                </View>
              </View>
            </View>
          ) : video.file_size && video.file_size > 25 * 1024 * 1024 ? (
            <View style={styles.metadataSection}>
              <View style={styles.warningContainer}>
                <AlertCircle size={24} color="#FFD60A" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Limited AI Features</Text>
                  <Text style={styles.warningText}>
                    Videos over 25MB have limited AI processing. Summary and tags may not be available.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* AI Summary Section */
            video.ai_status === 'completed' && (
              <View style={styles.metadataSection}>
                <View style={styles.sectionHeader}>
                  <Sparkles size={20} color="#34C759" />
                  <Text style={styles.sectionTitle}>AI Summary</Text>
                </View>
                
                {loadingSummary ? (
                  <ActivityIndicator size="small" color="#8e8e93" style={styles.loadingIndicator} />
                ) : summary ? (
                  <Text style={styles.summaryText}>{summary}</Text>
                ) : (
                  <Text style={styles.errorText}>Summary not available</Text>
                )}
                
                {/* Tags */}
                {video.tags && video.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {video.tags.map((tag, index) => (
                      <View key={index} style={styles.tagChip}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )
          )}
          
          {/* AI Processing Status */}
          {video.ai_status === 'processing' && (
            <View style={styles.metadataSection}>
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#FF9500" />
                <Text style={styles.processingText}>AI is analyzing your video...</Text>
              </View>
            </View>
          )}
          
          {/* AI Not Started */}
          {(!video.ai_status || video.ai_status === 'pending') && (
            <View style={styles.metadataSection}>
              <Text style={styles.pendingText}>AI analysis will begin shortly</Text>
            </View>
          )}


          {/* Add some bottom spacing for better UX */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
        </Animated.View>
      </View>
  </Modal>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.85,
    minHeight: screenHeight * 0.4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#48484a',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    maxHeight: screenHeight * 0.75,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    marginBottom: 24,
  },
  metadataSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#e5e5e7',
    lineHeight: 24,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  processingText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#FF9500',
    marginLeft: 12,
  },
  pendingText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    fontStyle: 'italic',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383a',
  },
  metadataLabel: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
  },
  metadataValue: {
    fontSize: 16,
    fontWeight: '500',
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#fff',
  },
  bottomSpacer: {
    height: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#FFD60A',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#e5e5e7',
    lineHeight: 20,
  },
});