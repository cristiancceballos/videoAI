-- Script to clean up stuck videos that won't delete through the UI
-- Run this in your Supabase SQL Editor

-- 1. First, let's see all your videos and their status
SELECT 
    id,
    title,
    status,
    created_at,
    CASE 
        WHEN status IN ('uploading', 'processing') 
        AND created_at < NOW() - INTERVAL '1 hour' 
        THEN 'STUCK - ' || EXTRACT(hour FROM NOW() - created_at) || ' hours old'
        ELSE 'OK'
    END as health_check
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- 2. Show videos that are likely stuck (uploading/processing for more than 1 hour)
SELECT 
    id,
    title,
    status,
    created_at,
    storage_path,
    EXTRACT(hour FROM NOW() - created_at) as hours_stuck
FROM videos
WHERE user_id = auth.uid()
AND status IN ('uploading', 'processing')
AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- 3. Count stuck videos
SELECT 
    COUNT(*) as stuck_videos
FROM videos
WHERE user_id = auth.uid()
AND status IN ('uploading', 'processing')
AND created_at < NOW() - INTERVAL '1 hour';

-- 4. DELETE stuck videos (uncomment to execute)
-- This will permanently delete videos stuck in uploading/processing state for more than 1 hour
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND status IN ('uploading', 'processing')
AND created_at < NOW() - INTERVAL '1 hour'
RETURNING id, title, status;
*/

-- 5. Alternative: Delete ALL uploading/processing videos regardless of age (use with caution)
-- Uncomment only if you're sure these videos are all stuck
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND status IN ('uploading', 'processing')
RETURNING id, title, status;
*/

-- 6. Nuclear option: Delete specific videos by title pattern
-- Useful if stuck videos have a pattern in their names
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND status IN ('uploading', 'processing')
AND title LIKE '%IMG_%' -- Example: delete videos with titles containing 'IMG_'
RETURNING id, title, status;
*/

-- 7. After deletion, verify remaining videos
SELECT 
    status,
    COUNT(*) as count
FROM videos
WHERE user_id = auth.uid()
GROUP BY status
ORDER BY status;