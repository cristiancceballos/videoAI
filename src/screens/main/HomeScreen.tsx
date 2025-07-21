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
import { VideoCard } from '../../components/VideoCard';

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const [videos, setVideos] = useState<VideoWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadVideos();
      setupRealtimeSubscription();
    }
  }, [user]);

  // Refresh videos when screen comes into focus (e.g., after uploading)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadVideos();
      }
    }, [user])
  );

  const loadVideos = async (showLoading = false) => {
    if (!user) return;
    
    if (showLoading) setLoading(true);
    
    try {
      const userVideos = await videoService.getUserVideos(user.id);
      setVideos(userVideos);
      console.log('Loaded videos:', userVideos.length);
    } catch (error) {
      console.error('Error loading videos:', error);
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const subscription = videoService.subscribeToVideoUpdates(user.id, (updatedVideos) => {
      setVideos(updatedVideos);
    });

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const handleVideoPress = (video: VideoWithMetadata) => {
    // TODO: Navigate to video detail screen in Phase 4
    if (video.status === 'ready') {
      Alert.alert('Video Ready', 'Video details and AI features coming in Phase 4!');
    } else if (video.status === 'processing') {
      Alert.alert('Processing', 'Your video is still being processed. Please wait...');
    } else if (video.status === 'error') {
      Alert.alert('Error', 'There was an error processing this video.');
    }
  };

  const renderVideoCard = ({ item }: { item: VideoWithMetadata }) => (
    <VideoCard video={item} onPress={handleVideoPress} />
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
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos}
        renderItem={renderVideoCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
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