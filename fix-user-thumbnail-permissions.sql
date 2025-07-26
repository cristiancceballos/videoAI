-- Fix User Thumbnail Upload Permissions
-- This script creates the minimal policies needed for user thumbnail uploads
-- Run this in your Supabase SQL Editor as the database owner

-- 1. Drop existing conflicting policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can upload thumbnails to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow public thumbnail access" ON storage.objects;

-- 2. Create user policies for thumbnails bucket that allow uploads via presigned URLs
-- This policy allows authenticated users to upload thumbnails to their own folder
CREATE POLICY "Users can upload thumbnails to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Allow users to view their own thumbnails
CREATE POLICY "Users can view own thumbnails" ON storage.objects
FOR SELECT USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Allow users to delete their own thumbnails
CREATE POLICY "Users can delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. ALTERNATIVE: If the above doesn't work, try allowing public access to thumbnails
-- Uncomment the lines below if the folder-based approach fails
/*
CREATE POLICY "Allow public thumbnail access" ON storage.objects
FOR ALL USING (bucket_id = 'thumbnails');
*/

-- 6. Verify the policies were created
SELECT 'Thumbnail Policies Created:' as status;  
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%thumbnail%'
ORDER BY policyname;

-- 7. Test if the thumbnails bucket exists and is accessible
SELECT 'Thumbnails Bucket Status:' as status;
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'thumbnails';