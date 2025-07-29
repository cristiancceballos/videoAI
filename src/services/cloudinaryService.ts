import { supabase } from './supabase';
import { costMonitoring } from '../utils/costMonitoring';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'ddboyfn5x'; // Your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'video-thumbnails'; // Unsigned upload preset for thumbnails

export interface CloudinaryThumbnailResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
}

class CloudinaryService {
  /**
   * Triggers Cloudinary thumbnail generation for a video
   * @param videoId - ID of the video
   * @param userId - ID of the user
   * @param storagePath - Storage path of the video file
   * @returns Promise with thumbnail generation result
   */
  async generateThumbnail(
    videoId: string, 
    userId: string, 
    storagePath: string
  ): Promise<CloudinaryThumbnailResult> {
    try {

      // Call the Cloudinary thumbnail Edge Function
      const { data, error } = await supabase.functions.invoke('cloudinary-thumbnails', {
        body: {
          videoId,
          userId,
          storagePath,
          cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
          uploadPreset: CLOUDINARY_UPLOAD_PRESET
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to invoke thumbnail generation function'
        };
      }

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || 'Thumbnail generation failed'
        };
      }

      
      // Record the thumbnail generation for cost monitoring
      costMonitoring.recordThumbnailGeneration();
      
      return {
        success: true,
        thumbnailUrl: data.thumbnailUrl
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Gets the current thumbnail status for a video
   * @param videoId - ID of the video
   * @returns Promise with video thumbnail status
   */
  async getThumbnailStatus(videoId: string): Promise<{
    thumb_status?: string;
    cloudinary_url?: string;
    thumb_error_message?: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('thumb_status, cloudinary_url, thumb_error_message')
        .eq('id', videoId)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Retries thumbnail generation for a failed video
   * @param videoId - ID of the video
   * @param userId - ID of the user
   * @param storagePath - Storage path of the video file
   * @returns Promise with retry result
   */
  async retryThumbnailGeneration(
    videoId: string,
    userId: string,
    storagePath: string
  ): Promise<CloudinaryThumbnailResult> {
    
    // Reset status to pending before retry
    await supabase
      .from('videos')
      .update({ 
        thumb_status: 'pending',
        thumb_error_message: null 
      })
      .eq('id', videoId);

    return this.generateThumbnail(videoId, userId, storagePath);
  }

  /**
   * Monitors thumbnail generation progress
   * @param videoId - ID of the video
   * @param onStatusChange - Callback for status updates
   * @returns Subscription that can be unsubscribed
   */
  subscribeToThumbnailStatus(
    videoId: string,
    onStatusChange: (status: {
      thumb_status?: string;
      cloudinary_url?: string;
      thumb_error_message?: string;
    }) => void
  ) {
    
    const subscription = supabase
      .channel(`thumbnail_${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`,
        },
        (payload) => {
          onStatusChange({
            thumb_status: payload.new.thumb_status,
            cloudinary_url: payload.new.cloudinary_url,
            thumb_error_message: payload.new.thumb_error_message
          });
        }
      )
      .subscribe((status, err) => {
      });

    return subscription;
  }
}

export const cloudinaryService = new CloudinaryService();