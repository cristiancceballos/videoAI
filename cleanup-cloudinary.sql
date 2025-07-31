-- Cleanup script to remove Cloudinary references from existing videos
-- Run this in Supabase SQL Editor

-- First, let's check what we have
SELECT 
    id,
    title,
    thumb_status,
    bunny_thumbnail_url,
    bunny_video_id,
    bunny_video_url,
    created_at
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- Clear any Cloudinary URLs that might still exist in the bunny_thumbnail_url column
-- (from when it was named cloudinary_url)
UPDATE videos
SET bunny_thumbnail_url = NULL
WHERE bunny_thumbnail_url LIKE '%cloudinary.com%'
AND user_id = auth.uid();

-- Reset thumb_status to pending for videos without Bunny processing
UPDATE videos
SET thumb_status = 'pending'
WHERE bunny_video_id IS NULL
AND thumb_status = 'ready'
AND user_id = auth.uid();

-- Verify the changes
SELECT 
    COUNT(*) as total_videos,
    SUM(CASE WHEN thumb_status = 'pending' THEN 1 ELSE 0 END) as pending_thumbnails,
    SUM(CASE WHEN bunny_video_id IS NOT NULL THEN 1 ELSE 0 END) as bunny_processed,
    SUM(CASE WHEN bunny_thumbnail_url LIKE '%cloudinary%' THEN 1 ELSE 0 END) as cloudinary_urls_remaining
FROM videos
WHERE user_id = auth.uid();