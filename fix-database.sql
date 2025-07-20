-- Add missing columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'device' CHECK (source_type IN ('device', 'youtube', 'tiktok'));

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS original_filename TEXT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS width INTEGER;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS height INTEGER;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS fps FLOAT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS codec TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);