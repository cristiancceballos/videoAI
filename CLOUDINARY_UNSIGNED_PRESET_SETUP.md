# Cloudinary Unsigned Upload Preset Setup Guide

This guide will help you create an unsigned upload preset in Cloudinary for video thumbnail generation.

## Prerequisites
- A Cloudinary account (free tier is sufficient)
- Access to Cloudinary Dashboard

## Steps to Create Unsigned Upload Preset

### 1. Login to Cloudinary Dashboard
Navigate to [https://cloudinary.com/users/login](https://cloudinary.com/users/login) and login to your account.

### 2. Access Upload Presets
1. In the Dashboard, go to **Settings** (gear icon)
2. Navigate to **Upload** tab
3. Scroll down to **Upload presets** section

### 3. Create New Preset
1. Click **Add upload preset**
2. Configure the following settings:

#### Basic Settings:
- **Preset name**: `video-thumbnails`
- **Signing Mode**: Select **Unsigned** (IMPORTANT!)
- **Folder**: `video_thumbnails` (optional, helps organize files)

#### Upload Control:
- **Allowed formats**: Leave empty (allows all video formats)
- **Max file size**: Set to 100MB or your preference
- **Use filename**: Enable this option

#### Incoming Transformation (Optional):
If you want Cloudinary to automatically create thumbnails during upload:
1. Click **Edit** next to Incoming Transformation
2. Add transformation:
   - Format: jpg
   - Quality: auto
   - Width: 400
   - Height: 225
   - Crop: fill
   - Start offset: 3s

### 4. Save the Preset
1. Click **Save** at the bottom of the page
2. Note down the preset name (should be `video-thumbnails`)

### 5. Verify Cloud Name
While in the Dashboard:
1. Look at the top of the page for your **Cloud name**
2. It should match what's in `cloudinaryService.ts`: `dyhvjcvko`
3. If different, update the `CLOUDINARY_CLOUD_NAME` constant in the service file

## Security Considerations

### Unsigned Upload Security:
- Unsigned uploads are safe for thumbnail generation as they:
  - Can only upload to specific folders
  - Have file size limits
  - Can be restricted by IP or referrer
  - Cannot delete or modify existing files

### Additional Security (Optional):
1. In the upload preset settings, you can add:
   - **Allowed IP addresses**: Restrict to your Supabase Edge Function IPs
   - **Max file size**: Limit to prevent abuse
   - **Allowed formats**: Restrict to video formats only

## Testing the Setup

### 1. Test with cURL:
```bash
curl -X POST \
  https://api.cloudinary.com/v1_1/dyhvjcvko/video/upload \
  -F "file=https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" \
  -F "upload_preset=video-thumbnails" \
  -F "public_id=test_video_123"
```

### 2. Expected Response:
```json
{
  "public_id": "video_thumbnails/test_video_123",
  "version": 1234567890,
  "signature": "...",
  "width": 1280,
  "height": 720,
  "format": "mp4",
  "resource_type": "video",
  "url": "http://res.cloudinary.com/dyhvjcvko/video/upload/v1234567890/video_thumbnails/test_video_123.mp4",
  "secure_url": "https://res.cloudinary.com/dyhvjcvko/video/upload/v1234567890/video_thumbnails/test_video_123.mp4"
}
```

### 3. Access Thumbnail:
The thumbnail will be available at:
```
https://res.cloudinary.com/dyhvjcvko/video/upload/so_3,w_400,h_225,c_fill,f_jpg/video_thumbnails/test_video_123.jpg
```

## Troubleshooting

### Error: "Upload preset not found"
- Ensure the preset name exactly matches `video-thumbnails`
- Verify the preset is set to "Unsigned"
- Check that the preset is enabled

### Error: "Invalid cloud name"
- Verify your cloud name in the Dashboard
- Update `CLOUDINARY_CLOUD_NAME` in `cloudinaryService.ts`

### Thumbnails not generating
- Check if the video URL is accessible
- Verify the video format is supported
- Check Cloudinary usage limits

## Next Steps

After creating the unsigned preset:
1. Test video upload in your app
2. Monitor Cloudinary Dashboard for uploads
3. Check thumbnail generation status
4. Verify real-time updates in the UI

## Cost Monitoring

- Free tier includes 25 credits/month
- Each thumbnail generation uses ~0.2 credits
- Monitor usage in Dashboard > Reports > Usage