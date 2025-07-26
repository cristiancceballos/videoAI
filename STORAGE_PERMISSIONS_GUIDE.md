# 🔧 Fix Storage Permissions for Thumbnail Uploads

## 🎯 Problem
Thumbnails upload successfully (HTTP 200) but don't appear in storage due to missing user write permissions on the `thumbnails` bucket.

## 📋 Manual Fix via Supabase Dashboard

### Step 1: Access Storage Settings
1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Storage** → **Policies**
3. Look for the `thumbnails` bucket

### Step 2: Configure Bucket Settings
1. In **Storage** → **Settings**
2. Find the `thumbnails` bucket
3. Ensure it's configured as:
   - **Public**: `false` (private bucket)
   - **File size limit**: `10MB` (or higher)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`

### Step 3: Add Storage Policies
Go to **Storage** → **Policies** and add these policies:

#### Policy 1: User Upload Permission
```sql
Policy Name: Users can upload thumbnails to own folder
Operation: INSERT
Target: objects
Policy: 
bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
```

#### Policy 2: User View Permission  
```sql
Policy Name: Users can view own thumbnails
Operation: SELECT
Target: objects
Policy:
bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
```

#### Policy 3: User Delete Permission
```sql
Policy Name: Users can delete own thumbnails  
Operation: DELETE
Target: objects
Policy:
bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
```

### Step 4: Alternative - Public Access (If Above Fails)
If the folder-based policies don't work, try this simpler approach:

```sql
Policy Name: Allow public thumbnail access
Operation: ALL  
Target: objects
Policy:
bucket_id = 'thumbnails'
```

## 🚀 Automated Fix Options

### Option A: SQL Script
Run `/fix-user-thumbnail-permissions.sql` in Supabase SQL Editor

### Option B: JavaScript Setup
1. Install dependencies: `npm install @supabase/supabase-js`
2. Set environment variables:
   - `EXPO_PUBLIC_SUPABASE_URL=your_supabase_url`
   - `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`
3. Run: `node setup-storage-permissions.js`

## 🧪 Test the Fix

After applying the fix, upload a video and check for these logs:

### Expected Success Logs:
```
✅ [UPLOAD DEBUG] Upload reported as successful for: video_thumbnail_0pct.jpg
✅ [UPLOAD VERIFICATION] File confirmed in storage: video_thumbnail_0pct.jpg
✅ [THUMBNAIL URL DEBUG] URL accessible for: userId/timestamp_video_thumbnail_0pct.jpg
```

### If Still Failing:
```
❌ [UPLOAD VERIFICATION] File not found in storage after upload
```

## 🔍 Troubleshooting

### Issue: "ERROR: 42501: must be owner of table buckets"
**Solution**: Use Supabase Dashboard instead of SQL Editor, or contact Supabase support to run the SQL as database owner.

### Issue: Files still don't appear after upload
**Potential causes**:
1. **RLS policies too restrictive** - Try the public access policy
2. **Bucket doesn't exist** - Check Storage → Buckets in dashboard  
3. **Service role key missing** - Verify environment variables
4. **Network/CORS issues** - Check browser network tab for errors

### Issue: Presigned URLs not working
**Solution**: Ensure the `videos` and `thumbnails` buckets both exist and have proper policies.

## 📊 Expected Results After Fix

1. **Upload verification succeeds**: Files appear in storage after upload
2. **Directory listings show files**: `actualFiles: ["video_thumbnail_0pct.jpg", ...]`
3. **Thumbnail URLs work**: VideoCard displays real thumbnails instead of placeholders
4. **Home feed shows unique thumbnails**: Each video has different thumbnail based on actual content

## 🎯 Success Criteria

- ✅ Upload verification logs show files confirmed in storage
- ✅ Thumbnail URL generation succeeds with 200 status codes  
- ✅ Home feed displays real video thumbnails (not placeholders)
- ✅ Each video shows unique thumbnail based on actual video frames