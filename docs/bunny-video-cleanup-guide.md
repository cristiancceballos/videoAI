# Bunny.net Video Cleanup Guide

## Problem Solved
Videos were being deleted from your VideoAI app but not from Bunny.net, causing orphaned videos to accumulate (37 videos in Bunny vs 11 in app).

## Solution Implemented

### 1. **Automatic Deletion Integration**
Updated the video deletion flow to automatically delete from Bunny.net:
- When a user deletes a video in VideoAI, it now:
  1. Deletes from Bunny.net Stream (if `bunny_video_id` exists)
  2. Deletes from Supabase Storage
  3. Deletes from database

### 2. **Code Changes Made**
- Added `bunny_video_id` and `bunny_thumbnail_url` to TypeScript types
- Updated `videoService.deleteVideo()` to fetch and use `bunny_video_id`
- Added `BunnyStreamService.deleteVideo()` method
- Integrated Bunny.net deletion into the video deletion flow

### 3. **Clean Up Existing Orphaned Videos**

To identify and clean up the ~26 orphaned videos:

1. **Run the SQL script** in Supabase SQL Editor:
   ```sql
   -- Get all Bunny video IDs in your database
   SELECT DISTINCT bunny_video_id
   FROM videos
   WHERE user_id = auth.uid()
   AND bunny_video_id IS NOT NULL
   ORDER BY bunny_video_id;
   ```

2. **Compare with Bunny.net**:
   - Go to your Bunny.net Stream dashboard
   - Look for videos that exist in Bunny but NOT in your query results
   - These are orphaned videos

3. **Delete orphaned videos**:
   - In Bunny.net dashboard, delete the orphaned videos manually
   - This is a one-time cleanup

## Future Prevention
- All future video deletions will automatically sync with Bunny.net
- The delete button fix ensures users can delete any stuck videos
- Monitor the console logs for any Bunny.net deletion failures

## Testing
Try deleting a video in your app and check:
1. Console should show: "Deleting video from Bunny.net: [guid]"
2. Video should disappear from both VideoAI and Bunny.net dashboard
3. If Bunny deletion fails, you'll see a warning but local deletion continues