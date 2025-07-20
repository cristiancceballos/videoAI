-- Phase 2: Additional video metadata fields
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'device' CHECK (source_type IN ('device', 'youtube', 'tiktok')),
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS fps FLOAT,
ADD COLUMN IF NOT EXISTS codec TEXT;

-- Update video metadata index
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);

-- Storage bucket policies for Phase 2

-- Videos bucket policy - users can upload to their own folder
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', false) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('thumbnails', 'thumbnails', false) 
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos to their own folder
-- Remove IF NOT EXISTS from CREATE POLICY
CREATE POLICY "Users can upload videos to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own videos
CREATE POLICY "Users can view own videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Thumbnails bucket policies
CREATE POLICY "Users can upload thumbnails to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own thumbnails" ON storage.objects
FOR SELECT USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- code does not work
/*-- Phase 2: Additional video metadata fields
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'device' CHECK (source_type IN ('device', 'youtube', 'tiktok')),
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS fps FLOAT,
ADD COLUMN IF NOT EXISTS codec TEXT;

-- Update video metadata index
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);

-- Storage bucket policies for Phase 2

-- Videos bucket policy - users can upload to their own folder
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', false) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('thumbnails', 'thumbnails', false) 
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload videos to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own videos
CREATE POLICY IF NOT EXISTS "Users can view own videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own videos
CREATE POLICY IF NOT EXISTS "Users can delete own videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Thumbnails bucket policies
CREATE POLICY IF NOT EXISTS "Users can upload thumbnails to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can view own thumbnails" ON storage.objects
FOR SELECT USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;/*