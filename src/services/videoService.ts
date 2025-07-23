import { supabase } from './supabase';
import { Database } from '../types/database';
import { getNetworkStatus, getOfflineData, setOfflineData } from '../utils/pwaUtils';

type Video = Database['public']['Tables']['videos']['Row'];

export interface VideoWithMetadata extends Video {
  thumbnailUrl?: string;
}

class VideoService {
  // Fetch videos for a user with offline support
  async getUserVideos(userId: string): Promise<VideoWithMetadata[]> {
    const cacheKey = `user_videos_${userId}`;
    
    try {
      // Check if we're offline
      if (!getNetworkStatus()) {
        console.log('Offline: Loading videos from cache');
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching videos:', error);
        // Return cached data if available
        const cachedVideos = getOfflineData(cacheKey);
        return cachedVideos || [];
      }

      // Add thumbnail URLs
      const videosWithThumbnails = await Promise.all(
        data.map(async (video) => {
          const thumbnailUrl = video.thumbnail_path 
            ? await this.getFileUrl('thumbnails', video.thumbnail_path)
            : undefined;

          return {
            ...video,
            thumbnailUrl,
          };
        })
      );

      // Cache the results for offline use
      setOfflineData(cacheKey, videosWithThumbnails);

      return videosWithThumbnails;
    } catch (error) {
      console.error('Video service error:', error);
      // Return cached data if available
      const cachedVideos = getOfflineData(cacheKey);
      return cachedVideos || [];
    }
  }

  // Get secure signed URL for a file in storage (user-specific access)
  async getSecureFileUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      console.log('🔐 Getting secure signed URL from bucket:', bucket, 'path:', path, 'expires in:', expiresIn, 'seconds');
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      console.log('Supabase signed URL created successfully (expires in', expiresIn / 60, 'minutes)');
      return data.signedUrl;
    } catch (error) {
      console.error('Exception creating signed URL:', error);
      return null;
    }
  }

  // Legacy public URL method (for thumbnails if needed)
  async getFileUrl(bucket: string, path: string): Promise<string | null> {
    try {
      console.log('🪣 Getting public URL from bucket:', bucket, 'path:', path);
      
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      console.log('Supabase getPublicUrl response:', {
        publicUrl: data.publicUrl,
        fullPath: data.fullPath
      });

      return data.publicUrl;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  }

  // Get video playback URL
  async getVideoUrl(video: VideoWithMetadata): Promise<string | null> {
    try {
      console.log('Getting video URL for:', video.title);
      console.log('Video storage details:', {
        id: video.id,
        storage_path: video.storage_path,
        status: video.status,
        file_size: video.file_size,
        user_id: video.user_id
      });
      
      if (!video.storage_path) {
        console.error('No storage path found for video:', video.title);
        return null;
      }

      console.log('Attempting to get secure signed URL from bucket "videos" with path:', video.storage_path);
      // Use signed URL for secure, user-specific access (expires in 1 hour)
      const videoUrl = await this.getSecureFileUrl('videos', video.storage_path, 3600);
      
      if (videoUrl) {
        console.log('Video URL generated successfully:', videoUrl);
        // Test if URL is accessible
        try {
          const response = await fetch(videoUrl, { method: 'HEAD' });
          console.log('URL accessibility test:', response.status, response.statusText);
          if (!response.ok) {
            console.error('Generated URL is not accessible:', response.status, response.statusText);
          }
        } catch (fetchError) {
          console.error('URL accessibility test failed:', fetchError);
        }
      } else {
        console.error('Failed to generate video URL for path:', video.storage_path);
      }
      
      return videoUrl;
    } catch (error) {
      console.error('Error getting video URL:', error);
      return null;
    }
  }

  // Subscribe to real-time video updates
  subscribeToVideoUpdates(userId: string, callback: (videos: VideoWithMetadata[]) => void) {
    console.log('Setting up real-time subscription for user:', userId);
    
    const subscription = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Real-time video change detected:', payload);
          // Refetch videos when changes occur
          const videos = await this.getUserVideos(userId);
          console.log('Refreshed videos via real-time:', videos.length);
          callback(videos);
        }
      )
      .subscribe((status, err) => {
        console.log('🔔 Real-time subscription status:', status);
        if (err) console.error('❌ Real-time subscription error:', err);
      });

    return subscription;
  }

  // Delete a video
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      // First get the video to know file paths
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('storage_path, thumbnail_path')
        .eq('id', videoId)
        .single();

      if (fetchError || !video) {
        console.error('Error fetching video for deletion:', fetchError);
        return false;
      }

      // Delete files from storage
      const filesToDelete = [video.storage_path];
      if (video.thumbnail_path) {
        filesToDelete.push(video.thumbnail_path);
      }

      // Delete from videos bucket
      if (video.storage_path) {
        await supabase.storage
          .from('videos')
          .remove([video.storage_path]);
      }

      // Delete from thumbnails bucket
      if (video.thumbnail_path) {
        await supabase.storage
          .from('thumbnails')
          .remove([video.thumbnail_path]);
      }

      // Delete video record from database
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (deleteError) {
        console.error('Error deleting video record:', deleteError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete video error:', error);
      return false;
    }
  }

  // Get video by ID
  async getVideoById(videoId: string): Promise<VideoWithMetadata | null> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error || !data) {
        console.error('Error fetching video:', error);
        return null;
      }

      const thumbnailUrl = data.thumbnail_path 
        ? await this.getFileUrl('thumbnails', data.thumbnail_path)
        : undefined;

      return {
        ...data,
        thumbnailUrl,
      };
    } catch (error) {
      console.error('Error getting video by ID:', error);
      return null;
    }
  }

  // Update video metadata
  async updateVideo(
    videoId: string, 
    updates: Partial<Pick<Video, 'title' | 'description' | 'status'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId);

      if (error) {
        console.error('Error updating video:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Update video error:', error);
      return false;
    }
  }
}

export const videoService = new VideoService();