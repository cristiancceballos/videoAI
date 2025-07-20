import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export interface MediaAsset {
  uri: string;
  type: 'video';
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  filename?: string;
}

class MediaService {
  // Request permissions for media library access
  async requestMediaLibraryPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting media library permissions:', error);
      return false;
    }
  }

  // Request permissions for camera access
  async requestCameraPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }

  // Pick video from gallery
  async pickVideoFromGallery(): Promise<MediaAsset | null> {
    try {
      // Check permissions
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload videos.'
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 1800, // 30 minutes max
      });

      if (result.canceled || !result.assets?.length) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'video',
        duration: asset.duration || undefined,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize || undefined,
        filename: (asset as any).fileName || `video_${Date.now()}.mp4`,
      };
    } catch (error) {
      console.error('Error picking video from gallery:', error);
      Alert.alert('Error', 'Failed to pick video from gallery');
      return null;
    }
  }

  // Record video with camera
  async recordVideoWithCamera(): Promise<MediaAsset | null> {
    try {
      // Check permissions
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please allow camera access to record videos.'
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 1800, // 30 minutes max
      });

      if (result.canceled || !result.assets?.length) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'video',
        duration: asset.duration || undefined,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize || undefined,
        filename: (asset as any).fileName || `recorded_video_${Date.now()}.mp4`,
      };
    } catch (error) {
      console.error('Error recording video with camera:', error);
      Alert.alert('Error', 'Failed to record video');
      return null;
    }
  }

  // Get videos from media library (for custom gallery)
  async getVideosFromLibrary(limit: number = 50): Promise<MediaLibrary.Asset[]> {
    try {
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        return [];
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: limit,
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      return media.assets;
    } catch (error) {
      console.error('Error getting videos from library:', error);
      return [];
    }
  }

  // Format file size for display
  formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Format duration for display
  formatDuration(seconds?: number): string {
    if (!seconds) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Check if file is too large
  isFileTooLarge(fileSize?: number, maxSizeMB: number = 100): boolean {
    if (!fileSize) return false;
    return fileSize > maxSizeMB * 1024 * 1024;
  }

  // Check if duration is too long
  isDurationTooLong(duration?: number, maxMinutes: number = 30): boolean {
    if (!duration) return false;
    return duration > maxMinutes * 60;
  }
}

export const mediaService = new MediaService();