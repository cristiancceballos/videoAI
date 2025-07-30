import { supabase } from './supabaseClient';

// Bunny.net Stream configuration
// These values should be stored securely in environment variables for production
const BUNNY_STREAM_LIBRARY_ID = process.env.EXPO_PUBLIC_BUNNY_STREAM_LIBRARY_ID || '';
const BUNNY_STREAM_API_KEY = process.env.EXPO_PUBLIC_BUNNY_STREAM_API_KEY || '';
const BUNNY_STREAM_CDN_HOSTNAME = process.env.EXPO_PUBLIC_BUNNY_STREAM_CDN_HOSTNAME || '';

interface BunnyVideoResponse {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  length: number;
  status: number;
  framerate: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
  captions: any[];
  hasMP4Fallback: boolean;
  collectionId: string;
  thumbnailFileName: string;
  averageWatchTime: number;
  totalWatchTime: number;
  category: string;
  chapters: any[];
  moments: any[];
  metaTags: any[];
  transcodingMessages: any[];
}

export class BunnyStreamService {
  /**
   * Trigger Bunny.net processing for a video via Edge Function
   */
  static async processVideo(videoId: string, userId: string, storagePath: string): Promise<void> {
    try {
      // Call our Edge Function which will handle the Bunny.net integration
      const { data, error } = await supabase.functions.invoke('bunny-video-processor', {
        body: {
          videoId,
          userId,
          storagePath,
          // Pass configuration from client
          bunnyLibraryId: BUNNY_STREAM_LIBRARY_ID,
          bunnyApiKey: BUNNY_STREAM_API_KEY,
          bunnyCdnHostname: BUNNY_STREAM_CDN_HOSTNAME
        }
      });

      if (error) {
        // Error triggering video processing
        throw error;
      }

      // Video processing triggered successfully
    } catch (error) {
      // Failed to process video
      throw error;
    }
  }

  /**
   * Get the thumbnail URL for a Bunny video
   * Format: https://{cdn-hostname}/{video-guid}/thumbnail.jpg
   */
  static getThumbnailUrl(videoGuid: string): string {
    if (!videoGuid || !BUNNY_STREAM_CDN_HOSTNAME) {
      return '';
    }
    return `https://${BUNNY_STREAM_CDN_HOSTNAME}/${videoGuid}/thumbnail.jpg`;
  }

  /**
   * Get the video playback URL for a Bunny video
   * Format: https://{cdn-hostname}/{video-guid}/playlist.m3u8
   */
  static getVideoUrl(videoGuid: string): string {
    if (!videoGuid || !BUNNY_STREAM_CDN_HOSTNAME) {
      return '';
    }
    return `https://${BUNNY_STREAM_CDN_HOSTNAME}/${videoGuid}/playlist.m3u8`;
  }

  /**
   * Create a video entry in Bunny Stream (used by Edge Function)
   */
  static async createVideo(title: string, thumbnailTime: number = 3000): Promise<BunnyVideoResponse> {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'AccessKey': BUNNY_STREAM_API_KEY
        },
        body: JSON.stringify({
          title,
          thumbnailTime // Time in milliseconds to extract thumbnail
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create video in Bunny Stream: ${error}`);
    }

    return response.json();
  }

  /**
   * Upload video to Bunny Stream (used by Edge Function)
   */
  static async uploadVideo(videoGuid: string, videoData: Blob): Promise<void> {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoGuid}`,
      {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'AccessKey': BUNNY_STREAM_API_KEY
        },
        body: videoData
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload video to Bunny Stream: ${error}`);
    }
  }
}