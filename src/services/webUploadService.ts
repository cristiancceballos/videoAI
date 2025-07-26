import { supabase } from './supabase';
import { Database } from '../types/database';
import { WebMediaAsset } from './webMediaService';
import { captureVideoFrame, FrameCaptureResult, generateStandardThumbnails } from '../utils/frameCapture';

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
      console.log('🚀 [UPLOAD DEBUG] Starting file upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        urlPrefix: presignedUrl.substring(0, 100) + '...',
        urlHost: new URL(presignedUrl).host
      });

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
            console.log('📊 [UPLOAD DEBUG] Upload progress:', progress.percentage.toFixed(1) + '%');
          }
        };

        xhr.onload = () => {
          console.log('✅ [UPLOAD DEBUG] Upload completed with status:', {
            status: xhr.status,
            statusText: xhr.statusText,
            responseType: xhr.responseType,
            responseLength: xhr.response?.length || 0,
            responseHeaders: xhr.getAllResponseHeaders(),
            fileName: file.name
          });

          if (xhr.status === 200 || xhr.status === 201) {
            console.log('✅ [UPLOAD DEBUG] Upload reported as successful for:', file.name);
            resolve(true);
          } else {
            console.error('❌ [UPLOAD DEBUG] Upload failed for:', file.name, 'with status:', xhr.status);
            console.error('❌ [UPLOAD DEBUG] Response text:', xhr.responseText);
            resolve(false);
          }
        };

        xhr.onerror = (error) => {
          console.error('💥 [UPLOAD DEBUG] Upload error occurred for:', file.name, error);
          console.error('💥 [UPLOAD DEBUG] XHR error details:', {
            status: xhr.status,
            statusText: xhr.statusText,
            readyState: xhr.readyState,
            responseText: xhr.responseText
          });
          resolve(false);
        };

        xhr.ontimeout = () => {
          console.error('⏰ [UPLOAD DEBUG] Upload timeout for:', file.name);
          resolve(false);
        };

        xhr.onabort = () => {
          console.error('🛑 [UPLOAD DEBUG] Upload aborted for:', file.name);
          resolve(false);
        };

        // Set timeout to 60 seconds
        xhr.timeout = 60000;

        console.log('📤 [UPLOAD DEBUG] Initiating XMLHttpRequest PUT for:', file.name);
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        
        // Log request headers
        console.log('📋 [UPLOAD DEBUG] Request headers set:', {
          'Content-Type': file.type,
          method: 'PUT'
        });
        
        xhr.send(file);
        console.log('🚀 [UPLOAD DEBUG] XHR request sent for:', file.name);
      });
    } catch (error) {
      console.error('💥 [UPLOAD DEBUG] Exception in uploadFileWithProgress:', error);
      console.error('💥 [UPLOAD DEBUG] File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
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
    thumbnailOption: string = 'server'
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

      // 5. Update status to processing before thumbnail generation
      console.log('🎯 [DATABASE DEBUG] Setting video status to processing...');
      await this.updateVideoStatus(videoId, 'processing');
      
      // 6. Generate real video thumbnails on client-side
      console.log('🎬 [CLIENT THUMBNAIL DEBUG] Starting client-side thumbnail generation...');
      
      try {
        console.log('🔍 [CLIENT THUMBNAIL DEBUG] Starting detailed thumbnail generation process...');
        console.log('📊 [CLIENT THUMBNAIL DEBUG] Asset details:', {
          uri: asset.uri?.substring(0, 100) + '...',
          filename: asset.filename,
          fileSize: asset.fileSize,
          duration: asset.duration,
          uriType: typeof asset.uri,
          uriValid: asset.uri?.startsWith('blob:')
        });
        
        // Test blob URL accessibility before frame extraction
        console.log('🌐 [CLIENT THUMBNAIL DEBUG] Testing blob URL accessibility...');
        try {
          const testResponse = await fetch(asset.uri, { method: 'HEAD' });
          console.log('✅ [CLIENT THUMBNAIL DEBUG] Blob URL test result:', {
            status: testResponse.status,
            ok: testResponse.ok,
            headers: Object.fromEntries(testResponse.headers.entries())
          });
          
          if (!testResponse.ok) {
            throw new Error(`Blob URL not accessible: ${testResponse.status} ${testResponse.statusText}`);
          }
        } catch (fetchError) {
          console.error('❌ [CLIENT THUMBNAIL DEBUG] Blob URL accessibility test failed:', fetchError);
          throw new Error(`Blob URL fetch failed: ${fetchError.message}`);
        }
        
        // Generate standard thumbnails from video frames
        console.log('🎬 [CLIENT THUMBNAIL DEBUG] Blob URL accessible, starting frame extraction...');
        
        // Validate and prepare duration
        const assetDuration = asset.duration;
        console.log('⏱️ [CLIENT THUMBNAIL DEBUG] Asset duration analysis:', {
          rawDuration: assetDuration,
          isNumber: typeof assetDuration === 'number',
          isFinite: Number.isFinite(assetDuration),
          isPositive: assetDuration > 0,
          durationSeconds: assetDuration
        });
        
        const startTime = Date.now();
        const thumbnails = await generateStandardThumbnails(asset.uri, assetDuration);
        const extractionTime = Date.now() - startTime;
        
        console.log('📊 [CLIENT THUMBNAIL DEBUG] Frame extraction completed:', {
          thumbnailCount: thumbnails.length,
          extractionTimeMs: extractionTime,
          positions: thumbnails.map(t => t.position)
        });
        
        if (thumbnails.length > 0) {
          console.log(`✅ [CLIENT THUMBNAIL DEBUG] Generated ${thumbnails.length} real thumbnails`);
          
          // Log thumbnail details
          thumbnails.forEach((thumb, index) => {
            console.log(`🖼️ [CLIENT THUMBNAIL DEBUG] Thumbnail ${index + 1}:`, {
              position: thumb.position,
              positionPercent: thumb.positionPercent,
              blobSize: thumb.frameData.blob.size,
              width: thumb.frameData.width,
              height: thumb.frameData.height
            });
          });
          
          // Upload real thumbnails to server
          const uploadStartTime = Date.now();
          const thumbnailResult = await this.uploadRealThumbnails(videoId, userId, thumbnails);
          const uploadTime = Date.now() - uploadStartTime;
          
          console.log('📤 [CLIENT THUMBNAIL DEBUG] Thumbnail upload completed:', {
            success: thumbnailResult.success,
            uploadTimeMs: uploadTime,
            error: thumbnailResult.error
          });
          
          if (thumbnailResult.success) {
            console.log('✅ [CLIENT THUMBNAIL DEBUG] Real thumbnails uploaded successfully');
            console.log('🔍 [PATH DEBUG] Complete path being stored in database:', {
              videoId: videoId,
              firstThumbnailPath: thumbnailResult.firstThumbnailPath,
              pathLength: thumbnailResult.firstThumbnailPath?.length || 0,
              pathParts: thumbnailResult.firstThumbnailPath?.split('/') || [],
              hasFileExtension: thumbnailResult.firstThumbnailPath?.includes('.jpg') || false
            });
            
            // Update video with first thumbnail path and set status to ready
            await this.updateVideoStatus(videoId, 'ready', thumbnailResult.firstThumbnailPath);
          } else {
            console.warn('⚠️ [CLIENT THUMBNAIL DEBUG] Real thumbnail upload failed:', thumbnailResult.error);
            // Fallback to server-side placeholder generation
            await this.fallbackToServerThumbnails(videoId, userId, uploadUrl.path);
          }
        } else {
          console.warn('⚠️ [CLIENT THUMBNAIL DEBUG] No thumbnails generated, using server fallback');
          console.log('🔍 [CLIENT THUMBNAIL DEBUG] Empty result analysis:', {
            assetUri: asset.uri?.substring(0, 50) + '...',
            assetDuration: asset.duration,
            extractionTime: extractionTime
          });
          // Fallback to server-side placeholder generation
          await this.fallbackToServerThumbnails(videoId, userId, uploadUrl.path);
        }
      } catch (error) {
        console.error('❌ [CLIENT THUMBNAIL DEBUG] Exception during client thumbnail generation:', error);
        console.error('❌ [CLIENT THUMBNAIL DEBUG] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 500) + '...',
          errorType: typeof error,
          assetUri: asset.uri?.substring(0, 50) + '...'
        });
        
        // Add specific error analysis
        if (error.message?.includes('blob')) {
          console.error('🔍 [CLIENT THUMBNAIL DEBUG] Blob URL related error detected');
        } else if (error.message?.includes('canvas')) {
          console.error('🔍 [CLIENT THUMBNAIL DEBUG] Canvas related error detected');
        } else if (error.message?.includes('video')) {
          console.error('🔍 [CLIENT THUMBNAIL DEBUG] Video element related error detected');
        } else if (error.message?.includes('timeout')) {
          console.error('🔍 [CLIENT THUMBNAIL DEBUG] Timeout related error detected');
        }
        
        // Fallback to server-side placeholder generation
        await this.fallbackToServerThumbnails(videoId, userId, uploadUrl.path);
      }
      
      console.log('✅ Video fully processed and ready!');

      // Note: Blob URL cleanup is handled by the WebVideoPreviewModal component
      // to prevent premature revocation during thumbnail generation

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

  // Upload real thumbnails directly to storage
  async uploadRealThumbnails(
    videoId: string,
    userId: string, 
    thumbnails: Array<{
      position: string;
      positionPercent: number;
      frameData: FrameCaptureResult;
    }>
  ): Promise<{ success: boolean; error?: string; firstThumbnailPath?: string }> {
    try {
      console.log('📤 [REAL THUMBNAIL DEBUG] Uploading real thumbnails to storage...');
      
      // Debug authentication context
      console.log('🔍 [AUTH DEBUG] Checking user authentication context...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔍 [AUTH DEBUG] Session details:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        providedUserId: userId,
        userIdsMatch: session?.user?.id === userId,
        sessionError: sessionError?.message
      });
      
      if (!session) {
        console.error('❌ [AUTH DEBUG] No active session found during upload');
        return { success: false, error: 'User not authenticated' };
      }
      
      if (session.user.id !== userId) {
        console.warn('⚠️ [AUTH DEBUG] Session user ID does not match provided user ID');
      }
      
      // Test bucket accessibility
      console.log('🔍 [BUCKET DEBUG] Testing thumbnails bucket accessibility...');
      const { data: bucketTest, error: bucketError } = await supabase.storage
        .from('thumbnails')
        .list('', { limit: 1 });
      
      console.log('🔍 [BUCKET DEBUG] Bucket accessibility test:', {
        canAccess: !bucketError,
        error: bucketError?.message,
        bucketExists: !!bucketTest,
        hasFiles: bucketTest?.length > 0
      });
      
      if (bucketError) {
        console.error('❌ [BUCKET DEBUG] Cannot access thumbnails bucket:', bucketError);
        return { success: false, error: `Bucket access error: ${bucketError.message}` };
      }
      
      const uploadedThumbnails = [];
      
      for (const thumbnail of thumbnails) {
        const filename = `${videoId}_thumbnail_${thumbnail.position}.jpg`;
        
        // Debug path structure before generating presigned URL
        console.log('🔍 [PATH STRUCTURE DEBUG] Analyzing path components:', {
          userId: userId,
          videoId: videoId,
          filename: filename,
          expectedPath: `${userId}/${Date.now()}_${filename}`,
          policyExpectedFormat: 'userId/timestamp_filename.jpg'
        });
        
        const uploadUrl = await this.generatePresignedUrl(userId, filename, 'thumbnails');
        
        if (!uploadUrl) {
          console.error(`❌ [REAL THUMBNAIL DEBUG] Failed to generate upload URL for ${filename}`);
          continue;
        }
        
        // Debug the actual generated path vs policy expectations
        console.log('🔍 [PATH STRUCTURE DEBUG] Generated path analysis:', {
          actualPath: uploadUrl.path,
          pathParts: uploadUrl.path.split('/'),
          firstPart: uploadUrl.path.split('/')[0], // Should match userId for policy
          userId: userId,
          pathMatchesUserId: uploadUrl.path.split('/')[0] === userId,
          bucket: 'thumbnails'
        });
        
        // Test if the presigned URL is valid
        console.log(`🔍 [PRESIGNED URL DEBUG] Testing presigned URL for ${filename}...`);
        try {
          const testResponse = await fetch(uploadUrl.url, { method: 'HEAD' });
          console.log(`🔍 [PRESIGNED URL DEBUG] URL test result:`, {
            filename: filename,
            status: testResponse.status,
            statusText: testResponse.statusText,
            ok: testResponse.ok,
            urlHost: new URL(uploadUrl.url).host
          });
          
          if (!testResponse.ok && testResponse.status !== 404) {
            console.warn(`⚠️ [PRESIGNED URL DEBUG] Presigned URL might be invalid for ${filename}: ${testResponse.status}`);
          }
        } catch (urlTestError) {
          console.error(`❌ [PRESIGNED URL DEBUG] Failed to test presigned URL for ${filename}:`, urlTestError.message);
        }
        
        console.log(`📤 [REAL THUMBNAIL DEBUG] Uploading ${filename}...`);
        console.log(`🔍 [PATH DEBUG] Upload URL details:`, {
          filename: filename,
          uploadUrlPath: uploadUrl.path,
          uploadUrlFullLength: uploadUrl.url?.length || 0
        });
        
        // Upload real thumbnail image
        const uploadSuccess = await this.uploadFileWithProgress(
          new File([thumbnail.frameData.blob], filename, { type: 'image/jpeg' }),
          uploadUrl.url
        );
        
        if (uploadSuccess) {
          console.log(`✅ [REAL THUMBNAIL DEBUG] Upload reported successful for ${filename}`);
          
          // Wait a moment for storage to sync
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the file actually exists in storage
          console.log(`🔍 [UPLOAD VERIFICATION] Checking if file exists in storage: ${uploadUrl.path}`);
          const { data: verifyData, error: verifyError } = await supabase.storage
            .from('thumbnails')
            .list(uploadUrl.path.split('/').slice(0, -1).join('/') || '', {
              search: uploadUrl.path.split('/').pop()
            });
          
          console.log(`🔍 [UPLOAD VERIFICATION] Storage verification details:`, {
            searchPath: uploadUrl.path.split('/').slice(0, -1).join('/') || '',
            searchFile: uploadUrl.path.split('/').pop(),
            verifyError: verifyError,
            filesFound: verifyData?.length || 0,
            actualFiles: verifyData?.map(f => f.name) || []
          });
          
          if (verifyError || !verifyData || verifyData.length === 0) {
            console.error(`❌ [UPLOAD VERIFICATION] File not found in storage after upload: ${uploadUrl.path}`);
            console.error(`❌ [UPLOAD VERIFICATION] Error:`, verifyError);
            
            // Try alternative verification method - direct file access
            console.log(`🔍 [ALTERNATIVE VERIFICATION] Trying direct file access...`);
            try {
              const { data: fileData, error: fileError } = await supabase.storage
                .from('thumbnails')
                .download(uploadUrl.path);
                
              if (fileError) {
                console.error(`❌ [ALTERNATIVE VERIFICATION] Direct access also failed:`, fileError);
              } else {
                console.log(`✅ [ALTERNATIVE VERIFICATION] File accessible via direct download`);
                uploadedThumbnails.push({
                  position: thumbnail.position,
                  path: uploadUrl.path,
                  filename: filename
                });
              }
            } catch (altError) {
              console.error(`❌ [ALTERNATIVE VERIFICATION] Exception during direct access:`, altError);
            }
          } else {
            console.log(`✅ [UPLOAD VERIFICATION] File confirmed in storage: ${filename}`);
            uploadedThumbnails.push({
              position: thumbnail.position,
              path: uploadUrl.path,
              filename: filename
            });
          }
          
          console.log(`🔍 [PATH DEBUG] Stored path for ${filename}:`, uploadUrl.path);
        } else {
          console.error(`❌ [REAL THUMBNAIL DEBUG] Failed to upload ${filename}`);
        }
      }
      
      if (uploadedThumbnails.length > 0) {
        console.log(`🎉 [REAL THUMBNAIL DEBUG] Successfully uploaded ${uploadedThumbnails.length} real thumbnails`);
        console.log(`🔍 [PATH DEBUG] Returning first thumbnail path:`, {
          firstThumbnailPath: uploadedThumbnails[0].path,
          allPaths: uploadedThumbnails.map(t => ({ position: t.position, path: t.path }))
        });
        return { 
          success: true, 
          firstThumbnailPath: uploadedThumbnails[0].path 
        };
      } else {
        return { success: false, error: 'No thumbnails uploaded successfully' };
      }
      
    } catch (error) {
      console.error('💥 [REAL THUMBNAIL DEBUG] Exception uploading real thumbnails:', error);
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
    console.log('🔄 [FALLBACK DEBUG] Using server-side placeholder generation as fallback...');
    
    try {
      const thumbnailResult = await this.generateServerThumbnails(videoId, userId, storagePath);
      
      if (thumbnailResult.success) {
        console.log('✅ [FALLBACK DEBUG] Server placeholder generation completed successfully');
        // Edge Function will update status to 'ready' and add thumbnail_path
      } else {
        console.warn('⚠️ [FALLBACK DEBUG] Server placeholder generation failed:', thumbnailResult.error);
        // Set status to ready without thumbnails 
        await this.updateVideoStatus(videoId, 'ready');
      }
    } catch (error) {
      console.error('❌ [FALLBACK DEBUG] Exception during server placeholder generation:', error);
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
      console.log('🚀 [EDGE FUNCTION DEBUG] Calling generate-thumbnails Edge Function...');
      console.log('📋 [EDGE FUNCTION DEBUG] Parameters:', { videoId, userId, storagePath });

      const { data, error } = await supabase.functions.invoke('generate-thumbnails', {
        body: {
          videoId,
          userId,
          storagePath
        }
      });

      if (error) {
        console.error('❌ [EDGE FUNCTION DEBUG] Edge Function error:', error);
        return { success: false, error: error.message || 'Edge Function failed' };
      }

      if (!data || !data.success) {
        console.error('❌ [EDGE FUNCTION DEBUG] Edge Function returned unsuccessful result:', data);
        return { success: false, error: data?.error || 'Unknown Edge Function error' };
      }

      console.log('✅ [EDGE FUNCTION DEBUG] Edge Function completed successfully');
      console.log('🖼️ [EDGE FUNCTION DEBUG] Generated thumbnails:', data.thumbnails?.length || 0);
      
      return { success: true };

    } catch (error) {
      console.error('💥 [EDGE FUNCTION DEBUG] Exception calling Edge Function:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const webUploadService = new WebUploadService();