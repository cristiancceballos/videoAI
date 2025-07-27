-- Storage Buckets and Policies Setup
-- 1. Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', false) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('thumbnails', 'thumbnails', false) 
ON CONFLICT (id) DO NOTHING;

-- 2. RLS is already enabled on storage tables by default

-- 3. Drop any conflicting policies first
DROP POLICY IF EXISTS "Users can upload videos to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own videos" ON storage.objects;  
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload thumbnails to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view buckets" ON storage.buckets;

-- 4. Create bucket visibility policy
CREATE POLICY "Allow authenticated users to view buckets" ON storage.buckets
FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Create user policies for videos bucket
CREATE POLICY "Users can upload videos to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'videos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. Create user policies for thumbnails bucket
CREATE POLICY "Users can upload thumbnails to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own thumbnails" ON storage.objects
FOR SELECT USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 7. CRITICAL: Create service role policies for Edge Functions
CREATE POLICY "Service role can manage all thumbnails" ON storage.objects
FOR ALL USING (bucket_id = 'thumbnails' AND auth.role() = 'service_role');

CREATE POLICY "Service role can manage all videos" ON storage.objects  
FOR ALL USING (bucket_id = 'videos' AND auth.role() = 'service_role');