# Cloudinary Setup Guide

## 1. Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account (25 credits = ~125 thumbnails)
3. Verify your email and log in

## 2. Get API Credentials

1. Go to your [Cloudinary Console Dashboard](https://console.cloudinary.com/)
2. Copy these values from the "Product Environment Credentials" section:
   - **Cloud name** (e.g., `dc2n8x8y5`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdef123456789_xyz`)

## 3. Update Environment Variables

Add to your `.env` file:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

## 4. Configure Upload Settings (Optional)

In Cloudinary Console:
1. Go to Settings → Upload
2. Set "Auto-create folders" to Yes
3. Consider enabling "Overwrite" for consistent URLs

## 5. Video Thumbnail URL Format

Cloudinary automatically generates thumbnails from videos using this URL pattern:
```
https://res.cloudinary.com/{cloud_name}/video/upload/so_3,w_400,h_225,c_fill/{public_id}.jpg
```

Parameters:
- `so_3` = Start offset at 3 seconds
- `w_400,h_225` = 400x225 pixel dimensions
- `c_fill` = Crop and fill to exact dimensions
- `.jpg` = Convert to JPEG format

## Next Steps

After setting up credentials, the Edge Function will use these to:
1. Generate signed URLs for video access
2. Request thumbnail generation via Cloudinary API
3. Store the resulting thumbnail URLs in the database