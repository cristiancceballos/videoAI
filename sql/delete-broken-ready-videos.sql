-- Delete videos that show as "ready" but are actually broken
-- These videos will show a loading spinner forever because they're missing essential data

-- First, identify broken "ready" videos
SELECT 
    id,
    title,
    status,
    storage_path,
    file_size,
    duration,
    created_at
FROM videos
WHERE user_id = auth.uid()
AND status = 'ready'
AND (
    storage_path IS NULL 
    OR storage_path = ''
    OR file_size IS NULL 
    OR file_size = 0
    OR duration IS NULL 
    OR duration = 0
);

-- If you see videos in the above query, uncomment and run this to delete them:
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND status = 'ready'
AND (
    storage_path IS NULL 
    OR storage_path = ''
    OR file_size IS NULL 
    OR file_size = 0
    OR duration IS NULL 
    OR duration = 0
)
RETURNING id, title;
*/

-- Alternative: Delete the 12 oldest videos (if they're the stuck ones)
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND id IN (
    SELECT id 
    FROM videos 
    WHERE user_id = auth.uid()
    ORDER BY created_at ASC
    LIMIT 12
)
RETURNING id, title, status, created_at;
*/