-- Force delete videos by various criteria
-- Use this if videos won't delete through normal means

-- Option 1: Delete videos with error status
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND status = 'error'
RETURNING id, title, status;
*/

-- Option 2: Delete videos without proper storage path
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND (storage_path IS NULL OR storage_path = '')
RETURNING id, title, status;
*/

-- Option 3: Delete videos by partial title match
-- Replace 'YOUR_PATTERN' with part of the title of stuck videos
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND title ILIKE '%YOUR_PATTERN%'
RETURNING id, title, status;
*/

-- Option 4: Delete oldest videos that might be stuck
-- This deletes the 12 oldest videos regardless of status
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

-- Option 5: Delete by specific video IDs
-- First run this to get the IDs of problematic videos:
SELECT id, title, status, created_at
FROM videos
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- Then use those IDs here:
/*
DELETE FROM videos
WHERE user_id = auth.uid()
AND id IN (
    'paste-id-1-here',
    'paste-id-2-here',
    'paste-id-3-here'
    -- Add more IDs as needed
)
RETURNING id, title, status;
*/

-- Option 6: Clean up orphaned storage files
-- This finds videos that might have storage issues
SELECT 
    v.id,
    v.title,
    v.status,
    v.storage_path,
    CASE 
        WHEN v.storage_path IS NULL THEN 'No storage path'
        WHEN v.storage_path = '' THEN 'Empty storage path'
        ELSE 'Has storage path'
    END as storage_status
FROM videos v
WHERE v.user_id = auth.uid()
AND v.status IN ('uploading', 'processing', 'error')
ORDER BY v.created_at DESC;