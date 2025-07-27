-- Add Cloudinary thumbnail fields to videos table
-- This migration adds the necessary columns for tracking thumbnail generation status

-- Add thumb_status enum type
DO $$ BEGIN
  CREATE TYPE thumb_status_enum AS ENUM ('pending', 'processing', 'ready', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS thumb_status thumb_status_enum DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS cloudinary_url TEXT,
ADD COLUMN IF NOT EXISTS thumb_error_message TEXT;

-- Create index for thumbnail status queries
CREATE INDEX IF NOT EXISTS idx_videos_thumb_status ON videos(thumb_status);

-- Add comment for documentation
COMMENT ON COLUMN videos.thumb_status IS 'Status of thumbnail generation: pending, processing, ready, error';
COMMENT ON COLUMN videos.cloudinary_url IS 'Direct URL to Cloudinary-generated thumbnail';
COMMENT ON COLUMN videos.thumb_error_message IS 'Error message if thumbnail generation failed';

-- Update existing videos to have pending status
UPDATE videos SET thumb_status = 'pending' WHERE thumb_status IS NULL;