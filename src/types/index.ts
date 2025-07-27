export * from './database';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  storage_path: string;
  thumbnail_path?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  duration?: number;
  file_size?: number;
  source_type?: string;
  thumb_status?: 'pending' | 'processing' | 'ready' | 'error';
  cloudinary_url?: string;
  thumb_error_message?: string;
  created_at: string;
  updated_at: string;
}