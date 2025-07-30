# Bunny.net Stream Setup Guide

This guide will help you set up Bunny.net Stream for video thumbnail generation in the VideoAI app.

## Prerequisites

1. Create a Bunny.net account at https://bunny.net
2. Have your Supabase project ready

## Step 1: Create a Stream Video Library

1. Log in to your Bunny.net dashboard
2. Navigate to "Stream" in the left sidebar
3. Click "Add Video Library"
4. Configure your library:
   - **Name**: Give it a descriptive name (e.g., "VideoAI Thumbnails")
   - **Pricing Tier**: Choose based on your needs (Basic is fine for testing)
   - **Geo-Replication**: Select regions close to your users
5. Click "Add Video Library"

## Step 2: Get Your API Credentials

After creating the library:

1. Click on your new video library
2. Go to the "API" tab
3. Copy these values:
   - **Library ID**: Found at the top (e.g., `123456`)
   - **API Key**: Click "Show API Key" and copy it
   - **CDN Hostname**: Found in the "CDN" tab (e.g., `vz-12345678.b-cdn.net`)

## Step 3: Configure Environment Variables

### For Local Development

Create a `.env.local` file in your project root:

```bash
# Copy from .env.example and fill in your values
EXPO_PUBLIC_BUNNY_STREAM_LIBRARY_ID=123456
EXPO_PUBLIC_BUNNY_STREAM_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EXPO_PUBLIC_BUNNY_STREAM_CDN_HOSTNAME=vz-12345678.b-cdn.net
```

### For Supabase Edge Functions

Set the secrets for your Edge Functions:

```bash
npx supabase secrets set BUNNY_STREAM_LIBRARY_ID=123456
npx supabase secrets set BUNNY_STREAM_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
npx supabase secrets set BUNNY_STREAM_CDN_HOSTNAME=vz-12345678.b-cdn.net
```

## Step 4: Deploy the Edge Function

Deploy the Bunny video processor:

```bash
npx supabase functions deploy bunny-video-processor
```

## Step 5: Run Database Migration

Run the migration to update your database schema:

```sql
-- In Supabase SQL Editor, run the contents of bunny-migration.sql
```

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   npx expo start --web
   ```

2. Upload a video through the app

3. Check the following:
   - Video should show "processing" status
   - Edge Function logs should show Bunny processing
   - Thumbnail should appear within 10-30 seconds
   - Database should have `bunny_video_id` and `bunny_thumbnail_url` populated

## Troubleshooting

### Thumbnails not appearing
- Check Edge Function logs: `npx supabase functions logs bunny-video-processor`
- Verify environment variables are set correctly
- Ensure Bunny.net account has sufficient credits

### 404 errors on thumbnails
- Thumbnails may take 10-30 seconds to generate after upload
- Check if the video was successfully uploaded to Bunny
- Verify the CDN hostname is correct

### Edge Function errors
- Check if API key has correct permissions
- Verify Library ID matches your video library
- Ensure video file size is under 100MB

## Costs

Bunny.net Stream pricing (as of 2025):
- **Storage**: $0.005/GB/month
- **Streaming**: $0.005/GB
- **Encoding**: $0.005/minute
- **Base fee**: $5/month per video library

For 1000 videos with thumbnails:
- Estimated cost: ~$10-15/month

## Benefits over Cloudinary

1. **Reliable thumbnail generation**: No 404 issues
2. **Simple API**: Two-step process (create + upload)
3. **Integrated CDN**: Videos and thumbnails served from same CDN
4. **Predictable pricing**: Clear per-usage costs
5. **No timeout issues**: Async processing handled by Bunny

## Next Steps

1. Monitor usage in Bunny.net dashboard
2. Set up webhook notifications for processing completion (optional)
3. Configure additional video resolutions if needed
4. Set up custom domain for CDN (optional)