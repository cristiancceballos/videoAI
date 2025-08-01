-- Identify videos that appear "stuck" with loading icon
-- These are videos that might look ready but have issues

-- 1. Show all videos with their complete state
SELECT 
    id,
    title,
    status,
    thumb_status,
    storage_path,
    bunny_video_id,
    bunny_thumbnail_url,
    file_size,
    duration,
    created_at,
    CASE 
        WHEN status = 'ready' AND storage_path IS NULL THEN 'Ready but no file'
        WHEN status = 'ready' AND (file_size IS NULL OR file_size = 0) THEN 'Ready but no size'
        WHEN status = 'ready' AND (duration IS NULL OR duration = 0) THEN 'Ready but no duration'
        WHEN status = 'processing' AND created_at < NOW() - INTERVAL '1 hour' THEN 'Stuck processing'
        WHEN status = 'uploading' AND created_at < NOW() - INTERVAL '1 hour' THEN 'Stuck uploading'
        WHEN status = 'error' THEN 'Error state'
        WHEN status = 'ready' THEN 'Should be playable'
        ELSE 'Unknown issue'
    END as diagnosis
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at ASC;

-- 2. Count videos by their diagnosis
SELECT 
    CASE 
        WHEN status = 'ready' AND storage_path IS NULL THEN 'Ready but no file'
        WHEN status = 'ready' AND (file_size IS NULL OR file_size = 0) THEN 'Ready but no size'
        WHEN status = 'ready' AND (duration IS NULL OR duration = 0) THEN 'Ready but no duration'
        WHEN status = 'processing' AND created_at < NOW() - INTERVAL '1 hour' THEN 'Stuck processing'
        WHEN status = 'uploading' AND created_at < NOW() - INTERVAL '1 hour' THEN 'Stuck uploading'
        WHEN status = 'error' THEN 'Error state'
        WHEN status = 'ready' THEN 'Should be playable'
        ELSE 'Unknown issue'
    END as diagnosis,
    COUNT(*) as count
FROM videos
WHERE user_id = auth.uid()
GROUP BY diagnosis
ORDER BY count DESC;

-- 3. Focus on the 12 oldest videos (likely the stuck ones)
SELECT 
    id,
    title,
    status,
    storage_path IS NOT NULL as has_storage,
    file_size > 0 as has_size,
    duration > 0 as has_duration,
    created_at
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at ASC
LIMIT 12;