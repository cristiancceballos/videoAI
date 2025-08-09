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

-- Note: We'll use direct Edge Function calls instead of queues for MVP
-- This simplifies the setup and avoids pgmq dependency