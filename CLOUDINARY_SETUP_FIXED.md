# Cloudinary Setup Guide - Fixed Implementation

This guide ensures Cloudinary is properly configured for video thumbnail generation.

## Critical Setup Steps

### 1. Create Unsigned Upload Preset

1. Log into Cloudinary Dashboard: https://cloudinary.com/console
2. Go to **Settings** → **Upload** → **Upload presets**
3. Click **Add upload preset**
4. Configure these EXACT settings:

#### Basic Settings:
- **Preset name**: `video-thumbnails`
- **Signing Mode**: **Unsigned** (CRITICAL!)
- **Folder**: `video_thumbnails`

#### Upload Control:
- **Allowed formats**: `mp4,mov,avi,webm,mkv`
- **Max file size**: 100MB
- **Resource type**: Video

#### Eager Transformations (IMPORTANT):
1. Click **Add eager transformation**
2. Set these parameters:
   - **Format**: jpg
   - **Width**: 400
   - **Height**: 225
   - **Crop**: fill
   - **Start offset**: 3
   - **Quality**: auto

Or use the transformation string: `so_3,w_400,h_225,c_fill,f_jpg`

#### Advanced Settings:
- **Eager async**: OFF (we want synchronous generation)
- **Overwrite**: ON

### 2. Save the Preset
Click **Save** at the bottom.

## Testing the Configuration

### Test with cURL:
```bash
# Replace YOUR_CLOUD_NAME with your actual cloud name (e.g., ddboyfn5x)
curl -X POST \
  https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/video/upload \
  -F "file=https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" \
  -F "upload_preset=video-thumbnails" \
  -F "public_id=test_video_123" \
  -F "resource_type=video"
```

### Expected Response:
```json
{
  "public_id": "video_thumbnails/test_video_123",
  "eager": [
    {
      "transformation": "so_3,w_400,h_225,c_fill,f_jpg",
      "width": 400,
      "height": 225,
      "url": "http://res.cloudinary.com/.../video_thumbnails/test_video_123.jpg",
      "secure_url": "https://res.cloudinary.com/.../video_thumbnails/test_video_123.jpg"
    }
  ]
}
```

## Common Issues and Solutions

### Issue: "Upload preset not found"
- Ensure the preset name is exactly `video-thumbnails`
- Verify it's set to "Unsigned"
- Check that the preset is enabled

### Issue: Thumbnails still showing black
- Verify eager transformations are configured
- Check that `eager_async` is set to false
- Ensure the video format is supported

### Issue: Upload timeout
- Videos larger than 50MB may timeout
- Consider reducing max file size in preset
- Edge Function has a 3-minute limit

## Verifying in Your App

1. Upload a video through your app
2. Check the console for any errors
3. The thumbnail should appear immediately after upload completes
4. If thumbnail is still black/grey:
   - Check browser console for 404 errors
   - Verify the Cloudinary URL in the network tab
   - Ensure the eager transformation was applied

## Important Notes

- The Edge Function now waits for Cloudinary upload to complete
- Thumbnails are generated synchronously during upload
- No retry logic is needed on the client side
- If upload fails, the video will show an error status

## Next Steps

After configuration:
1. Test with a small video file first
2. Monitor Cloudinary dashboard for uploads
3. Check usage to avoid exceeding free tier limits