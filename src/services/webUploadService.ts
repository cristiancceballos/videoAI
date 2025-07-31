import { supabase } from './supabase';
import { Database } from '../types/database';
import { WebMediaAsset } from './webMediaService';
import { thumbnailExtractor } from './thumbnailExtractor';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

class WebUploadService {
  // Generate presigned URL for direct upload to Supabase Storage
  async generatePresignedUrl(
    userId: string,
    filename: string,
    bucket: 'videos' | 'thumbnails' = 'videos'
  ): Promise<{ url: string; path: string } | null> {
    try {
      const fileExt = filename.split('.').pop()?.toLowerCase();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${userId}/${Date.now()}_${sanitizedFilename}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);

      if (error) {
        return null;
      }

      return {
        url: data.signedUrl,
        path: data.path,
      };
    } catch (error) {
      return null;
    }
  }

  // Upload web file using XMLHttpRequest with progress tracking
  async uploadFileWithProgress(
    file: File,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<boolean> {
    try {
      // Starting file upload

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = {
              loaded: event.loaded,
              total: event.total,
              percentage: (event.loaded / event.total) * 100,
            };
            onProgress(progress);
            // Upload progress tracked
          }
        };

        xhr.onload = () => {
          // Upload completed

          if (xhr.status === 200 || xhr.status === 201) {
            // Upload successful
            resolve(true);
          } else {
            resolve(false);
          }
        };

        xhr.onerror = (error) => {
          resolve(false);
        };

        xhr.ontimeout = () => {
          resolve(false);
        };

        xhr.onabort = () => {
          resolve(false);
        };

        // Set timeout to 60 seconds
        xhr.timeout = 60000;

        // Initiate upload
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        
        // Request headers set
        
        xhr.send(file);
        // Request sent
      });
    } catch (error) {
      return false;
    }
  }

  // Create video record in database
  async createVideoRecord(
    userId: string,
    asset: WebMediaAsset,
    storagePath: string,
    sourceType: 'device' | 'youtube' | 'tiktok',
    sourceUrl?: string,
    title?: string
  ): Promise<string | null> {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return null;
      }
      
      // Session verified
      
      type VideoInsert = Database['public']['Tables']['videos']['Insert'];
      
      const videoData: VideoInsert = {
        user_id: userId,
        title: title || asset.filename,
        storage_path: storagePath,
        status: 'uploading',
        thumb_status: 'pending', // Set thumbnail status to pending for Bunny processing
        file_size: Math.round(asset.fileSize), // Ensure integer
        duration: asset.duration ? Math.round(asset.duration) : undefined, // Convert to integer seconds
        source_type: sourceType,
        source_url: sourceUrl,
        original_filename: asset.filename,
        width: asset.width ? Math.round(asset.width) : undefined, // Ensure integer
        height: asset.height ? Math.round(asset.height) : undefined, // Ensure integer
      };

      // Insert video data

      const { data, error } = await supabase
        .from('videos')
        .insert(videoData)
        .select('id')
        .single();

      if (error) {
        
        // Provide user-friendly error messages
        if (error.code === '22P02') {
        } else if (error.code === '23505') {
        } else if (error.message?.includes('row-level security')) {
        }
        
        return null;
      }

      // Video record created
      return data.id;
    } catch (error) {
      return null;
    }
  }

  // Update video status
  async updateVideoStatus(
    videoId: string,
    status: 'uploading' | 'processing' | 'ready' | 'error',
    thumbnailPath?: string
  ): Promise<boolean> {
    try {
      // Update video status
      
      const updateData: any = { status };
      if (thumbnailPath) {
        updateData.thumbnail_path = thumbnailPath;
        // Add thumbnail path
      } else if (status === 'ready') {
        // No thumbnail path provided
      }

      // Update data prepared

      const { data, error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId)
        .select('*');

      if (error) {
        return false;
      }

      // Video status updated successfully
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // First frame thumbnail generation moved to server-side FFmpeg

  // Upload device video (complete flow for web)
  async uploadWebVideo(
    asset: WebMediaAsset,
    userId: string,
    title: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // 1. Validate video file
      const validation = this.validateVideoFile(asset);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Generate presigned URL
      const uploadUrl = await this.generatePresignedUrl(userId, asset.filename);
      if (!uploadUrl) {
        return { success: false, error: 'Failed to generate upload URL' };
      }

      // 3. Create video record in database
      const videoId = await this.createVideoRecord(
        userId,
        asset,
        uploadUrl.path,
        'device',
        undefined,
        title
      );

      if (!videoId) {
        return { success: false, error: 'Failed to create video record' };
      }

      // 4. Upload file
      const uploadSuccess = await this.uploadFileWithProgress(
        asset.file,
        uploadUrl.url,
        onProgress
      );

      if (!uploadSuccess) {
        // Update status to error
        await this.updateVideoStatus(videoId, 'error');
        return { success: false, error: 'File upload failed' };
      }

      // 5. Mark video as ready first (video is playable regardless of thumbnail)
      await this.updateVideoStatus(videoId, 'ready');
      
      // 6. Generate client-side thumbnail (non-blocking)
      try {
        // Generate client-side thumbnail
        const thumbnailResult = await thumbnailExtractor.generateAndUploadThumbnail(
          asset.file,
          videoId,
          userId,
          3 // Extract frame at 3 seconds
        );

        if (thumbnailResult.success && thumbnailResult.thumbnailPath) {
          // Update video with thumbnail path
          await thumbnailExtractor.updateVideoThumbnail(videoId, thumbnailResult.thumbnailPath);
          // Thumbnail generated successfully
        } else {
          // Video remains ready, just without thumbnail
        }
      } catch (error) {
        // Video remains ready, just without thumbnail
      }

      // Note: Blob URL cleanup is handled by the WebVideoPreviewModal component
      // to prevent premature revocation during thumbnail generation

      return { success: true, videoId };
    } catch (error) {
      return { success: false, error: 'Unexpected error during upload' };
    }
  }

  // Note: Removed complex Cloudinary fallback - now using reliable client-side extraction

  // Validate video file
  private validateVideoFile(asset: WebMediaAsset): { valid: boolean; error?: string } {
    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (asset.fileSize > maxSize) {
      return { valid: false, error: 'Video file is too large (max 100MB)' };
    }

    // Check duration (30 minutes limit)
    if (asset.duration && asset.duration > 30 * 60) {
      return { valid: false, error: 'Video is too long (max 30 minutes)' };
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/webm'];
    if (!allowedTypes.includes(asset.file.type)) {
      return { valid: false, error: 'Video format not supported. Please use MP4, MOV, AVI, or WebM.' };
    }

    return { valid: true };
  }

  // Validate YouTube/TikTok URLs
  validateVideoUrl(url: string): { valid: boolean; type?: 'youtube' | 'tiktok'; error?: string } {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    const tiktokRegex = /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)/;

    if (youtubeRegex.test(url)) {
      return { valid: true, type: 'youtube' };
    }
    
    if (tiktokRegex.test(url)) {
      return { valid: true, type: 'tiktok' };
    }

    return { valid: false, error: 'Invalid video URL. Please provide a YouTube or TikTok link.' };
  }

  // Upload video from URL (simplified implementation for Phase 2)
  async uploadVideoFromUrl(
    url: string,
    userId: string,
    title: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // 1. Validate URL
      const validation = this.validateVideoUrl(url);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Create video record in database with processing status
      const filename = `${validation.type}_${Date.now()}.mp4`;
      const path = `${userId}/${filename}`;
      
      const videoId = await this.createVideoRecord(
        userId,
        {
          uri: url,
          type: 'video' as const,
          file: new File([], filename, { type: 'video/mp4' }), // Proper file constructor
          fileSize: 0, // Will be updated when processed
          filename,
        },
        path,
        validation.type!,
        url,
        title
      );

      if (!videoId) {
        return { success: false, error: 'Failed to create video record' };
      }

      // 3. For Phase 2, mark as processing (actual download will be in Phase 3)
      await this.updateVideoStatus(videoId, 'processing');

      // Simulate progress for user feedback
      if (onProgress) {
        const progressIntervals = [20, 40, 60, 80, 100];
        for (let i = 0; i < progressIntervals.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          onProgress({
            loaded: progressIntervals[i],
            total: 100,
            percentage: progressIntervals[i]
          });
        }
      }

      // For now, mark as ready with placeholder (will be actual video processing in Phase 3)
      await this.updateVideoStatus(videoId, 'ready');

      return { 
        success: true, 
        videoId,
      };
    } catch (error) {
      return { success: false, error: 'Failed to process video URL' };
    }
  }

  // Upload real thumbnails directly to storage
  async uploadRealThumbnails(
    videoId: string,
    userId: string, 
    thumbnails: Array<{
      position: string;
      positionPercent: number;
      frameData: { blob: Blob; width: number; height: number; };
    }>
  ): Promise<{ success: boolean; error?: string; firstThumbnailPath?: string }> {
    try {
      
      // Debug authentication context
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'User not authenticated' };
      }
      
      if (session.user.id !== userId) {
      }
      
      // Test bucket accessibility
      const { data: bucketTest, error: bucketError } = await supabase.storage
        .from('thumbnails')
        .list('', { limit: 1 });
      
      if (bucketError) {
        return { success: false, error: `Bucket access error: ${bucketError.message}` };
      }
      
      const uploadedThumbnails = [];
      
      for (const thumbnail of thumbnails) {
        const filename = `${videoId}_thumbnail_${thumbnail.position}.jpg`;
        
        
        const uploadUrl = await this.generatePresignedUrl(userId, filename, 'thumbnails');
        
        if (!uploadUrl) {
          continue;
        }
        
        
        // Test if the presigned URL is valid
        try {
          const testResponse = await fetch(uploadUrl.url, { method: 'HEAD' });
          
          if (!testResponse.ok && testResponse.status !== 404) {
          }
        } catch (urlTestError) {
        }
        
        // Upload real thumbnail image
        const uploadSuccess = await this.uploadFileWithProgress(
          new File([thumbnail.frameData.blob], filename, { type: 'image/jpeg' }),
          uploadUrl.url
        );
        
        if (uploadSuccess) {
          
          // Wait a moment for storage to sync
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the file actually exists in storage
          const { data: verifyData, error: verifyError } = await supabase.storage
            .from('thumbnails')
            .list(uploadUrl.path.split('/').slice(0, -1).join('/') || '', {
              search: uploadUrl.path.split('/').pop()
            });
          
          if (verifyError || !verifyData || verifyData.length === 0) {
            
            // Try alternative verification method - direct file access
            try {
              const { data: fileData, error: fileError } = await supabase.storage
                .from('thumbnails')
                .download(uploadUrl.path);
                
              if (fileError) {
              } else {
                uploadedThumbnails.push({
                  position: thumbnail.position,
                  path: uploadUrl.path,
                  filename: filename
                });
              }
            } catch (altError) {
            }
          } else {
            uploadedThumbnails.push({
              position: thumbnail.position,
              path: uploadUrl.path,
              filename: filename
            });
          }
          
        } else {
        }
      }
      
      if (uploadedThumbnails.length > 0) {
        return { 
          success: true, 
          firstThumbnailPath: uploadedThumbnails[0].path 
        };
      } else {
        return { success: false, error: 'No thumbnails uploaded successfully' };
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Fallback to server-side placeholder generation
  async fallbackToServerThumbnails(
    videoId: string,
    userId: string,
    storagePath: string
  ): Promise<void> {
    
    try {
      const thumbnailResult = await this.generateServerThumbnails(videoId, userId, storagePath);
      
      if (thumbnailResult.success) {
        // Edge Function will update status to 'ready' and add thumbnail_path
      } else {
        // Set status to ready without thumbnails 
        await this.updateVideoStatus(videoId, 'ready');
      }
    } catch (error) {
      // Set status to ready without thumbnails
      await this.updateVideoStatus(videoId, 'ready');
    }
  }

  // Generate server-side thumbnails using Supabase Edge Function (fallback only)
  async generateServerThumbnails(
    videoId: string, 
    userId: string, 
    storagePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {

      const { data, error } = await supabase.functions.invoke('generate-thumbnails', {
        body: {
          videoId,
          userId,
          storagePath
        }
      });

      if (error) {
        return { success: false, error: error.message || 'Edge Function failed' };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Unknown Edge Function error' };
      }

      
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const webUploadService = new WebUploadService();