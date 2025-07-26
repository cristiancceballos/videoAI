# Edge Function Deployment Guide

## Step 1: Install/Update Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Or update to latest version  
npm update -g supabase

# Verify installation
supabase --version
```

## Step 2: Login to Supabase

```bash
# Login to Supabase (opens browser)
supabase login
```

## Step 3: Link Project (if not already linked)

```bash
# Navigate to project directory
cd /Users/cristiancabrera/apps/videoAI

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Check project status
supabase status
```

## Step 4: Set Environment Variables

```bash
# Set required environment variables for Edge Functions
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

# Verify secrets are set
supabase secrets list
```

## Step 5: Deploy the Edge Function

```bash
# Deploy the generate-thumbnails function
supabase functions deploy generate-thumbnails

# Check deployment status
supabase functions list
```

## Step 6: Test the Deployment

### Test Locally First:
```bash
# Start local development server
supabase functions serve generate-thumbnails --no-verify-jwt

# In another terminal, test with curl:
curl -X POST 'http://localhost:54321/functions/v1/generate-thumbnails' \
  -H 'Content-Type: application/json' \
  -d '{
    "videoId": "test-video-123",
    "userId": "test-user-456", 
    "storagePath": "test-user-456/test-video.mp4"
  }'
```

### Test Production Deployment:
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-thumbnails' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "videoId": "test-video-123",
    "userId": "test-user-456",
    "storagePath": "test-user-456/test-video.mp4"
  }'
```

## Step 7: Monitor Function Logs

```bash
# View function logs
supabase functions logs generate-thumbnails

# View logs with follow mode
supabase functions logs generate-thumbnails --follow
```

## Troubleshooting

### Common Issues:

1. **"Project not linked"**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **"Environment variables not set"**
   ```bash
   supabase secrets set SUPABASE_URL="your_url"
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your_key"
   ```

3. **"Function not found"**
   - Check function name: `supabase functions list`
   - Redeploy: `supabase functions deploy generate-thumbnails`

4. **"Permission denied"**
   - Check service role key has proper permissions
   - Verify storage bucket policies

### Get Project Information:
```bash
# Get project reference
supabase projects list

# Get API keys
supabase projects api-keys --project-ref YOUR_PROJECT_REF
```

## Success Indicators

✅ Function deploys without errors
✅ Function appears in `supabase functions list`
✅ Test curl request returns success response
✅ Logs show function execution without errors
✅ Placeholder thumbnails are created in storage

## Next Steps After Deployment

1. **Test with actual video upload** from your app
2. **Monitor function logs** for any runtime errors
3. **Verify thumbnails** are created in Supabase Storage
4. **Check database** for updated video records with thumbnail paths
5. **Prepare for FFmpeg integration** (Phase 2)