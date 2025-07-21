import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { videoService, VideoWithMetadata } from '../../services/videoService';
import { VideoGridItem } from '../../components/VideoGridItem';
import { VideoPlayerModal } from '../../components/VideoPlayerModal';

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const [videos, setVideos] = useState<VideoWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Video player state
  const [selectedVideo, setSelectedVideo] = useState<VideoWithMetadata | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [urlRetryCount, setUrlRetryCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadVideos();
      // Temporarily disable real-time subscription due to schema mismatch
      // setupRealtimeSubscription();
    }
  }, [user]);

  // Refresh videos when screen comes into focus (e.g., after uploading)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('🎯 HomeScreen focused - refreshing videos');
        loadVideos();
      }
    }, [user])
  );

  const loadVideos = async (showLoading = false) => {
    if (!user) return;
    
    if (showLoading) setLoading(true);
    
    try {
      console.log('📱 Loading videos for user:', user.id);
      const userVideos = await videoService.getUserVideos(user.id);
      setVideos(userVideos);
      console.log('📹 Loaded videos:', userVideos.length, userVideos.map(v => ({id: v.id.substring(0,8), title: v.title, status: v.status})));
    } catch (error) {
      console.error('❌ Error loading videos:', error);
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    try {
      const subscription = videoService.subscribeToVideoUpdates(user.id, (updatedVideos) => {
        console.log('📱 Real-time update received, updating video list');
        setVideos(updatedVideos);
      });

      return () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.log('Real-time unsubscribe error (non-critical):', error);
        }
      };
    } catch (error) {
      console.log('Real-time subscription setup failed (non-critical):', error);
      // Fallback to manual refresh only
      return () => {};
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const loadVideoUrl = async (video: VideoWithMetadata, retryCount: number = 0): Promise<void> => {
    try {
      console.log(`🔄 Loading video URL (attempt ${retryCount + 1}) for:`, video.title);
      const url = await videoService.getVideoUrl(video);
      if (url) {
        setVideoUrl(url);
        setUrlRetryCount(0); // Reset retry count on success
        console.log('✅ Fresh signed video URL loaded successfully (expires in 1 hour)');
      } else {
        setVideoError('Unable to generate secure video link. Please check your permissions.');
        console.error('❌ Failed to get secure video URL');
      }
    } catch (error) {
      console.error('❌ Error loading video URL:', error);
      if (error instanceof Error && error.message.includes('permission')) {
        setVideoError('Access denied. You can only view videos you uploaded.');
      } else {
        setVideoError('Failed to load video. Please check your connection and try again.');
      }
    }
  };

  const handleVideoPress = async (video: VideoWithMetadata) => {
    if (video.status !== 'ready') {
      if (video.status === 'processing') {
        Alert.alert('Processing', 'Your video is still being processed. Please wait...');
      } else if (video.status === 'error') {
        Alert.alert('Error', 'There was an error processing this video.');
      } else {
        Alert.alert('Not Ready', 'This video is not ready for playback yet.');
      }
      return;
    }

    console.log('🎥 Opening video player for:', video.title);
    setSelectedVideo(video);
    setVideoLoading(true);
    setVideoError(null);
    setVideoUrl(null); // Clear previous URL
    setUrlRetryCount(0);
    setShowVideoPlayer(true);

    // Load fresh URL every time video is opened
    await loadVideoUrl(video);
    setVideoLoading(false);
  };

  const handleVideoUrlExpired = async () => {
    if (!selectedVideo || urlRetryCount >= 2) {
      console.error('❌ Max retries reached or no video selected');
      setVideoError('Video link expired. Please close and reopen the video.');
      return;
    }

    console.log('🔄 Video URL appears to be expired, refreshing...');
    setUrlRetryCount(prev => prev + 1);
    setVideoLoading(true);
    setVideoError(null);
    
    await loadVideoUrl(selectedVideo, urlRetryCount);
    setVideoLoading(false);
  };

  const handleCloseVideoPlayer = () => {
    console.log('📴 Closing video player');
    setShowVideoPlayer(false);
    setSelectedVideo(null);
    setVideoUrl(null);
    setVideoError(null);
    setVideoLoading(false);
    setUrlRetryCount(0);
  };

  const handleVideoDelete = async (video: VideoWithMetadata) => {
    console.log('🏠 HomeScreen: Delete request received for:', video.title);
    setDeleting(video.id);
    
    try {
      console.log('🗑️ Deleting video:', video.title);
      const success = await videoService.deleteVideo(video.id);
      
      if (success) {
        // Remove from local state immediately
        setVideos(prevVideos => prevVideos.filter(v => v.id !== video.id));
        Alert.alert('Success', 'Video deleted successfully');
        console.log('✅ Video deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete video. Please try again.');
        console.error('❌ Failed to delete video');
      }
    } catch (error) {
      console.error('❌ Error deleting video:', error);
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const renderVideoGridItem = ({ item }: { item: VideoWithMetadata }) => (
    <VideoGridItem 
      video={item} 
      onPress={handleVideoPress}
      onDelete={handleVideoDelete}
      isDeleting={deleting === item.id}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎥</Text>
      <Text style={styles.emptyTitle}>No videos yet</Text>
      <Text style={styles.emptySubtitle}>
        Upload your first video to get started with AI-powered summaries and Q&A
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VideoAI</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => loadVideos(true)} 
            style={styles.refreshButton}
            disabled={loading}
          >
            <Text style={styles.refreshText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={videos}
        renderItem={renderVideoGridItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />

      <VideoPlayerModal
        visible={showVideoPlayer}
        video={selectedVideo}
        videoUrl={videoUrl}
        onClose={handleCloseVideoPlayer}
        loading={videoLoading}
        error={videoError || undefined}
        onUrlExpired={handleVideoUrlExpired}
      />
    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isLargeScreen = screenWidth > 428;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 44, // Ensure minimum touch target
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 16,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    minWidth: 80,
    minHeight: 44, // Improved touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  gridContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'flex-start', // Edge-to-edge alignment
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.15,
    paddingHorizontal: isSmallScreen ? 24 : 40,
  },
  emptyIcon: {
    fontSize: isSmallScreen ? 40 : 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : 22,
    maxWidth: isLargeScreen ? 320 : '100%',
  },
});