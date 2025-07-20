# Phase 2 Setup Guide - Video Upload & Storage (PWA)

## Prerequisites
- Phase 1 completed (Supabase project setup, authentication working)
- `.env` file configured with Supabase credentials

## Database Updates

### 1. Run Phase 2 SQL Updates
In your Supabase SQL Editor, run the script from `supabase-phase2-updates.sql`:

```sql
-- This will add new metadata fields and storage policies
-- Run this in your Supabase dashboard SQL Editor
```

### 2. Create Storage Buckets
1. Go to Storage in your Supabase dashboard
2. Create bucket named `videos` (if not exists)
   - Public: No
   - File size limit: 100MB
   - Allowed MIME types: video/*
3. Create bucket named `thumbnails` (if not exists)
   - Public: No
   - File size limit: 5MB
   - Allowed MIME types: image/*

## PWA Configuration

### 1. Web-Compatible File Access
The app now uses HTML5 File API instead of native plugins:
- **File Selection**: HTML5 `<input type="file">` for gallery access
- **Camera Access**: `getUserMedia()` API for video recording
- **Upload Progress**: XMLHttpRequest for progress tracking
- **No Permissions Required**: Works directly in mobile browsers

### 2. Test the Features

#### Upload Functionality:
1. **File Upload**: 
   - Tap "Choose File"
   - Select a video from your device's file system
   - Enter a title and tap "Upload"
   - Watch the progress indicator

2. **Camera Recording**:
   - Tap "Record Video" 
   - Allow camera access when prompted
   - Record a short video
   - Preview and upload

3. **URL Validation**:
   - Paste a YouTube or TikTok URL
   - See validation feedback (processing coming in Phase 3)

#### Video Feed:
1. **Home Screen**: View uploaded videos in grid layout
2. **Real-time Updates**: Videos update status automatically
3. **Pull to Refresh**: Swipe down to refresh the video list

## Storage Structure

Videos are organized in Supabase Storage as:
```
videos/
  {user_id}/
    {timestamp}_{filename}.mp4

thumbnails/
  {user_id}/
    {video_id}.jpg
```

## Phase 2 Features Working ✅

- ✅ **Web-compatible file selection**
- ✅ **HTML5 camera video recording**
- ✅ **XMLHttpRequest upload progress tracking**
- ✅ **HTML5 video preview before upload**
- ✅ **File validation (size, duration, format)**
- ✅ **Responsive video grid feed with thumbnails**
- ✅ **Real-time status updates**
- ✅ **Source type indicators (device/YouTube/TikTok)**
- ✅ **Pull-to-refresh functionality**
- ✅ **Secure user-isolated storage**

## Troubleshooting

### Upload Issues:
- Check Supabase storage bucket exists and has correct policies
- Verify file size is under 100MB
- Ensure video duration is under 30 minutes

### Browser Issues:
- Test in mobile browsers (Chrome on Android, Safari on iOS)
- Allow camera access when prompted for video recording
- Ensure HTTPS for camera access and PWA features

### Database Issues:
- Run Phase 2 SQL updates in Supabase dashboard
- Check that new fields exist in videos table

## Next Steps (Phase 3)

Ready for AI processing:
- Audio extraction with ffmpeg
- Whisper transcription
- GPT-4 summarization
- Vector embeddings for search
- Background processing queues

Phase 2 provides a solid foundation for video management!