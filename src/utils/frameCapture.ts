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
      
      // Ensure time is within video bounds
      const clampedTime = Math.max(0, Math.min(timeSeconds, video.duration));
      video.currentTime = clampedTime;
    };

    const handleSeeked = () => {
      console.log('🎯 Video seeked to time:', video.currentTime);
      
      try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Also create data URL for preview
            const dataUrl = canvas.toDataURL(`image/${format}`, quality);

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
        reject(new Error(`Failed to capture frame: ${error}`));
      }
    };

    const handleError = (error: any) => {
      console.error('❌ Video load error:', error);
      reject(new Error(`Failed to load video: ${error}`));
    };

    // Set up event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Start loading video
    console.log('📥 Loading video for frame capture:', videoUrl);
    video.src = videoUrl;
    video.load();
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