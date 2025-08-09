import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { VideoWithMetadata, videoService } from '../services/videoService';
import { getInterFontConfig } from '../utils/fontUtils';
import { Sparkles } from 'lucide-react-native';

interface VideoDetailsSheetProps {
  visible: boolean;
  video: VideoWithMetadata;
  onClose: () => void;
}

export function VideoDetailsSheet({ visible, video, onClose }: VideoDetailsSheetProps) {
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panRef = useRef(new Animated.ValueXY()).current;
  
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: screenHeight * 0.3, // Show 70% of screen
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
      
      // Fetch AI summary if available
      if (video.ai_status === 'completed') {
        setLoadingSummary(true);
        videoService.getVideoSummary(video.id).then(content => {
          setSummary(content);
          setLoadingSummary(false);
        }).catch(() => {
          setLoadingSummary(false);
        });
      }
    } else {
      // Slide down animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
      
      // Reset summary when closing
      setSummary(null);
    }
  }, [visible, video.id, video.ai_status]);

  // Pan gesture for dragging sheet down
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to vertical drags
      return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
    },
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      panRef.setOffset({
        x: panRef.x._value,
        y: panRef.y._value,
      });
    },
    onPanResponderMove: (evt, gestureState) => {
      // Only allow downward drags
      if (gestureState.dy > 0) {
        panRef.setValue({ x: 0, y: gestureState.dy });
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      panRef.flattenOffset();
      
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        // Drag threshold met - close sheet
        onClose();
      } else {
        // Snap back to original position
        Animated.spring(panRef, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

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


  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View 
        style={[
          styles.backdrop,
          {
            opacity: backdropAnim,
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backdropTouch}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [
              { 
                translateY: Animated.add(slideAnim, panRef.y)
              }
            ],
          }
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* Sheet Content */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Video Title */}
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>

          {/* Upload Date, Duration, and File Size */}
          <Text style={styles.subtitle}>
            {formatDate(video.created_at)} • {formatDuration(video.duration)} • {formatFileSize(video.file_size)}
          </Text>

          {/* AI Summary Section */}
          {video.ai_status === 'completed' && (
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

    </>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: screenHeight,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#48484a',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
    height: 40,
  },
});