import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { VideoWithMetadata } from '../services/videoService';

interface VideoCardProps {
  video: VideoWithMetadata;
  onPress: (video: VideoWithMetadata) => void;
  onDelete?: (video: VideoWithMetadata) => void;
  isDeleting?: boolean;
}

export function VideoCard({ video, onPress, onDelete, isDeleting }: VideoCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return '#34C759';
      case 'processing':
        return '#FF9500';
      case 'uploading':
        return '#007AFF';
      case 'error':
        return '#FF3B30';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'youtube':
        return '📺';
      case 'tiktok':
        return '🎵';
      case 'device':
        return '📱';
      default:
        return '🎥';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLongPress = () => {
    if (onDelete) {
      Alert.alert(
        'Delete Video',
        `Are you sure you want to delete "${video.title}"? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDelete(video),
          },
        ]
      );
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, isDeleting && styles.deleting]}
      onPress={() => onPress(video)}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      delayLongPress={500}
      disabled={isDeleting}
    >
      <View style={styles.thumbnailContainer}>
        {video.thumbnailUrl ? (
          <Image 
            source={{ uri: video.thumbnailUrl }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Text style={styles.placeholderIcon}>🎥</Text>
          </View>
        )}
        
        {/* Duration overlay */}
        {video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(video.duration)}
            </Text>
          </View>
        )}

        {/* Source type indicator */}
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceIcon}>
            {getSourceIcon(video.source_type)}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        
        <View style={styles.metadata}>
          <Text style={styles.date}>
            {formatDate(video.created_at)}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(video.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(video.status) }]}>
              {getStatusText(video.status)}
            </Text>
            {video.status === 'processing' && (
              <ActivityIndicator 
                size="small" 
                color={getStatusColor(video.status)}
                style={styles.statusSpinner}
              />
            )}
          </View>
          {onDelete && !isDeleting && (
            <Text style={styles.deleteHint}>Hold to delete</Text>
          )}
          {isDeleting && (
            <View style={styles.deletingContainer}>
              <ActivityIndicator size="small" color="#FF3B30" />
              <Text style={styles.deletingText}>Deleting...</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 320;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: isSmallScreen ? 12 : 16,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: '#333',
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
  placeholderIcon: {
    fontSize: isSmallScreen ? 28 : 32,
  },
  durationBadge: {
    position: 'absolute',
    bottom: isSmallScreen ? 6 : 8,
    right: isSmallScreen ? 6 : 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: isSmallScreen ? 5 : 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: isVerySmallScreen ? 10 : 12,
    fontWeight: '600',
  },
  sourceBadge: {
    position: 'absolute',
    top: isSmallScreen ? 6 : 8,
    left: isSmallScreen ? 6 : 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: isSmallScreen ? 5 : 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceIcon: {
    fontSize: isVerySmallScreen ? 10 : 12,
  },
  content: {
    padding: isVerySmallScreen ? 10 : isSmallScreen ? 11 : 12,
  },
  title: {
    fontSize: isVerySmallScreen ? 14 : isSmallScreen ? 15 : 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    lineHeight: isSmallScreen ? 20 : 22,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: isVerySmallScreen ? 12 : 14,
    color: '#888',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteHint: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  deleting: {
    opacity: 0.5,
  },
  deletingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletingText: {
    fontSize: 10,
    color: '#FF3B30',
    marginLeft: 4,
  },
  statusDot: {
    width: isSmallScreen ? 5 : 6,
    height: isSmallScreen ? 5 : 6,
    borderRadius: isSmallScreen ? 2.5 : 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: isVerySmallScreen ? 11 : 12,
    fontWeight: '500',
  },
  statusSpinner: {
    marginLeft: 6,
  },
});