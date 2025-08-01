-- Drop the auto-update trigger that sets thumb_status to 'ready' when status is 'ready'
-- This trigger was preventing Bunny.net from processing thumbnails

-- First, let's find the trigger
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'videos'
AND trigger_name LIKE '%thumb%';

-- Drop the trigger (adjust the name if different)
DROP TRIGGER IF EXISTS auto_update_thumb_status_on_ready ON videos;

-- Alternative names the trigger might have
DROP TRIGGER IF EXISTS update_thumb_status_when_ready ON videos;
DROP TRIGGER IF EXISTS thumb_status_ready_trigger ON videos;
DROP TRIGGER IF EXISTS set_thumb_status_ready ON videos;

-- Drop the function that the trigger uses (if it exists)
DROP FUNCTION IF EXISTS auto_update_thumb_status() CASCADE;
DROP FUNCTION IF EXISTS update_thumb_status_to_ready() CASCADE;
DROP FUNCTION IF EXISTS set_thumb_status_ready() CASCADE;

-- Verify triggers are gone
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'videos';

-- Check current videos with pending thumbnails
SELECT 
    id,
    title,
    status,
    thumb_status,
    bunny_video_id,
    created_at
FROM videos
WHERE user_id = auth.uid()
AND thumb_status = 'ready'
AND bunny_video_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Reset recent videos to pending if they don't have Bunny processing
UPDATE videos
SET thumb_status = 'pending'
WHERE user_id = auth.uid()
AND thumb_status = 'ready'
AND bunny_video_id IS NULL
AND created_at > NOW() - INTERVAL '24 hours';

-- Verify the update
SELECT 
    COUNT(*) as total_videos,
    SUM(CASE WHEN thumb_status = 'pending' THEN 1 ELSE 0 END) as pending_thumbnails,
    SUM(CASE WHEN bunny_video_id IS NOT NULL THEN 1 ELSE 0 END) as bunny_processed
FROM videos
WHERE user_id = auth.uid();