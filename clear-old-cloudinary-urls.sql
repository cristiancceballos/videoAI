-- Clear any remaining Cloudinary URLs from the database
-- These are causing 400 errors in the browser console

-- Check for any remaining Cloudinary URLs
SELECT 
    id,
    title,
    bunny_thumbnail_url,
    thumb_status,
    created_at
FROM videos
WHERE bunny_thumbnail_url LIKE '%cloudinary%'
AND user_id = auth.uid()
ORDER BY created_at DESC;

-- Clear Cloudinary URLs from bunny_thumbnail_url column
UPDATE videos
SET bunny_thumbnail_url = NULL
WHERE bunny_thumbnail_url LIKE '%cloudinary%'
AND user_id = auth.uid();

-- Verify the cleanup
SELECT 
    COUNT(*) as total_videos,
    SUM(CASE WHEN bunny_thumbnail_url LIKE '%cloudinary%' THEN 1 ELSE 0 END) as cloudinary_urls_remaining
FROM videos
WHERE user_id = auth.uid();