export interface Database {
  public: {
    Tables: {
      videos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          storage_path: string;
          thumbnail_path?: string;
          status: 'uploading' | 'processing' | 'ready' | 'error';
          duration?: number;
          file_size?: number;
          source_type: 'device' | 'youtube' | 'tiktok';
          source_url?: string;
          original_filename?: string;
          width?: number;
          height?: number;
          fps?: number;
          codec?: string;
          thumb_status?: 'pending' | 'processing' | 'ready' | 'error';
          thumb_error_message?: string;
          bunny_video_id?: string;
          bunny_thumbnail_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string;
          storage_path: string;
          thumbnail_path?: string;
          status?: 'uploading' | 'processing' | 'ready' | 'error';
          duration?: number;
          file_size?: number;
          source_type?: 'device' | 'youtube' | 'tiktok';
          source_url?: string;
          original_filename?: string;
          width?: number;
          height?: number;
          fps?: number;
          codec?: string;
          thumb_status?: 'pending' | 'processing' | 'ready' | 'error';
          thumb_error_message?: string;
          bunny_video_id?: string;
          bunny_thumbnail_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          storage_path?: string;
          thumbnail_path?: string;
          status?: 'uploading' | 'processing' | 'ready' | 'error';
          duration?: number;
          file_size?: number;
          source_type?: 'device' | 'youtube' | 'tiktok';
          source_url?: string;
          original_filename?: string;
          width?: number;
          height?: number;
          fps?: number;
          codec?: string;
          thumb_status?: 'pending' | 'processing' | 'ready' | 'error';
          thumb_error_message?: string;
          bunny_video_id?: string;
          bunny_thumbnail_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transcripts: {
        Row: {
          id: string;
          video_id: string;
          content: string;
          language?: string;
          confidence_score?: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          content: string;
          language?: string;
          confidence_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          content?: string;
          language?: string;
          confidence_score?: number;
          created_at?: string;
        };
      };
      summaries: {
        Row: {
          id: string;
          video_id: string;
          content: string;
          model_used: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          content: string;
          model_used: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          content?: string;
          model_used?: string;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          video_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      embeddings: {
        Row: {
          id: string;
          video_id: string;
          chunk_text: string;
          embedding: number[];
          chunk_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          chunk_text: string;
          embedding: number[];
          chunk_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          chunk_text?: string;
          embedding?: number[];
          chunk_index?: number;
          created_at?: string;
        };
      };
    };
  };
}