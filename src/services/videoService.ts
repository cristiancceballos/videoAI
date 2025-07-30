import { supabase } from './supabase';
import { Database } from '../types/database';
import { getNetworkStatus, getOfflineData, setOfflineData } from '../utils/pwaUtils';
import { thumbnailService, ThumbnailUploadProgress } from './thumbnailService';
import { FrameCaptureResult } from '../utils/frameCapture';

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

      // Add thumbnail URLs
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


          return {
            ...video,
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
        .select('storage_path, thumbnail_path')
        .eq('id', videoId)
        .single();

      if (fetchError || !video) {
        return false;
      }

      // Delete files from storage
      const filesToDelete = [video.storage_path];
      if (video.thumbnail_path) {
        filesToDelete.push(video.thumbnail_path);
      }

      // Delete from videos bucket
      if (video.storage_path) {
        await supabase.storage
          .from('videos')
          .remove([video.storage_path]);
      }

      // Delete from thumbnails bucket
      if (video.thumbnail_path) {
        await supabase.storage
          .from('thumbnails')
          .remove([video.thumbnail_path]);
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

      return {
        ...data,
        thumbnailUrl,
      };
    } catch (error) {
      return null;
    }
  }

  // Update video metadata
  async updateVideo(
    videoId: string, 
    updates: Partial<Pick<Video, 'title' | 'description' | 'status'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId);

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // ================================
  // Thumbnail Management Methods
  // ================================

  /**
   * Generates and uploads a thumbnail for a video
   * @param videoId - ID of the video
   * @param userId - ID of the user
   * @param frameData - Captured frame data
   * @param timeSeconds - Time position where frame was captured
   * @param onProgress - Progress callback
   * @returns Promise resolving to success status and thumbnail URL
   */
  async generateThumbnail(
    videoId: string,
    userId: string,
    frameData: FrameCaptureResult,
    timeSeconds: number,
    onProgress?: (progress: ThumbnailUploadProgress) => void
  ): Promise<{ success: boolean; thumbnailUrl?: string; error?: string }> {
    try {

      // Verify user owns this video
      const canModify = await thumbnailService.canModifyThumbnail(videoId, userId);
      if (!canModify) {
        return {
          success: false,
          error: 'Permission denied: You can only generate thumbnails for your own videos'
        };
      }

      // Upload the thumbnail
      const result = await thumbnailService.uploadThumbnail(
        videoId,
        userId,
        frameData,
        timeSeconds,
        onProgress
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to upload thumbnail'
        };
      }

      return {
        success: true,
        thumbnailUrl: result.thumbnailUrl
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Removes a thumbnail from a video
   * @param videoId - ID of the video
   * @param userId - ID of the user
   * @returns Promise resolving to success status
   */
  async removeThumbnail(videoId: string, userId: string): Promise<boolean> {
    try {

      // Verify user owns this video
      const canModify = await thumbnailService.canModifyThumbnail(videoId, userId);
      if (!canModify) {
        return false;
      }

      const success = await thumbnailService.removeThumbnail(videoId, userId);
      
      if (success) {
      }

      return success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refreshes a video's thumbnail URL (useful after thumbnail changes)
   * @param video - Video object to refresh
   * @returns Promise resolving to updated video with fresh thumbnail URL
   */
  async refreshVideoThumbnail(video: VideoWithMetadata): Promise<VideoWithMetadata> {
    try {
      let thumbnailUrl: string | undefined;

      if (video.thumbnail_path) {
        thumbnailUrl = await thumbnailService.getThumbnailUrl(video.thumbnail_path) || undefined;
      }

      return {
        ...video,
        thumbnailUrl
      };
    } catch (error) {
      return video; // Return original video if refresh fails
    }
  }

  /**
   * Gets thumbnail usage statistics for a user
   * @param userId - ID of the user
   * @returns Promise resolving to usage statistics
   */
  async getThumbnailUsage(userId: string): Promise<{
    count: number;
    totalSize: number;
  } | null> {
    return thumbnailService.getThumbnailUsage(userId);
  }

  /**
   * Bulk refreshes thumbnail URLs for multiple videos
   * @param videos - Array of videos to refresh
   * @returns Promise resolving to updated videos array
   */
  async refreshMultipleThumbnails(videos: VideoWithMetadata[]): Promise<VideoWithMetadata[]> {
    try {
      const refreshedVideos = await Promise.all(
        videos.map(video => this.refreshVideoThumbnail(video))
      );
      return refreshedVideos;
    } catch (error) {
      return videos; // Return original array if refresh fails
    }
  }
}

export const videoService = new VideoService();