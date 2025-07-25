import { supabase } from './supabase';
import { Database } from '../types/database';
import { WebMediaAsset } from './webMediaService';
import { captureVideoFrame, FrameCaptureResult } from '../utils/frameCapture';

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
        console.error('Error generating presigned URL:', error);
        return null;
      }

      return {
        url: data.signedUrl,
        path: data.path,
      };
    } catch (error) {
      console.error('Upload service error:', error);
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
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: (event.loaded / event.total) * 100,
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(true);
          } else {
            console.error('Upload failed with status:', xhr.status);
            resolve(false);
          }
        };

        xhr.onerror = () => {
          console.error('Upload error occurred');
          resolve(false);
        };

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('File upload error:', error);
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
        console.error('No active session found');
        return null;
      }
      
      console.log('Session user ID:', session.user.id);
      console.log('Provided user ID:', userId);
      
      type VideoInsert = Database['public']['Tables']['videos']['Insert'];
      
      const videoData: VideoInsert = {
        user_id: userId,
        title: title || asset.filename,
        storage_path: storagePath,
        status: 'uploading',
        file_size: Math.round(asset.fileSize), // Ensure integer
        duration: asset.duration ? Math.round(asset.duration) : null, // Convert to integer seconds
        source_type: sourceType,
        source_url: sourceUrl,
        original_filename: asset.filename,
        width: asset.width ? Math.round(asset.width) : null, // Ensure integer
        height: asset.height ? Math.round(asset.height) : null, // Ensure integer
      };

      console.log('Attempting to insert video data:', videoData);

      const { data, error } = await supabase
        .from('videos')
        .insert(videoData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating video record:', error);
        
        // Provide user-friendly error messages
        if (error.code === '22P02') {
          console.error('Data type error - likely duration/dimensions format issue');
        } else if (error.code === '23505') {
          console.error('Duplicate entry error');
        } else if (error.message?.includes('row-level security')) {
          console.error('Authentication/permissions error');
        }
        
        return null;
      }

      console.log('Video record created successfully:', data);
      console.log('Video will appear in home feed with ID:', data.id);
      return data.id;
    } catch (error) {
      console.error('Database exception:', error);
      
      // Log additional context for debugging
      console.error('Video data that failed:', {
        title: title || asset.filename,
        fileSize: asset.fileSize,
        duration: asset.duration,
        sourceType
      });
      
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
      console.log(`📊 [DATABASE DEBUG] Updating video ${videoId} status to: ${status}`);
      
      const updateData: any = { status };
      if (thumbnailPath) {
        updateData.thumbnail_path = thumbnailPath;
        console.log(`🖼️ [DATABASE DEBUG] Adding thumbnail path to update:`, thumbnailPath);
      } else if (status === 'ready') {
        console.log(`⚠️ [DATABASE DEBUG] Setting status to ready but no thumbnail path provided`);
      }

      console.log(`💾 [DATABASE DEBUG] Update data:`, updateData);

      const { data, error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId)
        .select('*');

      if (error) {
        console.error('❌ [DATABASE DEBUG] Error updating video status:', error);
        return false;
      }

      console.log('✅ [DATABASE DEBUG] Video status updated successfully in database:');
      console.log('📄 [DATABASE DEBUG] Updated record:', JSON.stringify(data[0], null, 2));
      
      // Specifically log thumbnail information
      if (data[0] && data[0].thumbnail_path) {
        console.log(`🎯 [DATABASE DEBUG] Thumbnail path successfully stored: ${data[0].thumbnail_path}`);
      } else if (status === 'ready') {
        console.log(`⚠️ [DATABASE DEBUG] Video marked as ready but no thumbnail_path in database`);
      }
      
      return true;
    } catch (error) {
      console.error('💥 [DATABASE DEBUG] Exception updating video status:', error);
      return false;
    }
  }

  // Generate first frame thumbnail
  async generateFirstFrameThumbnail(
    videoUrl: string,
    userId: string,
    videoId: string
  ): Promise<string | null> {
    try {
      console.log('🖼️ Generating first frame thumbnail for video:', videoId);
      
      // Capture first frame (at time 0)
      const frameData = await captureVideoFrame(videoUrl, 0, {
        width: 400,
        height: 225, // 16:9 aspect ratio
        quality: 0.8,
        format: 'jpeg'
      });
      
      // Generate thumbnail filename
      const thumbnailFilename = `${videoId}_thumbnail.jpg`;
      
      // Generate presigned URL for thumbnail upload
      const uploadUrl = await this.generatePresignedUrl(userId, thumbnailFilename, 'thumbnails');
      if (!uploadUrl) {
        console.error('❌ Failed to generate presigned URL for thumbnail');
        return null;
      }
      
      // Upload thumbnail blob
      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<boolean>((resolve) => {
        xhr.onload = () => resolve(xhr.status === 200);
        xhr.onerror = () => resolve(false);
        xhr.open('PUT', uploadUrl.url);
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.send(frameData.blob);
      });
      
      const uploadSuccess = await uploadPromise;
      if (!uploadSuccess) {
        console.error('❌ Failed to upload thumbnail to storage');
        return null;
      }
      
      console.log('🎉 [FIRST FRAME DEBUG] First frame thumbnail generated and uploaded successfully!');
      console.log('📍 [FIRST FRAME DEBUG] Final thumbnail path:', uploadUrl.path);
      return uploadUrl.path;
    } catch (error) {
      console.error('💥 [FIRST FRAME DEBUG] Failed to generate first frame thumbnail:', error);
      if (error instanceof Error) {
        console.error('💥 [FIRST FRAME DEBUG] Error message:', error.message);
        console.error('💥 [FIRST FRAME DEBUG] Error stack:', error.stack);
      }
      return null;
    }
  }

  // Upload device video (complete flow for web)
  async uploadWebVideo(
    asset: WebMediaAsset,
    userId: string,
    title: string,
    onProgress?: (progress: UploadProgress) => void,
    thumbnailData?: { frameData: FrameCaptureResult; timeSeconds: number } | null,
    generateFirstFrame: boolean = false
  ): Promise<UploadResult> {
    try {
      // 1. Validate video file
      const validation = this.validateVideoFile(asset);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Generate presigned URL
      console.log('Generating presigned URL for bucket: videos, user:', userId, 'filename:', asset.filename);
      const uploadUrl = await this.generatePresignedUrl(userId, asset.filename);
      if (!uploadUrl) {
        return { success: false, error: 'Failed to generate upload URL' };
      }
      console.log('Presigned URL generated:', { url: '***', path: uploadUrl.path });

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

      // 5. Handle thumbnail generation
      let thumbnailPath: string | null = null;
      
      if (generateFirstFrame) {
        console.log('🖼️ Generating first frame thumbnail...');
        thumbnailPath = await this.generateFirstFrameThumbnail(asset.uri, userId, videoId);
        if (!thumbnailPath) {
          console.warn('⚠️ First frame thumbnail generation failed, continuing without thumbnail');
        }
      } else if (thumbnailData) {
        console.log('🖼️ Uploading custom thumbnail...');
        thumbnailPath = await this.uploadCustomThumbnail(thumbnailData, userId, videoId);
        if (!thumbnailPath) {
          console.warn('⚠️ Custom thumbnail upload failed, continuing without thumbnail');
        }
      }
      
      // 6. Update status to ready with thumbnail path
      console.log('🎯 Updating video status to ready...');
      const statusUpdated = await this.updateVideoStatus(videoId, 'ready', thumbnailPath || undefined);
      
      if (!statusUpdated) {
        console.error('❌ Failed to update video status to ready');
        return { success: false, error: 'Failed to finalize video status' };
      }
      
      console.log('✅ Video fully processed and ready!');

      // 7. Clean up object URL
      URL.revokeObjectURL(asset.uri);

      return { success: true, videoId };
    } catch (error) {
      console.error('Upload web video error:', error);
      return { success: false, error: 'Unexpected error during upload' };
    }
  }

  // Upload custom thumbnail
  async uploadCustomThumbnail(
    thumbnailData: { frameData: FrameCaptureResult; timeSeconds: number },
    userId: string,
    videoId: string
  ): Promise<string | null> {
    try {
      console.log('🖼️ Uploading custom thumbnail for video:', videoId, 'at time:', thumbnailData.timeSeconds);
      
      // Generate thumbnail filename with timestamp
      const timestamp = Math.floor(thumbnailData.timeSeconds * 1000);
      const thumbnailFilename = `${videoId}_custom_${timestamp}.jpg`;
      
      // Generate presigned URL for thumbnail upload
      const uploadUrl = await this.generatePresignedUrl(userId, thumbnailFilename, 'thumbnails');
      if (!uploadUrl) {
        console.error('❌ Failed to generate presigned URL for custom thumbnail');
        return null;
      }
      
      // Upload thumbnail blob
      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<boolean>((resolve) => {
        xhr.onload = () => resolve(xhr.status === 200);
        xhr.onerror = () => resolve(false);
        xhr.open('PUT', uploadUrl.url);
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.send(thumbnailData.frameData.blob);
      });
      
      const uploadSuccess = await uploadPromise;
      if (!uploadSuccess) {
        console.error('❌ Failed to upload custom thumbnail to storage');
        return null;
      }
      
      console.log('✅ Custom thumbnail uploaded successfully');
      return uploadUrl.path;
    } catch (error) {
      console.error('❌ Error uploading custom thumbnail:', error);
      return null;
    }
  }

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
      console.error('URL upload error:', error);
      return { success: false, error: 'Failed to process video URL' };
    }
  }
}

export const webUploadService = new WebUploadService();