import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { Database } from '../types/database';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface VideoMetadata {
  duration?: number;
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: string;
  filename: string;
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

class UploadService {
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

  // Upload file using presigned URL with progress tracking
  async uploadFileWithProgress(
    fileUri: string,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<boolean> {
    try {
      const uploadOptions: FileSystem.FileSystemUploadOptions = {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      };

      if (onProgress) {
        const downloadProgressCallback = (progress: any) => {
          onProgress({
            loaded: progress.totalBytesSent,
            total: progress.totalBytesExpectedToSend,
            percentage: (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100,
          });
        };

        const result = await FileSystem.uploadAsync(
          presignedUrl,
          fileUri,
          {
            ...uploadOptions,
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          }
        );

        return result.status === 200;
      } else {
        const result = await FileSystem.uploadAsync(presignedUrl, fileUri, uploadOptions);
        return result.status === 200;
      }
    } catch (error) {
      console.error('File upload error:', error);
      return false;
    }
  }

  // Get video metadata from file
  async getVideoMetadata(fileUri: string): Promise<VideoMetadata | null> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        return null;
      }

      const filename = fileUri.split('/').pop() || 'video.mp4';
      const mimeType = this.getMimeTypeFromExtension(filename);

      return {
        fileSize: fileInfo.size || 0,
        filename,
        mimeType,
        // Note: For video duration and dimensions, we'd need expo-av
        // This will be implemented in the component that uses expo-av
      };
    } catch (error) {
      console.error('Error getting video metadata:', error);
      return null;
    }
  }

  // Create video record in database
  async createVideoRecord(
    userId: string,
    metadata: VideoMetadata,
    storagePath: string,
    sourceType: 'device' | 'youtube' | 'tiktok',
    sourceUrl?: string,
    title?: string
  ): Promise<string | null> {
    try {
      type VideoInsert = Database['public']['Tables']['videos']['Insert'];
      
      const videoData: VideoInsert = {
        user_id: userId,
        title: title || metadata.filename,
        storage_path: storagePath,
        status: 'uploading',
        thumb_status: 'pending', // Set thumbnail status to pending for Bunny processing
        file_size: metadata.fileSize,
        duration: metadata.duration,
        source_type: sourceType,
        source_url: sourceUrl,
        original_filename: metadata.filename,
        width: metadata.width,
        height: metadata.height,
      };

      const { data, error } = await supabase
        .from('videos')
        .insert(videoData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating video record:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Database error:', error);
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
      const updateData: any = { status };
      if (thumbnailPath) {
        updateData.thumbnail_path = thumbnailPath;
      }

      const { error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId);

      return !error;
    } catch (error) {
      console.error('Error updating video status:', error);
      return false;
    }
  }

  // Upload device video (complete flow)
  async uploadDeviceVideo(
    fileUri: string,
    userId: string,
    title: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // 1. Get video metadata
      const metadata = await this.getVideoMetadata(fileUri);
      if (!metadata) {
        return { success: false, error: 'Failed to read video metadata' };
      }

      // 2. Validate video file
      const validation = this.validateVideoFile(metadata);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 3. Generate presigned URL
      const uploadUrl = await this.generatePresignedUrl(userId, metadata.filename);
      if (!uploadUrl) {
        return { success: false, error: 'Failed to generate upload URL' };
      }

      // 4. Create video record in database
      const videoId = await this.createVideoRecord(
        userId,
        metadata,
        uploadUrl.path,
        'device',
        undefined,
        title
      );

      if (!videoId) {
        return { success: false, error: 'Failed to create video record' };
      }

      // 5. Upload file
      const uploadSuccess = await this.uploadFileWithProgress(
        fileUri,
        uploadUrl.url,
        onProgress
      );

      if (!uploadSuccess) {
        // Update status to error
        await this.updateVideoStatus(videoId, 'error');
        return { success: false, error: 'File upload failed' };
      }

      // 6. Update status to ready (for now, will be 'processing' in Phase 3)
      await this.updateVideoStatus(videoId, 'ready');

      return { success: true, videoId };
    } catch (error) {
      console.error('Upload device video error:', error);
      return { success: false, error: 'Unexpected error during upload' };
    }
  }

  // Validate video file
  private validateVideoFile(metadata: VideoMetadata): { valid: boolean; error?: string } {
    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (metadata.fileSize > maxSize) {
      return { valid: false, error: 'Video file is too large (max 100MB)' };
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
    if (!allowedTypes.includes(metadata.mimeType)) {
      return { valid: false, error: 'Video format not supported' };
    }

    return { valid: true };
  }

  // Get MIME type from file extension
  private getMimeTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/avi',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
    };
    return mimeTypes[ext || ''] || 'video/mp4';
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
}

export const uploadService = new UploadService();