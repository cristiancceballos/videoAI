/**
 * Frame Capture Utility
 * Captures video frames using HTML5 video element and canvas
 */

export interface FrameCaptureOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-1 for JPEG quality
  format?: 'jpeg' | 'png';
}

export interface FrameCaptureResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Captures a frame from a video at a specific time
 * @param videoUrl - URL of the video to capture from
 * @param timeSeconds - Time position in seconds to capture
 * @param options - Capture options (size, quality, format)
 * @returns Promise that resolves to captured frame data
 */
export async function captureVideoFrame(
  videoUrl: string,
  timeSeconds: number = 0,
  options: FrameCaptureOptions = {}
): Promise<FrameCaptureResult> {
  const {
    width = 400,
    height = 225, // 16:9 aspect ratio
    quality = 0.8,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    // Set up timeout for the entire operation (15 seconds)
    const operationTimeout = setTimeout(() => {
      console.error('❌ Frame capture timed out after 15 seconds');
      video.remove();
      reject(new Error('Frame capture timed out. Please try again.'));
    }, 15000);
    // Create video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas 2D context'));
      return;
    }

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Handle video load and seek
    const handleLoadedMetadata = () => {
      console.log('📹 Video metadata loaded, duration:', video.duration);
      
      if (!video.duration || video.duration === 0) {
        clearTimeout(operationTimeout);
        video.remove();
        reject(new Error('Video duration is invalid. Please check the video file.'));
        return;
      }
      
      // Ensure time is within video bounds
      const clampedTime = Math.max(0, Math.min(timeSeconds, video.duration));
      console.log('🎯 Setting video time to:', clampedTime);
      video.currentTime = clampedTime;
    };

    const handleSeeked = () => {
      console.log('🎯 Video seeked to time:', video.currentTime);
      
      try {
        // Verify video dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          clearTimeout(operationTimeout);
          video.remove();
          reject(new Error('Video has no valid dimensions. The video may be corrupted.'));
          return;
        }
        
        console.log('🖼️ Drawing video frame:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          canvasWidth: width,
          canvasHeight: height
        });
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            clearTimeout(operationTimeout);
            
            if (!blob) {
              video.remove();
              reject(new Error('Failed to create image from video frame. Please try again.'));
              return;
            }

            // Also create data URL for preview
            const dataUrl = canvas.toDataURL(`image/${format}`, quality);
            
            console.log('✅ Frame captured successfully:', {
              blobSize: blob.size,
              format,
              quality
            });

            resolve({
              blob,
              dataUrl,
              width,
              height
            });

            // Cleanup
            video.remove();
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        clearTimeout(operationTimeout);
        video.remove();
        reject(new Error(`Failed to capture frame: ${error}`));
      }
    };

    const handleError = (error: any) => {
      clearTimeout(operationTimeout);
      console.error('❌ [FRAME CAPTURE DEBUG] Video load error:', error);
      console.error('❌ [FRAME CAPTURE DEBUG] Video URL:', videoUrl?.substring(0, 100) + '...');
      
      if (error.target?.error) {
        console.error('❌ [FRAME CAPTURE DEBUG] Media error code:', error.target.error.code);
        console.error('❌ [FRAME CAPTURE DEBUG] Media error message:', error.target.error.message);
      }
      
      video.remove();
      
      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to load video for thumbnail generation.';
      
      if (error.target?.error?.code === 4) {
        errorMessage = 'Video format not supported. Please try a different video format (MP4, WebM, or MOV recommended).';
        console.error('❌ [FRAME CAPTURE DEBUG] MEDIA_ELEMENT_ERROR: Format not supported');
      } else if (error.target?.error?.code === 3) {
        errorMessage = 'Video file is corrupted or incomplete. Please try re-uploading the video.';
        console.error('❌ [FRAME CAPTURE DEBUG] MEDIA_ELEMENT_ERROR: Decode error');
      } else if (error.target?.error?.code === 2) {
        errorMessage = 'Network error while loading video. Please check your connection and try again.';
        console.error('❌ [FRAME CAPTURE DEBUG] MEDIA_ELEMENT_ERROR: Network error');
      } else if (error.target?.error?.code === 1) {
        errorMessage = 'Video loading was aborted. Please try again.';
        console.error('❌ [FRAME CAPTURE DEBUG] MEDIA_ELEMENT_ERROR: Aborted');
      } else if (videoUrl?.startsWith('blob:')) {
        errorMessage = 'Video blob URL is no longer valid. Please try uploading the video again.';
        console.error('❌ [FRAME CAPTURE DEBUG] Blob URL may have been revoked prematurely');
      }
      
      reject(new Error(errorMessage));
    };

    // Set up event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Start loading video
    console.log('📥 Loading video for frame capture:', videoUrl.substring(0, 50) + '...');
    
    try {
      video.src = videoUrl;
      video.load();
    } catch (error) {
      clearTimeout(operationTimeout);
      video.remove();
      reject(new Error(`Failed to initialize video: ${error}`));
    }
  });
}

/**
 * Captures multiple frames from a video at different time positions
 * @param videoUrl - URL of the video to capture from
 * @param timePositions - Array of time positions in seconds
 * @param options - Capture options
 * @returns Promise that resolves to array of captured frames
 */
export async function captureMultipleFrames(
  videoUrl: string,
  timePositions: number[],
  options: FrameCaptureOptions = {}
): Promise<FrameCaptureResult[]> {
  const results: FrameCaptureResult[] = [];
  
  for (const time of timePositions) {
    try {
      const frame = await captureVideoFrame(videoUrl, time, options);
      results.push(frame);
    } catch (error) {
      console.error(`Failed to capture frame at ${time}s:`, error);
      // Continue with other frames even if one fails
    }
  }
  
  return results;
}

/**
 * Generates a filename for a thumbnail based on video info and timestamp
 * @param videoId - Video ID
 * @param timeSeconds - Time position of the frame
 * @param format - Image format
 * @returns Generated filename
 */
export function generateThumbnailFilename(
  videoId: string,
  timeSeconds: number,
  format: 'jpeg' | 'png' = 'jpeg'
): string {
  const timestamp = Math.floor(timeSeconds * 1000); // Convert to milliseconds
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  return `${videoId}_thumb_${timestamp}.${extension}`;
}

/**
 * Validates if the browser supports frame capture
 * @returns Boolean indicating support
 */
export function isFrameCaptureSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    
    return !!(ctx && video.canPlayType && canvas.toBlob);
  } catch {
    return false;
  }
}

/**
 * Generates standard thumbnail set for video upload
 * Captures frames at 0%, 25%, 50%, 75% of video duration
 * @param videoUrl - URL of the video to capture from
 * @param options - Capture options
 * @returns Promise that resolves to array of thumbnail data with position labels
 */
export async function generateStandardThumbnails(
  videoUrl: string,
  options: FrameCaptureOptions = {}
): Promise<Array<{
  position: string;
  positionPercent: number;
  frameData: FrameCaptureResult;
}>> {
  console.log('🎬 [THUMBNAIL GENERATION] Starting standard thumbnail generation');
  
  // First, we need to get the video duration
  const videoDuration = await getVideoDuration(videoUrl);
  console.log('📊 [THUMBNAIL GENERATION] Video duration:', videoDuration);
  
  // Calculate time positions for each thumbnail
  const positions = [
    { percent: 0, label: '0pct' },
    { percent: 0.25, label: '25pct' },
    { percent: 0.5, label: '50pct' }, 
    { percent: 0.75, label: '75pct' }
  ];
  
  const timePositions = positions.map(pos => pos.percent * videoDuration);
  console.log('⏰ [THUMBNAIL GENERATION] Time positions:', timePositions);
  
  const thumbnails = [];
  
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i];
    const timeSeconds = timePositions[i];
    
    try {
      console.log(`🖼️ [THUMBNAIL GENERATION] Capturing ${position.label} (${timeSeconds.toFixed(2)}s)`);
      
      const frameData = await captureVideoFrame(videoUrl, timeSeconds, {
        width: 400,
        height: 225, // 16:9 aspect ratio for thumbnails
        quality: 0.8,
        format: 'jpeg',
        ...options
      });
      
      thumbnails.push({
        position: position.label,
        positionPercent: position.percent,
        frameData
      });
      
      console.log(`✅ [THUMBNAIL GENERATION] Successfully captured ${position.label}`);
      
    } catch (error) {
      console.error(`❌ [THUMBNAIL GENERATION] Failed to capture ${position.label}:`, error);
      // Continue with other thumbnails even if one fails
    }
  }
  
  console.log(`🎉 [THUMBNAIL GENERATION] Generated ${thumbnails.length}/4 thumbnails`);
  return thumbnails;
}

/**
 * Gets the duration of a video without loading the full video
 * @param videoUrl - URL of the video
 * @returns Promise that resolves to video duration in seconds
 */
async function getVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    
    const timeout = setTimeout(() => {
      video.remove();
      reject(new Error('Timeout getting video duration'));
    }, 10000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      const duration = video.duration;
      video.remove();
      
      if (!duration || duration === 0) {
        reject(new Error('Invalid video duration'));
      } else {
        resolve(duration);
      }
    });
    
    video.addEventListener('error', (error) => {
      clearTimeout(timeout);
      video.remove();
      reject(new Error('Failed to load video for duration check'));
    });
    
    video.src = videoUrl;
    video.load();
  });
}