-- Complete database setup with Cloudinary thumbnail support
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create videos table with Cloudinary columns
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'error')),
  duration INTEGER,
  file_size BIGINT,
  source_type TEXT DEFAULT 'device' CHECK (source_type IN ('device', 'youtube', 'tiktok')),
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  original_filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add thumb_status enum type
DO $$ BEGIN
  CREATE TYPE thumb_status_enum AS ENUM ('pending', 'processing', 'ready', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add Cloudinary columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS thumb_status thumb_status_enum DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS cloudinary_url TEXT,
ADD COLUMN IF NOT EXISTS thumb_error_message TEXT;

-- Create transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  confidence_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  model_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-ada-002 dimensions
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Videos policies
DROP POLICY IF EXISTS "Users can view their own videos" ON videos;
CREATE POLICY "Users can view their own videos" ON videos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own videos" ON videos;
CREATE POLICY "Users can insert their own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own videos" ON videos;
CREATE POLICY "Users can update their own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own videos" ON videos;
CREATE POLICY "Users can delete their own videos" ON videos
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policies for video updates (needed for thumbnail processing)
DROP POLICY IF EXISTS "Service role can update videos" ON videos;
CREATE POLICY "Service role can update videos" ON videos
  FOR UPDATE USING (true);

-- Transcripts policies
DROP POLICY IF EXISTS "Users can view transcripts of their videos" ON transcripts;
CREATE POLICY "Users can view transcripts of their videos" ON transcripts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM videos WHERE id = transcripts.video_id
    )
  );

DROP POLICY IF EXISTS "Service role can insert transcripts" ON transcripts;
CREATE POLICY "Service role can insert transcripts" ON transcripts
  FOR INSERT WITH CHECK (true);

-- Summaries policies
DROP POLICY IF EXISTS "Users can view summaries of their videos" ON summaries;
CREATE POLICY "Users can view summaries of their videos" ON summaries
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM videos WHERE id = summaries.video_id
    )
  );

DROP POLICY IF EXISTS "Service role can insert summaries" ON summaries;
CREATE POLICY "Service role can insert summaries" ON summaries
  FOR INSERT WITH CHECK (true);

-- Notes policies
DROP POLICY IF EXISTS "Users can manage their own notes" ON notes;
CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

-- Embeddings policies
DROP POLICY IF EXISTS "Users can view embeddings of their videos" ON embeddings;
CREATE POLICY "Users can view embeddings of their videos" ON embeddings
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM videos WHERE id = embeddings.video_id
    )
  );

DROP POLICY IF EXISTS "Service role can manage embeddings" ON embeddings;
CREATE POLICY "Service role can manage embeddings" ON embeddings
  FOR ALL WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_thumb_status ON videos(thumb_status);
CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_summaries_video_id ON summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_notes_video_id ON notes(video_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_video_id ON embeddings(video_id);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add comments for documentation
COMMENT ON COLUMN videos.thumb_status IS 'Status of thumbnail generation: pending, processing, ready, error';
COMMENT ON COLUMN videos.cloudinary_url IS 'Direct URL to Cloudinary-generated thumbnail';
COMMENT ON COLUMN videos.thumb_error_message IS 'Error message if thumbnail generation failed';

-- Update existing videos to have pending status
UPDATE videos SET thumb_status = 'pending' WHERE thumb_status IS NULL;