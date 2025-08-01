-- Comprehensive diagnostic to see ALL videos and their properties
-- This will help identify why some videos appear stuck

-- 1. Show ALL videos with all relevant fields
SELECT 
    id,
    title,
    status,
    thumb_status,
    storage_path,
    file_size,
    duration,
    created_at,
    updated_at,
    CASE 
        WHEN storage_path IS NULL OR storage_path = '' THEN 'NO STORAGE PATH'
        WHEN file_size IS NULL OR file_size = 0 THEN 'NO FILE SIZE'
        WHEN duration IS NULL OR duration = 0 THEN 'NO DURATION'
        ELSE 'OK'
    END as issues,
    EXTRACT(day FROM NOW() - created_at) || ' days old' as age
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- 2. Group videos by status to see distribution
SELECT 
    status,
    COUNT(*) as count,
    STRING_AGG(title, ', ' ORDER BY created_at DESC) as video_titles
FROM videos
WHERE user_id = auth.uid()
GROUP BY status
ORDER BY count DESC;

-- 3. Find videos that might be problematic
SELECT 
    id,
    title,
    status,
    thumb_status,
    storage_path,
    CASE
        WHEN status = 'ready' AND (storage_path IS NULL OR storage_path = '') THEN 'Ready but no storage'
        WHEN status = 'ready' AND duration IS NULL THEN 'Ready but no duration'
        WHEN status = 'error' THEN 'Error status'
        WHEN created_at < NOW() - INTERVAL '7 days' AND status != 'ready' THEN 'Old and not ready'
        ELSE 'Check manually'
    END as problem
FROM videos
WHERE user_id = auth.uid()
AND (
    status = 'error'
    OR (status = 'ready' AND (storage_path IS NULL OR storage_path = ''))
    OR (status = 'ready' AND duration IS NULL)
    OR (created_at < NOW() - INTERVAL '1 day' AND status != 'ready')
)
ORDER BY created_at DESC;

-- 4. Show videos by thumb_status
SELECT 
    thumb_status,
    COUNT(*) as count
FROM videos
WHERE user_id = auth.uid()
GROUP BY thumb_status;

-- 5. Find videos with unusual combinations
SELECT 
    id,
    title,
    status,
    thumb_status,
    storage_path IS NOT NULL as has_storage,
    duration IS NOT NULL as has_duration,
    bunny_video_id IS NOT NULL as has_bunny_id
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at DESC;