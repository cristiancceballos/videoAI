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
        console.log('Offline: Loading videos from cache');
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching videos:', error);
        // Return cached data if available
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      // Add thumbnail URLs
      console.log('🎬 [VIDEO SERVICE DEBUG] Processing thumbnail URLs for', data.length, 'videos');
      
      const videosWithThumbnails = await Promise.all(
        data.map(async (video, index) => {
          const thumbnailUrl = video.thumbnail_path 
            ? await this.getFileUrl('thumbnails', video.thumbnail_path)
            : undefined;

          // Only log if there's an issue
          if (video.thumbnail_path && !thumbnailUrl) {
            console.warn(`⚠️ [VIDEO SERVICE DEBUG] Failed to get thumbnail URL for video ${video.id}:`, {
              thumbnail_path: video.thumbnail_path,
              title: video.title.substring(0, 20) + '...'
            });
          }

          return {
            ...video,
            thumbnailUrl,
          };
        })
      );

      // Cache the results for offline use
      setOfflineData(cacheKey, videosWithThumbnails);

      console.log('🎉 [VIDEO SERVICE DEBUG] Final videos with thumbnails:', {
        totalVideos: videosWithThumbnails.length,
        videosWithThumbnails: videosWithThumbnails.filter(v => v.thumbnailUrl).length,
        videosWithoutThumbnails: videosWithThumbnails.filter(v => !v.thumbnailUrl).length,
        summary: videosWithThumbnails.map(v => ({
          id: v.id,
          title: v.title.substring(0, 20) + '...',
          status: v.status,
          hasThumbnailPath: !!v.thumbnail_path,
          hasThumbnailUrl: !!v.thumbnailUrl
        }))
      });

      return videosWithThumbnails;
    } catch (error) {
      console.error('Video service error:', error);
      // Return cached data if available
      const cachedVideos = getOfflineData(cacheKey);
      return cachedVideos || [];
    }
  }

  // Get secure signed URL for a file in storage (user-specific access)
  async getSecureFileUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      console.log('🔐 Getting secure signed URL from bucket:', bucket, 'path:', path, 'expires in:', expiresIn, 'seconds');
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      console.log('Supabase signed URL created successfully (expires in', expiresIn / 60, 'minutes)');
      return data.signedUrl;
    } catch (error) {
      console.error('Exception creating signed URL:', error);
      return null;
    }
  }

  // Generate signed URL for reliable thumbnail access
  async getFileUrl(bucket: string, path: string): Promise<string | null> {
    try {
      console.log('🔍 [SIGNED URL DEBUG] Generating signed URL for file:', path);
      
      // First, verify the file exists in storage
      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/') || '', {
          search: path.split('/').pop()
        });
      
      if (listError || !listData || listData.length === 0) {
        console.error('❌ [SIGNED URL DEBUG] File not found:', path);
        return null;
      }
      
      console.log('✅ [SIGNED URL DEBUG] File exists, generating signed URL...');
      
      // Generate signed URL (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour expiry
      
      if (error) {
        console.error('❌ [SIGNED URL DEBUG] Error generating signed URL:', error);
        return null;
      }
      
      if (!data?.signedUrl) {
        console.error('❌ [SIGNED URL DEBUG] No signed URL returned');
        return null;
      }
      
      console.log('✅ [SIGNED URL DEBUG] Signed URL generated successfully for:', path);
      
      // Quick test of the signed URL
      try {
        const testResponse = await fetch(data.signedUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.warn('⚠️ [SIGNED URL DEBUG] Signed URL test returned:', testResponse.status);
        } else {
          console.log('✅ [SIGNED URL DEBUG] Signed URL accessible:', testResponse.status);
        }
      } catch (testError) {
        console.warn('⚠️ [SIGNED URL DEBUG] URL test failed (might be CORS):', testError.message);
        // Continue anyway - CORS might block HEAD but image should still work
      }

      return data.signedUrl;
    } catch (error) {
      console.error('💥 [SIGNED URL DEBUG] Exception generating signed URL:', {
        path: path,
        bucket: bucket,
        error: error.message
      });
      return null;
    }
  }

  // Get video playback URL
  async getVideoUrl(video: VideoWithMetadata): Promise<string | null> {
    try {
      console.log('Getting video URL for:', video.title);
      console.log('Video storage details:', {
        id: video.id,
        storage_path: video.storage_path,
        status: video.status,
        file_size: video.file_size,
        user_id: video.user_id
      });
      
      if (!video.storage_path) {
        console.error('No storage path found for video:', video.title);
        return null;
      }

      console.log('Attempting to get secure signed URL from bucket "videos" with path:', video.storage_path);
      // Use signed URL for secure, user-specific access (expires in 1 hour)
      const videoUrl = await this.getSecureFileUrl('videos', video.storage_path, 3600);
      
      if (videoUrl) {
        console.log('Video URL generated successfully:', videoUrl);
        // Test if URL is accessible
        try {
          const response = await fetch(videoUrl, { method: 'HEAD' });
          console.log('URL accessibility test:', response.status, response.statusText);
          if (!response.ok) {
            console.error('Generated URL is not accessible:', response.status, response.statusText);
          }
        } catch (fetchError) {
          console.error('URL accessibility test failed:', fetchError);
        }
      } else {
        console.error('Failed to generate video URL for path:', video.storage_path);
      }
      
      return videoUrl;
    } catch (error) {
      console.error('Error getting video URL:', error);
      return null;
    }
  }

  // Subscribe to real-time video updates
  subscribeToVideoUpdates(userId: string, callback: (videos: VideoWithMetadata[]) => void) {
    console.log('Setting up real-time subscription for user:', userId);
    
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
          console.log('Real-time video change detected:', payload);
          // Refetch videos when changes occur
          const videos = await this.getUserVideos(userId);
          console.log('Refreshed videos via real-time:', videos.length);
          callback(videos);
        }
      )
      .subscribe((status, err) => {
        console.log('🔔 Real-time subscription status:', status);
        if (err) console.error('❌ Real-time subscription error:', err);
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
        console.error('Error fetching video for deletion:', fetchError);
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
        console.error('Error deleting video record:', deleteError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete video error:', error);
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
        console.error('Error fetching video:', error);
        return null;
      }

      const thumbnailUrl = data.thumbnail_path 
        ? await this.getFileUrl('thumbnails', data.thumbnail_path)
        : undefined;

      return {
        ...data,
        thumbnailUrl,
      };
    } catch (error) {
      console.error('Error getting video by ID:', error);
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
        console.error('Error updating video:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Update video error:', error);
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
      console.log('🖼️ Generating thumbnail for video:', videoId);

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

      console.log('✅ Thumbnail generated successfully');
      return {
        success: true,
        thumbnailUrl: result.thumbnailUrl
      };

    } catch (error) {
      console.error('Thumbnail generation error:', error);
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
      console.log('🗑️ Removing thumbnail for video:', videoId);

      // Verify user owns this video
      const canModify = await thumbnailService.canModifyThumbnail(videoId, userId);
      if (!canModify) {
        console.error('Permission denied: User does not own this video');
        return false;
      }

      const success = await thumbnailService.removeThumbnail(videoId, userId);
      
      if (success) {
        console.log('✅ Thumbnail removed successfully');
      }

      return success;
    } catch (error) {
      console.error('Thumbnail removal error:', error);
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
        thumbnailUrl = await thumbnailService.getThumbnailUrl(video.thumbnail_path);
      }

      return {
        ...video,
        thumbnailUrl
      };
    } catch (error) {
      console.error('Error refreshing thumbnail:', error);
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
      console.error('Error refreshing multiple thumbnails:', error);
      return videos; // Return original array if refresh fails
    }
  }
}

export const videoService = new VideoService();