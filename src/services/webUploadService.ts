import { supabase } from './supabase';
import { Database } from '../types/database';
import { WebMediaAsset } from './webMediaService';

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
    bucket: 'videos' = 'videos'
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
    title?: string,
    tags?: string[]
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
        user_tags: tags || [], // Save user tags to user_tags column
        ai_tags: [], // Initialize empty AI tags
        tags: tags || [], // Set merged tags (initially just user tags)
      };

      // Insert video data

      const { data, error } = await supabase
        .from('videos')
        .insert(videoData)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create video record:', error);
        
        // Provide user-friendly error messages
        if (error.code === '22P02') {
          console.error('Database type mismatch error');
        } else if (error.code === '23505') {
          console.error('Duplicate video record error');
        } else if (error.message?.includes('row-level security')) {
          console.error('Row-level security error - user may not be authenticated');
        }
        
        return null;
      }

      // Video record created
      return data.id;
    } catch (error) {
      console.error('Unexpected error creating video record:', error);
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
        console.error('Failed to update video status:', error);
        return false;
      }

      // Video status updated successfully
      
      return true;
    } catch (error) {
      console.error('Unexpected error updating video status:', error);
      return false;
    }
  }

  // First frame thumbnail generation moved to server-side FFmpeg

  // Upload device video (complete flow for web)
  async uploadWebVideo(
    asset: WebMediaAsset,
    userId: string,
    title: string,
    onProgress?: (progress: UploadProgress) => void,
    tags?: string[]
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
        title,
        tags
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

      // 5. Mark video as ready (video is playable, thumbnail will be processed by Bunny)
      await this.updateVideoStatus(videoId, 'ready');

      // Note: Thumbnail generation is handled by Bunny.net after upload
      // The video will have thumb_status: 'pending' until Bunny processes it

      // 6. Trigger AI processing (fire and forget)
      this.triggerAIProcessing(videoId, userId, uploadUrl.path, title).catch(error => {
        console.error('AI processing trigger failed:', error);
        // Don't fail the upload if AI processing fails
      });

      return { success: true, videoId };
    } catch (error) {
      return { success: false, error: 'Unexpected error during upload' };
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

  // Trigger AI processing for a video
  private async triggerAIProcessing(
    videoId: string,
    userId: string,
    storagePath: string,
    videoTitle?: string
  ): Promise<void> {
    try {
      // Create a signed URL for private storage access
      const { data, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (urlError || !data?.signedUrl) {
        console.error('Failed to create signed URL for AI processing:', urlError);
        return;
      }

      // For now, we'll pass the video URL directly
      // In production with videos > 25MB, Trigger.dev would extract audio first
      const audioUrl = data.signedUrl;

      // Call the Edge Function
      const { data: functionData, error } = await supabase.functions.invoke('ai-processor', {
        body: {
          videoId,
          userId,
          audioUrl,
          videoTitle
        }
      });

      if (error) {
        console.error('Edge function error:', error);
      } else {
        console.log('AI processing started for video:', videoId);
      }
    } catch (error) {
      console.error('Failed to trigger AI processing:', error);
    }
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



}

export const webUploadService = new WebUploadService();