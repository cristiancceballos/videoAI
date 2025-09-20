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
  TextInput,
} from 'react-native';
import { getInterFontConfig } from '../../utils/fontUtils';
import { useFocusEffect } from '@react-navigation/native';
import { Video, Search, Check, X } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { videoService, VideoWithMetadata } from '../../services/videoService';
import { VideoGridItem } from '../../components/VideoGridItem';
import { TikTokVideoPlayer } from '../../components/TikTokVideoPlayer';
import { ProfileTabNavigator, ProfileTab } from '../../components/ProfileTabNavigator';
import { BunnyStreamService } from '../../services/bunnyStreamService';

export function HomeScreen() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoWithMetadata[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoWithMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [videoUrlCache, setVideoUrlCache] = useState<Map<string, string>>(new Map());
  
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

  // Clean up video URL cache on unmount
  useEffect(() => {
    return () => {
      // Clean up any blob URLs in cache
      videoUrlCache.forEach((url) => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Filter videos based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVideos(videos);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = videos.filter(video => {
        // Search in title
        if (video.title?.toLowerCase().includes(query)) return true;
        // Search in tags - match from beginning of tag or beginning of words within tag
        if (video.tags?.some(tag => {
          const lowerTag = tag.toLowerCase();
          // Match if tag starts with query or any word in the tag starts with query
          return lowerTag.startsWith(query) || 
                 lowerTag.split(/[-_ ]/).some(word => word.startsWith(query));
        })) return true;
        return false;
      });
      setFilteredVideos(filtered);
      
      // If currently viewing a video that's no longer in filtered results, close video player
      if (selectedVideo && showVideoPlayer) {
        const isSelectedVideoInFiltered = filtered.some(v => v.id === selectedVideo.id);
        if (!isSelectedVideoInFiltered) {
          setShowVideoPlayer(false);
          setSelectedVideo(null);
          setVideoUrl(null);
        }
      }
    }
  }, [searchQuery, videos, selectedVideo, showVideoPlayer]);

  // Refresh videos when screen comes into focus (e.g., after uploading)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
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
      const userVideos = await videoService.getUserVideos(user.id);
      setVideos(userVideos);
      setFilteredVideos(userVideos);
      
      
      // Process any pending thumbnails with Bunny
      await processPendingThumbnails(userVideos);
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
        if (searchQuery.trim() === '') {
          setFilteredVideos(updatedVideos);
        }
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
      // Real-time subscription setup failed (non-critical)
      // Fallback to manual refresh only
      return () => {};
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const processPendingThumbnails = async (videosList: VideoWithMetadata[]) => {
    if (!user || !videosList || videosList.length === 0) {
      return;
    }
    
    // Find videos that need thumbnail processing
    const pendingVideos = videosList.filter(v => 
      v.thumb_status === 'pending' && 
      v.storage_path &&
      !v.bunny_video_id // Not already processed by Bunny
    );
    
    if (pendingVideos.length === 0) return;
    
    // Process each pending video
    for (const video of pendingVideos) {
      try {
        await BunnyStreamService.processVideo(video.id, user.id, video.storage_path);
      } catch (error) {
        console.error(`Failed to process video ${video.id}:`, error);
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
      return true;
    }
    
    return false;
  };

  const handleForceRefresh = () => {
    handleRefresh();
  };

  const loadVideoUrl = async (video: VideoWithMetadata, retryCount: number = 0): Promise<string | null> => {
    try {
      // Check cache first
      const cachedUrl = videoUrlCache.get(video.id);
      if (cachedUrl) {
        setVideoUrl(cachedUrl);
        return cachedUrl;
      }

      const url = await videoService.getVideoUrl(video);
      if (url) {
        setVideoUrl(url);
        setUrlRetryCount(0); // Reset retry count on success
        
        // Update cache
        setVideoUrlCache(prev => {
          const newCache = new Map(prev);
          newCache.set(video.id, url);
          
          // Keep last 20 URLs in cache (increased for better performance)
          if (newCache.size > 20) {
            const firstKey = newCache.keys().next().value;
            // If it's a blob URL, revoke it to free memory
            const oldUrl = newCache.get(firstKey);
            if (oldUrl && oldUrl.startsWith('blob:')) {
              URL.revokeObjectURL(oldUrl);
            }
            newCache.delete(firstKey);
          }
          
          return newCache;
        });
        
        return url;
      } else {
        setVideoError('Unable to generate secure video link. Please check your permissions.');
        // Failed to get secure video URL
        return null;
      }
    } catch (error) {
      console.error('Error loading video URL:', error);
      if (error instanceof Error && error.message.includes('permission')) {
        setVideoError('Access denied. You can only view videos you uploaded.');
      } else {
        setVideoError('Failed to load video. Please check your connection and try again.');
      }
      return null;
    }
  };

  const preloadAdjacentVideos = async (currentIndex: number) => {
    // Preload previous and next video URLs from original videos list
    const prevIndex = currentIndex - 1;
    const nextIndex = currentIndex + 1;
    
    if (prevIndex >= 0 && videos[prevIndex]) {
      const prevVideo = videos[prevIndex];
      if (!videoUrlCache.has(prevVideo.id)) {
        videoService.getVideoUrl(prevVideo).then(url => {
          if (url) {
            setVideoUrlCache(prev => {
              const newCache = new Map(prev);
              newCache.set(prevVideo.id, url);
              return newCache;
            });
          }
        }).catch(() => {});
      }
    }
    
    if (nextIndex < videos.length && videos[nextIndex]) {
      const nextVideo = videos[nextIndex];
      if (!videoUrlCache.has(nextVideo.id)) {
        videoService.getVideoUrl(nextVideo).then(url => {
          if (url) {
            setVideoUrlCache(prev => {
              const newCache = new Map(prev);
              newCache.set(nextVideo.id, url);
              return newCache;
            });
          }
        }).catch(() => {});
      }
    }
  };

  const preloadAdjacentVideosFromFiltered = async (currentIndex: number) => {
    // Preload previous and next video URLs from filtered videos list
    const prevIndex = currentIndex - 1;
    const nextIndex = currentIndex + 1;
    
    if (prevIndex >= 0 && filteredVideos[prevIndex]) {
      const prevVideo = filteredVideos[prevIndex];
      if (!videoUrlCache.has(prevVideo.id)) {
        videoService.getVideoUrl(prevVideo).then(url => {
          if (url) {
            setVideoUrlCache(prev => {
              const newCache = new Map(prev);
              newCache.set(prevVideo.id, url);
              return newCache;
            });
          }
        }).catch(() => {});
      }
    }
    
    if (nextIndex < filteredVideos.length && filteredVideos[nextIndex]) {
      const nextVideo = filteredVideos[nextIndex];
      if (!videoUrlCache.has(nextVideo.id)) {
        videoService.getVideoUrl(nextVideo).then(url => {
          if (url) {
            setVideoUrlCache(prev => {
              const newCache = new Map(prev);
              newCache.set(nextVideo.id, url);
              return newCache;
            });
          }
        }).catch(() => {});
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
    
    // Check if URL is cached
    const cachedUrl = videoUrlCache.get(video.id);
    if (cachedUrl) {
      setVideoUrl(cachedUrl);
      setVideoLoading(false);
    } else {
      setVideoLoading(true);
      setVideoUrl(null);
    }
    
    setVideoError(null);
    setUrlRetryCount(0);
    setShowVideoPlayer(true);

    // Load URL if not cached
    if (!cachedUrl) {
      await loadVideoUrl(video);
      setVideoLoading(false);
    }
    
    // Preload adjacent videos from filtered list since that's what user is navigating
    const filteredVideoIndex = filteredVideos.findIndex(v => v.id === video.id);
    if (filteredVideoIndex !== -1) {
      preloadAdjacentVideosFromFiltered(filteredVideoIndex);
    }
  };

  const handleVideoChange = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= filteredVideos.length) return;
    
    const newVideo = filteredVideos[newIndex];
    setSelectedVideo(newVideo);
    setVideoError(null);
    
    // Check if URL is cached
    const cachedUrl = videoUrlCache.get(newVideo.id);
    if (cachedUrl) {
      setVideoUrl(cachedUrl);
      setVideoLoading(false);
    } else {
      setVideoLoading(true);
      setVideoUrl(null);
      await loadVideoUrl(newVideo);
      setVideoLoading(false);
    }
    
    // Preload adjacent videos from filtered list
    preloadAdjacentVideosFromFiltered(newIndex);
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
            data={filteredVideos}
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
        Upload your first video to get started
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#8e8e8e" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search with VideoAI"
                placeholderTextColor="#8e8e8e"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color="#8e8e8e" />
                </TouchableOpacity>
              )}
            </View>
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
        videos={filteredVideos} // Pass filtered videos so swipe navigation respects current filter
        currentIndex={selectedVideo ? filteredVideos.findIndex(v => v.id === selectedVideo.id) : 0}
        onVideoChange={handleVideoChange}
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
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingTop: Platform.OS === 'web' ? 20 : 20,
    paddingBottom: 6, // Reduced from 12px
    backgroundColor: '#000',
  },
  searchBarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 19, // Fully rounded edges
    paddingHorizontal: 12,
    height: 38, // Increased by 5% from 36px
    width: '100%',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    ...getInterFontConfig('200'),
    padding: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
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