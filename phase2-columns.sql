-- Phase 2: Add missing video metadata columns
-- Run this in your Supabase SQL Editor after running supabase-setup.sql

-- Add source_type column
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'device' 
CHECK (source_type IN ('device', 'youtube', 'tiktok'));

-- Add source_url column for YouTube/TikTok URLs
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add original filename
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add video dimensions
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS width INTEGER;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS height INTEGER;

-- Add video codec info
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS fps FLOAT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS codec TEXT;

-- Create index for source_type
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'videos' 
ORDER BY ordinal_position;