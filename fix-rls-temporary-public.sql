-- TEMPORARY PUBLIC ACCESS FIX
-- If the simplified authenticated policies still don't work,
-- this creates a temporary public access policy for testing

-- WARNING: This makes thumbnails publicly accessible
-- Use only for testing, then implement proper security later

-- 1. Drop all existing thumbnail policies
DROP POLICY IF EXISTS "Allow authenticated users to upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload thumbnails to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;

-- 2. Create a single, permissive policy for testing
CREATE POLICY "Allow all operations on thumbnails bucket" ON storage.objects
FOR ALL USING (bucket_id = 'thumbnails');

-- 3. Keep service role policy
CREATE POLICY "Service role can manage all thumbnails" ON storage.objects
FOR ALL USING (bucket_id = 'thumbnails' AND auth.role() = 'service_role');

-- 4. Verify
SELECT 'TEMPORARY PUBLIC POLICY ACTIVE' as warning;
SELECT 'Test video upload now - thumbnails should work' as next_step;

-- 5. Show active policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%thumbnail%';

-- NOTE: If this fixes the issue, we can then implement proper security
-- The goal is to first confirm the RLS policies were the blocker