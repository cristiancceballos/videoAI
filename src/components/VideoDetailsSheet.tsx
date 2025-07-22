import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { VideoWithMetadata } from '../services/videoService';

interface VideoDetailsSheetProps {
  visible: boolean;
  video: VideoWithMetadata;
  onClose: () => void;
}

export function VideoDetailsSheet({ visible, video, onClose }: VideoDetailsSheetProps) {
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panRef = useRef(new Animated.ValueXY()).current;

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
    }
  }, [visible]);

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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

          {/* Upload Date and Duration */}
          <Text style={styles.subtitle}>
            {formatDate(video.created_at)} • {formatDuration(video.duration)}
          </Text>

          {/* Metadata Section */}
          <View style={styles.metadataSection}>
            <Text style={styles.sectionTitle}>Video Details</Text>
            
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Status</Text>
              <Text style={[
                styles.metadataValue,
                { color: video.status === 'ready' ? '#34C759' : '#FF9500' }
              ]}>
                {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
              </Text>
            </View>

            {video.file_size && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>File Size</Text>
                <Text style={styles.metadataValue}>
                  {formatFileSize(video.file_size)}
                </Text>
              </View>
            )}

            {video.width && video.height && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Resolution</Text>
                <Text style={styles.metadataValue}>
                  {video.width} × {video.height}
                </Text>
              </View>
            )}

            {video.duration && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Duration</Text>
                <Text style={styles.metadataValue}>
                  {formatDuration(video.duration)}
                </Text>
              </View>
            )}
          </View>

          {/* Add some bottom spacing for better UX */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 24,
  },
  metadataSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
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
    color: '#8e8e93',
  },
  metadataValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
});