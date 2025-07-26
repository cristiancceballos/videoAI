-- Storage bucket policies to fix bucket access issues
-- Run this in your Supabase SQL Editor

-- Enable RLS on storage.buckets (if not already enabled)
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view bucket information
-- This policy allows the app to see that buckets exist
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view buckets" ON storage.buckets
FOR SELECT USING (auth.role() = 'authenticated');

-- Make sure storage.objects has RLS enabled
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

CREATE POLICY IF NOT EXISTS "Users can delete own videos" ON storage.objects
FOR DELETE USING (
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

CREATE POLICY IF NOT EXISTS "Users can delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role policies for Edge Functions
-- Edge Functions use service role which needs special permissions
CREATE POLICY IF NOT EXISTS "Service role can manage all thumbnails" ON storage.objects
FOR ALL USING (bucket_id = 'thumbnails' AND auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage all videos" ON storage.objects  
FOR ALL USING (bucket_id = 'videos' AND auth.role() = 'service_role');

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('buckets', 'objects') 
AND schemaname = 'storage';