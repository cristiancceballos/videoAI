# 🚀 Quick Fix for Storage Bucket Access

## Problem
Your buckets exist but the app can't access them due to missing permissions.

## Solution: Run This SQL in Supabase

1. **Go to your Supabase Dashboard**
2. **Open SQL Editor**
3. **Copy and paste this code:**

```sql
-- Fix storage bucket access permissions
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow authenticated users to view buckets" ON storage.buckets
FOR SELECT USING (auth.role() = 'authenticated');

-- Ensure storage.objects policies exist
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Videos bucket policies
CREATE POLICY IF NOT EXISTS "Users can upload videos to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can view own videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Thumbnails bucket policies  
CREATE POLICY IF NOT EXISTS "Users can upload thumbnails to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "Users can view own thumbnails" ON storage.objects
FOR SELECT USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

4. **Click "Run"**
5. **Refresh your app in the browser**
6. **Click "🔄 Run Diagnostics"**

## Expected Result
You should now see:
```
✅ Environment: Variables
✅ Database: Connection  
✅ Storage: Buckets
✅ Auth: Service
```

## If You Still Have Issues
Check the browser console (F12 → Console tab) for detailed error messages and let me know what you see!