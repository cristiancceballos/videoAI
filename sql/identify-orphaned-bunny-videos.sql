-- Identify Orphaned Bunny.net Videos
-- This script helps identify videos that exist in Bunny.net but not in your database

-- 1. Show all videos with Bunny.net IDs
SELECT 
    id,
    title,
    bunny_video_id,
    bunny_thumbnail_url,
    status,
    created_at
FROM videos
WHERE user_id = auth.uid()
AND bunny_video_id IS NOT NULL
ORDER BY created_at DESC;

-- 2. Count videos with Bunny.net integration
SELECT 
    COUNT(*) as total_videos,
    COUNT(bunny_video_id) as videos_with_bunny_id,
    COUNT(*) - COUNT(bunny_video_id) as videos_without_bunny_id
FROM videos
WHERE user_id = auth.uid();

-- 3. List all unique Bunny.net video IDs in your database
-- Compare this list with your Bunny.net dashboard to find orphaned videos
SELECT DISTINCT bunny_video_id
FROM videos
WHERE user_id = auth.uid()
AND bunny_video_id IS NOT NULL
ORDER BY bunny_video_id;

-- 4. Find videos that might have been deleted from database but not Bunny
-- This shows recently deleted video IDs (if you have audit logs)
-- Note: This only works if you have deletion tracking set up
/*
SELECT 
    old_data->>'bunny_video_id' as bunny_video_id,
    old_data->>'title' as title,
    timestamp
FROM audit_logs
WHERE table_name = 'videos'
AND action = 'DELETE'
AND old_data->>'bunny_video_id' IS NOT NULL
ORDER BY timestamp DESC
LIMIT 50;
*/

-- Manual Cleanup Instructions:
-- 1. Run query #3 above to get all Bunny video IDs in your database
-- 2. Go to your Bunny.net Stream dashboard
-- 3. Compare the list - any videos in Bunny but not in the query results are orphaned
-- 4. Delete orphaned videos manually from Bunny.net dashboard
-- 
-- To prevent future orphans:
-- - The updated deleteVideo function now deletes from Bunny.net automatically
-- - Monitor delete operations to ensure they're working correctly