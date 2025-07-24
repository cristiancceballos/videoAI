import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Video, Play, X } from 'lucide-react-native';
import { VideoWithMetadata } from '../services/videoService';

interface VideoGridItemProps {
  video: VideoWithMetadata;
  onPress: (video: VideoWithMetadata) => void;
  onDelete?: (video: VideoWithMetadata) => void;
  isDeleting?: boolean;
  columnIndex: number; // 0, 1, or 2 for the three columns
}

export function VideoGridItem({ video, onPress, onDelete, isDeleting, columnIndex }: VideoGridItemProps) {

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDelete = () => {
    console.log('Delete requested for video:', video.title);
    if (onDelete) {
      // Use browser-compatible confirmation for web platform
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `Are you sure you want to delete "${video.title}"? This action cannot be undone.`
        );
        if (confirmed) {
          onDelete(video);
        }
      }
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        isDeleting && styles.deleting,
        columnIndex < 2 && styles.rightBorder, // Add right border for first two columns only
        columnIndex > 0 && styles.leftBorder // Add left border for columns 2 and 3
      ]}
      onPress={() => onPress(video)}
      activeOpacity={0.9}
      disabled={isDeleting}
    >
      {/* Video Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {video.thumbnailUrl ? (
          <Image 
            source={{ uri: video.thumbnailUrl }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Video size={24} color="#666" />
          </View>
        )}

        {/* Play Icon Overlay */}
        <View style={styles.playIconOverlay}>
          <View style={styles.playIcon}>
            <Play size={16} color="#000" fill="#000" />
          </View>
        </View>

        {/* Duration Badge */}
        {video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(video.duration)}
            </Text>
          </View>
        )}


        {/* Delete Button */}
        {onDelete && !isDeleting && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={12} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Processing Indicator */}
        {video.status === 'processing' && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {/* Deleting Indicator */}
        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#FF3B30" />
            <Text style={styles.deletingText}>Deleting...</Text>
          </View>
        )}
      </View>

      {/* Optional: Video Title (can be removed for cleaner look) */}
      {/* <Text style={styles.title} numberOfLines={2}>
        {video.title}
      </Text> */}
    </TouchableOpacity>
  );
}

const { width: screenWidth } = Dimensions.get('window');

// Calculate item width: screen width divided by 3, accounting for vertical separators
const itemWidth = (screenWidth - 2) / 3; // Subtract 2px for two vertical lines between 3 columns
const itemHeight = itemWidth * (16 / 9); // 9:16 aspect ratio for TikTok-style vertical videos

const styles = StyleSheet.create({
  container: {
    width: itemWidth,
    marginBottom: 1, // Minimal spacing between rows for edge-to-edge look
  },
  rightBorder: {
    borderRightWidth: 1,
    borderRightColor: '#333', // Match the existing line color theme
  },
  leftBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#333', // Match the existing line color theme
  },
  deleting: {
    opacity: 0.5,
  },
  thumbnailContainer: {
    width: itemWidth,
    height: itemHeight,
    backgroundColor: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletingText: {
    color: '#FF3B30',
    fontSize: 10,
    marginTop: 4,
  },
  // Optional title styling (currently commented out)
  title: {
    fontSize: 11,
    color: '#fff',
    marginTop: 4,
    marginHorizontal: 2,
    lineHeight: 14,
  },
});