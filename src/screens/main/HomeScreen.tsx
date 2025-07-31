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
import { getInterFontConfig } from '../../utils/fontUtils';
import { useFocusEffect } from '@react-navigation/native';
import { Video, Search, Check, RotateCcw } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { videoService, VideoWithMetadata } from '../../services/videoService';
import { VideoGridItem } from '../../components/VideoGridItem';
import { TikTokVideoPlayer } from '../../components/TikTokVideoPlayer';
import { ProfileTabNavigator, ProfileTab } from '../../components/ProfileTabNavigator';
import { BunnyStreamService } from '../../services/bunnyStreamService';

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
  
  // Profile tab navigation state
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  useEffect(() => {
    if (user) {
      loadVideos();
      // Set up real-time subscription with error handling
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user]);

  // Refresh videos when screen comes into focus (e.g., after uploading)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        // HomeScreen focused - refreshing videos
        loadVideos();
      }
    }, [user])
  );

  // Polling mechanism for processing videos
  useEffect(() => {
    if (!user || !videos.length) return;

    // Check if any videos are processing thumbnails
    const processingVideos = videos.filter(v => 
      v.thumb_status === 'processing' || v.thumb_status === 'pending'
    );

    if (processingVideos.length === 0) return;

    // Found videos processing thumbnails, starting polling...

    const pollInterval = setInterval(async () => {
      // Checking for thumbnail updates...
      await loadVideos(false);
      
      // Check if we still need to poll
      const stillProcessing = videos.filter(v => 
        v.thumb_status === 'processing' || v.thumb_status === 'pending'
      );
      
      if (stillProcessing.length === 0) {
        // All thumbnails complete, stopping poll
        clearInterval(pollInterval);
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      // Cleaning up poll interval
      clearInterval(pollInterval);
    };
  }, [user, videos]);

  const loadVideos = async (showLoading = false) => {
    if (!user) return;
    
    if (showLoading) setLoading(true);
    
    try {
      // Loading videos for user
      const userVideos = await videoService.getUserVideos(user.id);
      setVideos(userVideos);
      // Loaded videos successfully
      
      // Debug recent video details
      if (userVideos.length > 0) {
        const recentVideo = userVideos[0];
        console.log('🔍 [HOME SCREEN DEBUG] Most recent video details:', {
          id: recentVideo.id,
          title: recentVideo.title,
          status: recentVideo.status,
          thumbnail_path: recentVideo.thumbnail_path,
          thumbnailUrl: recentVideo.thumbnailUrl,
          created_at: recentVideo.created_at
        });
      }
      
      // Process any pending thumbnails with Bunny
      await processPendingThumbnails();
    } catch (error) {
      console.error('Error loading videos:', error);
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return () => {};

    try {
      // Setting up real-time subscription
      const subscription = videoService.subscribeToVideoUpdates(user.id, (updatedVideos) => {
        // Real-time update received
        setVideos(updatedVideos);
      });

      return () => {
        try {
          // Cleaning up real-time subscription
          subscription.unsubscribe();
        } catch (error) {
          // Real-time unsubscribe error (non-critical)
        }
      };
    } catch (error) {
      console.error('❌ Real-time subscription setup failed:', error);
      // Fallback to manual refresh only
      return () => {};
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const processPendingThumbnails = async () => {
    console.log('[BUNNY PROCESS] Checking for pending thumbnails...');
    if (!user || !videos.length) {
      console.log('[BUNNY PROCESS] No user or videos, returning');
      return;
    }
    
    console.log('[BUNNY PROCESS] Total videos:', videos.length);
    console.log('[BUNNY PROCESS] Videos thumb_status:', videos.map(v => ({
      id: v.id.substring(0, 8),
      thumb_status: v.thumb_status,
      has_bunny_id: !!v.bunny_video_id,
      has_storage_path: !!v.storage_path
    })));
    
    // Find videos that need thumbnail processing
    const pendingVideos = videos.filter(v => 
      v.thumb_status === 'pending' && 
      v.storage_path &&
      !v.bunny_video_id // Not already processed by Bunny
    );
    
    console.log('[BUNNY PROCESS] Found pending videos:', pendingVideos.length);
    if (pendingVideos.length === 0) return;
    
    // Process each pending video
    for (const video of pendingVideos) {
      try {
        console.log(`[BUNNY PROCESS] Processing video ${video.id}`);
        await BunnyStreamService.processVideo(video.id, user.id, video.storage_path);
      } catch (error) {
        console.error(`❌ [BUNNY] Failed to process video ${video.id}:`, error);
      }
    }
  };

  const checkForStuckThumbnails = () => {
    if (!videos.length) return false;
    
    const stuckVideos = videos.filter(v => 
      (v.thumb_status === 'processing' || v.thumb_status === 'pending') &&
      v.created_at && 
      Date.now() - new Date(v.created_at).getTime() > 300000 // 5 minutes
    );
    
    if (stuckVideos.length > 0) {
      console.log(`⚠️ [STUCK CHECK] Found ${stuckVideos.length} videos with stuck thumbnails`);
      return true;
    }
    
    return false;
  };

  const handleForceRefresh = () => {
    console.log('🔄 [FORCE REFRESH] User triggered force refresh');
    handleRefresh();
  };

  const loadVideoUrl = async (video: VideoWithMetadata, retryCount: number = 0): Promise<void> => {
    try {
      console.log(`Loading video URL (attempt ${retryCount + 1}) for:`, video.title);
      const url = await videoService.getVideoUrl(video);
      if (url) {
        setVideoUrl(url);
        setUrlRetryCount(0); // Reset retry count on success
        console.log('Fresh signed video URL loaded successfully (expires in 1 hour)');
      } else {
        setVideoError('Unable to generate secure video link. Please check your permissions.');
        // Failed to get secure video URL
      }
    } catch (error) {
      console.error('Error loading video URL:', error);
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

    // Opening video player
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
      console.error('Max retries reached or no video selected');
      setVideoError('Video link expired. Please close and reopen the video.');
      return;
    }

    // Video URL appears to be expired, refreshing...
    setUrlRetryCount(prev => prev + 1);
    setVideoLoading(true);
    setVideoError(null);
    
    await loadVideoUrl(selectedVideo, urlRetryCount);
    setVideoLoading(false);
  };

  const handleCloseVideoPlayer = () => {
    // Closing video player
    setShowVideoPlayer(false);
    setSelectedVideo(null);
    setVideoUrl(null);
    setVideoError(null);
    setVideoLoading(false);
    setUrlRetryCount(0);
  };

  const handleVideoDelete = async (video: VideoWithMetadata) => {
    // Delete request received
    setDeleting(video.id);
    
    try {
      // Deleting video
      const success = await videoService.deleteVideo(video.id);
      
      if (success) {
        // Remove from local state immediately
        setVideos(prevVideos => prevVideos.filter(v => v.id !== video.id));
        Alert.alert('Success', 'Video deleted successfully');
        // Video deleted successfully
      } else {
        Alert.alert('Error', 'Failed to delete video. Please try again.');
        // Failed to delete video
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const renderVideoGridItem = ({ item, index }: { item: VideoWithMetadata, index: number }) => (
    <VideoGridItem 
      video={item} 
      onPress={handleVideoPress}
      onDelete={handleVideoDelete}
      isDeleting={deleting === item.id}
      columnIndex={index % 3} // Calculate column index (0, 1, or 2)
    />
  );

  const handleTabPress = (tab: ProfileTab) => {
    setActiveTab(tab);
    // Tab switched
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
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
        );
      case 'search':
        return (
          <View style={styles.tabContentContainer}>
            <Search size={48} color="#fff" style={styles.emptyIcon} />
            <Text style={styles.placeholderTitle}>Search</Text>
            <Text style={styles.placeholderSubtitle}>Search functionality coming soon</Text>
          </View>
        );
      case 'select':
        return (
          <View style={styles.tabContentContainer}>
            <Check size={48} color="#fff" style={styles.emptyIcon} />
            <Text style={styles.placeholderTitle}>Select</Text>
            <Text style={styles.placeholderSubtitle}>Multi-select functionality coming soon</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Video size={48} color="#fff" style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No videos yet</Text>
      <Text style={styles.emptySubtitle}>
        Upload your first video to get started (:
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>VideoAI</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => loadVideos(true)} 
              style={styles.refreshButton}
              disabled={loading}
            >
              <RotateCcw size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ProfileTabNavigator
          activeTab={activeTab}
          onTabPress={handleTabPress}
          postCount={videos.length}
        />
      </View>

      {renderTabContent()}

      <TikTokVideoPlayer
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
  headerContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 16,
    backgroundColor: '#000',
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
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
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium -1.0 letterSpacing
  },
  content: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  gridContent: {
    paddingTop: 0, // Remove gap between secondary nav and video grid
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'flex-start', // Edge-to-edge alignment
  },
  fullScreenContainer: {
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.15,
    paddingHorizontal: isSmallScreen ? 24 : 40,
  },
  placeholderText: {
    fontSize: isSmallScreen ? 40 : 48,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: 'bold',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium -1.0 letterSpacing
    color: '#888',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : 22,
    maxWidth: isLargeScreen ? 320 : '100%',
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium -1.0 letterSpacing
    color: '#888',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : 22,
    maxWidth: isLargeScreen ? 320 : '100%',
  },
});