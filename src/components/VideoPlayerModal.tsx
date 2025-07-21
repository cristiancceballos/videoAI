import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { VideoWithMetadata } from '../services/videoService';

interface VideoPlayerModalProps {
  visible: boolean;
  video: VideoWithMetadata | null;
  videoUrl: string | null | undefined;
  onClose: () => void;
  loading?: boolean;
  error?: string;
}

export function VideoPlayerModal({
  visible,
  video,
  videoUrl,
  onClose,
  loading = false,
  error,
}: VideoPlayerModalProps) {
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const handleVideoError = () => {
    console.error('❌ Video playback error');
    setVideoError(true);
  };

  const handleVideoLoad = () => {
    console.log('✅ Video loaded successfully');
    setVideoLoaded(true);
    setVideoError(false);
  };

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

  if (!video) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={styles.videoMeta}>
              {formatDate(video.created_at)} • {formatDuration(video.duration)}
            </Text>
          </View>
        </View>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              {videoUrl && (
                <TouchableOpacity 
                  onPress={() => {
                    console.log('🔗 Manual URL test - copying to clipboard:', videoUrl);
                    if (Platform.OS === 'web') {
                      navigator.clipboard?.writeText(videoUrl).then(() => {
                        console.log('📋 URL copied to clipboard');
                      });
                    }
                    // Also try to open URL in new tab for testing
                    window.open(videoUrl, '_blank');
                  }}
                  style={styles.debugButton}
                >
                  <Text style={styles.debugButtonText}>Test URL Directly</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️</Text>
              <Text style={styles.errorMessage}>
                Unable to play this video. It may be corrupted or in an unsupported format.
              </Text>
              {videoUrl && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugInfo}>Debug Info:</Text>
                  <Text style={styles.debugUrl} numberOfLines={2}>{videoUrl}</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      console.log('🔍 Video debugging:', {
                        video_title: video?.title,
                        video_status: video?.status,
                        storage_path: video?.storage_path,
                        generated_url: videoUrl
                      });
                      window.open(videoUrl, '_blank');
                    }}
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Open URL in New Tab</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoUrl && !loading && !error && (
            <video
              src={videoUrl}
              controls
              style={styles.video}
              onError={handleVideoError}
              onLoadedData={handleVideoLoad}
              preload="metadata"
              playsInline
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjE2MCIgeT0iOTAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiI+VmlkZW8gUGxheWVyPC90ZXh0Pgo8L3N2Zz4="
            />
          )}
        </View>

        {/* Video Info */}
        {!loading && !error && (
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[styles.infoValue, { 
                color: video.status === 'ready' ? '#34C759' : '#FF9500' 
              }]}>
                {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
              </Text>
            </View>
            
            {video.file_size && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Size:</Text>
                <Text style={styles.infoValue}>
                  {formatFileSize(video.file_size)}
                </Text>
              </View>
            )}

            {video.width && video.height && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Resolution:</Text>
                <Text style={styles.infoValue}>
                  {video.width} × {video.height}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  videoTitle: {
    color: '#fff',
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  videoMeta: {
    color: '#888',
    fontSize: 12,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorMessage: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    width: '100%',
  },
  debugInfo: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  debugUrl: {
    color: '#007AFF',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  infoContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});