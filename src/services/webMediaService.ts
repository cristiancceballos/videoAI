import { Alert, Platform } from 'react-native';

export interface WebMediaAsset {
  uri: string;
  type: 'video';
  file: File;
  duration?: number;
  width?: number;
  height?: number;
  fileSize: number;
  filename: string;
}

class WebMediaService {
  // Create a hidden file input for video selection
  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.display = 'none';
    input.capture = 'environment'; // Use back camera on mobile
    document.body.appendChild(input);
    return input;
  }

  // Pick video from device (works on both mobile and desktop browsers)
  async pickVideoFromDevice(): Promise<WebMediaAsset | null> {
    return new Promise((resolve) => {
      try {
        const input = this.createFileInput();
        
        input.onchange = async (event) => {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];
          
          if (!file) {
            resolve(null);
            return;
          }

          // Validate file type
          if (!file.type.startsWith('video/')) {
            Alert.alert('Error', 'Please select a video file');
            resolve(null);
            return;
          }

          // Validate file size (100MB limit)
          const maxSize = 100 * 1024 * 1024; // 100MB
          if (file.size > maxSize) {
            Alert.alert('Error', 'Video file is too large (max 100MB)');
            resolve(null);
            return;
          }

          try {
            // Create object URL for the file
            const uri = URL.createObjectURL(file);
            
            // Get video metadata
            const metadata = await this.getVideoMetadata(uri);
            
            const asset: WebMediaAsset = {
              uri,
              type: 'video',
              file,
              fileSize: file.size,
              filename: file.name || `video_${Date.now()}.mp4`,
              duration: metadata.duration,
              width: metadata.width,
              height: metadata.height,
            };

            resolve(asset);
          } catch (error) {
            console.error('Error processing video file:', error);
            Alert.alert('Error', 'Failed to process video file');
            resolve(null);
          } finally {
            // Clean up
            document.body.removeChild(input);
          }
        };

        input.oncancel = () => {
          document.body.removeChild(input);
          resolve(null);
        };

        // Trigger file picker
        input.click();
      } catch (error) {
        console.error('Error opening file picker:', error);
        Alert.alert('Error', 'Failed to open file picker');
        resolve(null);
      }
    });
  }

  // Record video using device camera (web API)
  async recordVideoWithCamera(): Promise<WebMediaAsset | null> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Alert.alert(
          'Camera Not Supported', 
          'Camera recording is not supported on this device. Please use "Choose File" instead.'
        );
        return null;
      }

      // For now, show alternative since MediaRecorder setup is complex
      Alert.alert(
        'Camera Recording',
        'Camera recording will be available in the next update. For now, please use "Choose File" to select a video.',
        [
          {
            text: 'Choose File Instead',
            onPress: () => this.pickVideoFromDevice(),
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      
      return null;
    } catch (error) {
      console.error('Camera access error:', error);
      Alert.alert('Error', 'Failed to access camera');
      return null;
    }
  }

  // Get video metadata
  private getVideoMetadata(videoUrl: string): Promise<{ duration?: number; width?: number; height?: number }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
        URL.revokeObjectURL(videoUrl);
      };

      video.onerror = () => {
        console.error('Error loading video metadata');
        resolve({});
        URL.revokeObjectURL(videoUrl);
      };

      video.src = videoUrl;
    });
  }

  // Upload file using fetch (compatible with our existing upload service)
  async uploadFile(
    file: File, 
    presignedUrl: string,
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
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
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Upload error:', error);
      return false;
    }
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format duration for display
  formatDuration(seconds?: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Check if file is too large
  isFileTooLarge(fileSize: number, maxSizeMB: number = 100): boolean {
    return fileSize > maxSizeMB * 1024 * 1024;
  }

  // Check if duration is too long
  isDurationTooLong(duration?: number, maxMinutes: number = 30): boolean {
    if (!duration) return false;
    return duration > maxMinutes * 60;
  }

  // Detect if running on mobile device
  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}

export const webMediaService = new WebMediaService();