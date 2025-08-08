-- Add AI processing fields to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending' 
  CHECK (ai_status IN ('pending', 'processing', 'completed', 'error')),
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_error TEXT,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_videos_ai_status ON videos(ai_status);

-- Create AI processing queue
DO $$
BEGIN
  -- Check if pgmq extension is installed
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
    -- Create queue if it doesn't exist
    PERFORM pgmq.create_non_partitioned('ai_processing');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Queue might already exist, that's fine
    NULL;
END $$;

-- Add RLS policies for AI fields (users can read their own AI data)
-- Note: Service role will be used for updates from Edge Functions
CREATE POLICY "Users can view AI data for their videos" ON videos
  FOR SELECT 
  USING (auth.uid() = user_id);