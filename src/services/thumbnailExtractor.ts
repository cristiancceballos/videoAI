import { supabase } from './supabase';

export interface ThumbnailResult {
  success: boolean;
  blob?: Blob;
  dataUrl?: string;
  error?: string;
}

export interface ThumbnailUploadResult {
  success: boolean;
  thumbnailPath?: string;
  error?: string;
}

class ThumbnailExtractor {
  /**
   * Extract thumbnail from video file using HTML5 Canvas
   */
  async extractThumbnail(
    videoFile: File,
    timeSeconds: number = 3
  ): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({ success: false, error: 'Canvas context not available' });
        return;
      }

      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
      };

      const onLoadedMetadata = () => {
        try {
          // Calculate optimal time based on video duration
          let targetTime = timeSeconds;
          
          if (video.duration < 3) {
            // For short videos, use middle frame
            targetTime = Math.max(0.5, video.duration / 2);
          } else if (video.duration < 10) {
            // For medium videos, use 2 seconds
            targetTime = 2;
          } else {
            // For longer videos, use specified time (default 3 seconds)
            targetTime = Math.min(timeSeconds, video.duration - 1);
          }
          
          // Extract thumbnail at calculated time
          
          // Set canvas dimensions (16:9 aspect ratio, 400px wide)
          canvas.width = 400;
          canvas.height = 225;
          
          video.currentTime = targetTime;
        } catch (error) {
          cleanup();
          resolve({ success: false, error: `Failed to seek video: ${error}` });
        }
      };

      const onSeeked = () => {
        try {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Video frame drawn to canvas
          
          // Convert to blob
          canvas.toBlob((blob) => {
            cleanup();
            if (blob) {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              // Thumbnail generated successfully
              resolve({ 
                success: true, 
                blob, 
                dataUrl 
              });
            } else {
              resolve({ success: false, error: 'Failed to create thumbnail blob' });
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          cleanup();
          resolve({ success: false, error: `Failed to draw frame: ${error}` });
        }
      };

      const onError = (error: any) => {
        cleanup();
        resolve({ success: false, error: `Video loading error: ${error.message || 'Unknown error'}` });
      };

      // Set up event listeners
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);

      // Load video
      video.src = URL.createObjectURL(videoFile);
      video.load();

      // Timeout after 10 seconds
      setTimeout(() => {
        cleanup();
        resolve({ success: false, error: 'Thumbnail extraction timeout' });
      }, 10000);
    });
  }

  /**
   * Upload thumbnail to Supabase storage
   */
  async uploadThumbnail(
    videoId: string,
    userId: string,
    thumbnailBlob: Blob
  ): Promise<ThumbnailUploadResult> {
    try {
      const fileName = `${videoId}_thumbnail.jpg`;
      const filePath = `${userId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, thumbnailBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Thumbnail upload error:', error);
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        thumbnailPath: data.path 
      };
    } catch (error) {
      console.error('Thumbnail upload exception:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate and upload thumbnail in one step
   */
  async generateAndUploadThumbnail(
    videoFile: File,
    videoId: string,
    userId: string,
    timeSeconds: number = 3
  ): Promise<ThumbnailUploadResult> {
    try {
      // Extract thumbnail
      const extractResult = await this.extractThumbnail(videoFile, timeSeconds);
      
      if (!extractResult.success || !extractResult.blob) {
        return { 
          success: false, 
          error: extractResult.error || 'Failed to extract thumbnail' 
        };
      }

      // Upload thumbnail
      const uploadResult = await this.uploadThumbnail(videoId, userId, extractResult.blob);
      
      return uploadResult;
    } catch (error) {
      console.error('Generate and upload thumbnail error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update video record with thumbnail path
   */
  async updateVideoThumbnail(
    videoId: string,
    thumbnailPath: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          thumbnail_path: thumbnailPath,
          thumb_status: 'ready'
        })
        .eq('id', videoId);

      if (error) {
        console.error('Update video thumbnail error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Update video thumbnail exception:', error);
      return false;
    }
  }
}

export const thumbnailExtractor = new ThumbnailExtractor();