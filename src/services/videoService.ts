import { supabase } from './supabase';
import { Database } from '../types/database';
import { getNetworkStatus, getOfflineData, setOfflineData } from '../utils/pwaUtils';
import { BunnyStreamService } from './bunnyStreamService';

type Video = Database['public']['Tables']['videos']['Row'];

export interface VideoWithMetadata extends Video {
  thumbnailUrl?: string;
}

class VideoService {
  // Fetch videos for a user with offline support
  async getUserVideos(userId: string): Promise<VideoWithMetadata[]> {
    const cacheKey = `user_videos_${userId}`;
    
    try {
      // Check if we're offline
      if (!getNetworkStatus()) {
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Return cached data if available
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      // Add thumbnail URLs and merge tags
      // Process thumbnail URLs
      
      const videosWithThumbnails = await Promise.all(
        data.map(async (video, index) => {
          let thumbnailUrl: string | undefined;
          
          // Priority 1: Use Bunny.net thumbnail URL if available
          if (video.bunny_thumbnail_url) {
            thumbnailUrl = video.bunny_thumbnail_url;
            // Using Bunny.net thumbnail
          }
          // Priority 2: Use Supabase Storage thumbnail with signed URL
          else if (video.thumbnail_path) {
            thumbnailUrl = await this.getFileUrl('thumbnails', video.thumbnail_path) || undefined;
            // Using Supabase thumbnail
          }
          // No thumbnail available
          else {
            // No thumbnail source available
          }

          // Merge user_tags and ai_tags for display
          const mergedTags = [
            ...(video.user_tags || []),
            ...(video.ai_tags || [])
          ];
          // Remove duplicates
          const uniqueTags = Array.from(new Set(mergedTags));

          return {
            ...video,
            tags: uniqueTags, // Override tags with merged array
            thumbnailUrl,
          };
        })
      );

      // Cache the results for offline use
      setOfflineData(cacheKey, videosWithThumbnails);

      // Thumbnail processing complete

      return videosWithThumbnails;
    } catch (error) {
      // Return cached data if available
      const cachedVideos = getOfflineData(cacheKey);
      return cachedVideos || [];
    }
  }

  // Get secure signed URL for a file in storage (user-specific access)
  async getSecureFileUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      // Generate secure signed URL
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      return null;
    }
  }

  // Generate signed URL for reliable thumbnail access
  async getFileUrl(bucket: string, path: string): Promise<string | null> {
    try {
      
      // First, verify the file exists in storage
      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/') || '', {
          search: path.split('/').pop()
        });
      
      if (listError || !listData || listData.length === 0) {
        return null;
      }
      
      
      // Generate signed URL (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour expiry
      
      if (error) {
        return null;
      }
      
      if (!data?.signedUrl) {
        return null;
      }
      
      
      // Quick test of the signed URL
      try {
        const testResponse = await fetch(data.signedUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
        } else {
        }
      } catch (testError) {
        // Continue anyway - CORS might block HEAD but image should still work
      }

      return data.signedUrl;
    } catch (error) {
      return null;
    }
  }

  // Get video playback URL
  async getVideoUrl(video: VideoWithMetadata): Promise<string | null> {
    try {
      // Get video URL for playback
      
      if (!video.storage_path) {
        return null;
      }

      // Generate signed URL for video access
      // Use signed URL for secure, user-specific access (expires in 1 hour)
      const videoUrl = await this.getSecureFileUrl('videos', video.storage_path, 3600);
      
      if (videoUrl) {
        // Video URL generated successfully
        // Test URL accessibility
        try {
          const response = await fetch(videoUrl, { method: 'HEAD' });
          if (!response.ok) {
          }
        } catch (fetchError) {
        }
      } else {
      }
      
      return videoUrl;
    } catch (error) {
      return null;
    }
  }

  // Subscribe to real-time video updates
  subscribeToVideoUpdates(userId: string, callback: (videos: VideoWithMetadata[]) => void) {
    
    const subscription = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Refetch videos when changes occur
          const videos = await this.getUserVideos(userId);
          callback(videos);
        }
      )
      .subscribe((status, err) => {
      });

    return subscription;
  }

  // Delete a video
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      // First get the video to know file paths
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('storage_path, thumbnail_path, bunny_video_id')
        .eq('id', videoId)
        .single();

      if (fetchError || !video) {
        return false;
      }

      // Delete from Bunny.net if video exists there
      if (video.bunny_video_id) {
        const bunnyDeleted = await BunnyStreamService.deleteVideo(video.bunny_video_id);
        if (!bunnyDeleted) {
          console.warn(`Failed to delete video from Bunny.net, but continuing with local deletion`);
        }
      }

      // Delete from videos bucket
      if (video.storage_path) {
        await supabase.storage
          .from('videos')
          .remove([video.storage_path]);
      }


      // Delete video record from database
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (deleteError) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Get video by ID
  async getVideoById(videoId: string): Promise<VideoWithMetadata | null> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error || !data) {
        return null;
      }

      let thumbnailUrl: string | undefined;
      
      // Priority 1: Use Bunny.net thumbnail URL if available
      if (data.bunny_thumbnail_url) {
        thumbnailUrl = data.bunny_thumbnail_url;
      }
      // Priority 2: Use Supabase Storage thumbnail with signed URL
      else if (data.thumbnail_path) {
        thumbnailUrl = await this.getFileUrl('thumbnails', data.thumbnail_path) || undefined;
      }

      // Merge user_tags and ai_tags for display
      const mergedTags = [
        ...(data.user_tags || []),
        ...(data.ai_tags || [])
      ];
      // Remove duplicates
      const uniqueTags = Array.from(new Set(mergedTags));

      return {
        ...data,
        tags: uniqueTags, // Override tags with merged array
        thumbnailUrl,
      };
    } catch (error) {
      return null;
    }
  }

  // Update video metadata
  async updateVideo(
    videoId: string, 
    updates: Partial<Pick<Video, 'title' | 'description' | 'status' | 'tags' | 'user_tags' | 'ai_tags'>>
  ): Promise<boolean> {
    try {
      // If updating user_tags, also update the merged tags
      const finalUpdates = { ...updates };
      if (updates.user_tags !== undefined) {
        // Get current ai_tags to merge
        const { data: currentVideo } = await supabase
          .from('videos')
          .select('ai_tags')
          .eq('id', videoId)
          .single();
        
        if (currentVideo) {
          const mergedTags = [
            ...(updates.user_tags || []),
            ...(currentVideo.ai_tags || [])
          ];
          finalUpdates.tags = Array.from(new Set(mergedTags));
        }
      }

      const { error } = await supabase
        .from('videos')
        .update(finalUpdates)
        .eq('id', videoId);

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Get AI-generated summary for a video
  async getVideoSummary(videoId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('summaries')
        .select('content')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.content;
    } catch (error) {
      return null;
    }
  }

  // Get transcript for a video
  async getVideoTranscript(videoId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select('content')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.content;
    } catch (error) {
      return null;
    }
  }

}

export const videoService = new VideoService();