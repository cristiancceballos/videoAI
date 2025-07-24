import { supabase } from './supabase';
import { Database } from '../types/database';
import { webUploadService } from './webUploadService';
import { FrameCaptureResult, generateThumbnailFilename } from '../utils/frameCapture';

export interface ThumbnailUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ThumbnailUploadResult {
  success: boolean;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  error?: string;
}

class ThumbnailService {
  
  /**
   * Uploads a captured frame as a video thumbnail
   * @param videoId - ID of the video this thumbnail belongs to
   * @param userId - ID of the user uploading the thumbnail
   * @param frameData - Captured frame data from frameCapture utility
   * @param timeSeconds - Time position where frame was captured
   * @param onProgress - Progress callback
   * @returns Promise resolving to upload result
   */
  async uploadThumbnail(
    videoId: string,
    userId: string,
    frameData: FrameCaptureResult,
    timeSeconds: number,
    onProgress?: (progress: ThumbnailUploadProgress) => void
  ): Promise<ThumbnailUploadResult> {
    try {
      console.log('📤 Starting thumbnail upload for video:', videoId);

      // Generate filename for the thumbnail
      const filename = generateThumbnailFilename(videoId, timeSeconds, 'jpeg');
      
      // Generate presigned URL for thumbnail upload
      const presignedData = await webUploadService.generatePresignedUrl(
        userId,
        filename,
        'thumbnails'
      );

      if (!presignedData) {
        return {
          success: false,
          error: 'Failed to generate upload URL'
        };
      }

      // Convert blob to File for upload
      const file = new File([frameData.blob], filename, { type: 'image/jpeg' });

      // Upload thumbnail with progress tracking
      const uploadSuccess = await webUploadService.uploadFileWithProgress(
        file,
        presignedData.url,
        onProgress
      );

      if (!uploadSuccess) {
        return {
          success: false,
          error: 'Failed to upload thumbnail file'
        };
      }

      // Update video record with thumbnail path
      const { error: updateError } = await supabase
        .from('videos')
        .update({ thumbnail_path: presignedData.path })
        .eq('id', videoId)
        .eq('user_id', userId); // Security: only allow user to update their own videos

      if (updateError) {
        console.error('Failed to update video with thumbnail path:', updateError);
        return {
          success: false,
          error: 'Failed to save thumbnail reference'
        };
      }

      // Generate public URL for the uploaded thumbnail
      const { data: urlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(presignedData.path);

      console.log('✅ Thumbnail uploaded successfully:', presignedData.path);

      return {
        success: true,
        thumbnailPath: presignedData.path,
        thumbnailUrl: urlData.publicUrl
      };

    } catch (error) {
      console.error('❌ Thumbnail upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Removes a thumbnail from a video
   * @param videoId - ID of the video to remove thumbnail from
   * @param userId - ID of the user (for security)
   * @param thumbnailPath - Path of the thumbnail to delete (optional, will fetch if not provided)
   * @returns Promise resolving to success boolean
   */
  async removeThumbnail(
    videoId: string,
    userId: string,
    thumbnailPath?: string
  ): Promise<boolean> {
    try {
      console.log('🗑️ Removing thumbnail for video:', videoId);

      // Get current thumbnail path if not provided
      if (!thumbnailPath) {
        const { data: video, error } = await supabase
          .from('videos')
          .select('thumbnail_path')
          .eq('id', videoId)
          .eq('user_id', userId)
          .single();

        if (error || !video?.thumbnail_path) {
          console.log('No thumbnail to remove');
          return true; // No thumbnail to remove is considered success
        }

        thumbnailPath = video.thumbnail_path;
      }

      // Delete thumbnail file from storage
      const { error: deleteError } = await supabase.storage
        .from('thumbnails')
        .remove([thumbnailPath]);

      if (deleteError) {
        console.error('Failed to delete thumbnail file:', deleteError);
        // Continue anyway - we still want to clear the database reference
      }

      // Clear thumbnail path from video record
      const { error: updateError } = await supabase
        .from('videos')
        .update({ thumbnail_path: null })
        .eq('id', videoId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to clear thumbnail path from video:', updateError);
        return false;
      }

      console.log('✅ Thumbnail removed successfully');
      return true;

    } catch (error) {
      console.error('❌ Thumbnail removal error:', error);
      return false;
    }
  }

  /**
   * Gets the public URL for a video's thumbnail
   * @param thumbnailPath - Path to the thumbnail in storage
   * @returns Public URL or null if not found
   */
  async getThumbnailUrl(thumbnailPath: string): Promise<string | null> {
    try {
      const { data } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailPath);

      return data.publicUrl;
    } catch (error) {
      console.error('Failed to get thumbnail URL:', error);
      return null;
    }
  }

  /**
   * Validates if a user can modify thumbnails for a video
   * @param videoId - ID of the video
   * @param userId - ID of the user
   * @returns Promise resolving to boolean indicating permission
   */
  async canModifyThumbnail(videoId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('user_id')
        .eq('id', videoId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.user_id === userId;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Gets storage usage information for thumbnails
   * @param userId - ID of the user
   * @returns Promise resolving to usage stats
   */
  async getThumbnailUsage(userId: string): Promise<{
    count: number;
    totalSize: number;
  } | null> {
    try {
      // This would require listing files in storage, which might have limitations
      // For now, we can count videos with thumbnails
      const { data, error } = await supabase
        .from('videos')
        .select('thumbnail_path')
        .eq('user_id', userId)
        .not('thumbnail_path', 'is', null);

      if (error) {
        console.error('Failed to get thumbnail usage:', error);
        return null;
      }

      return {
        count: data.length,
        totalSize: 0 // Would need storage API to get actual sizes
      };
    } catch (error) {
      console.error('Thumbnail usage error:', error);
      return null;
    }
  }
}

export const thumbnailService = new ThumbnailService();