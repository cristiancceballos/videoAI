# VideoAI - Phase 3: AI Integration Plan

## Overview
This document outlines the implementation plan for integrating AI-powered video summarization and tagging into VideoAI, enabling users to automatically generate summaries and searchable tags for their uploaded videos.

## MVP Phase 1: Basic Transcription & Summarization

### Architecture Overview
1. **Direct Video Processing** - Whisper API supports MP4 files directly (up to 25MB)
2. **Supabase Queue System** - Background processing using pgmq extension  
3. **Edge Functions** - Coordinate AI API calls and database updates

### Implementation Steps

#### 1. Database Setup
- Use existing `transcripts` and `summaries` tables (already in schema)
- Add `tags` column to videos table (JSON array for simplicity in MVP)
- Add AI processing status fields to videos table:
  ```sql
  ALTER TABLE videos ADD COLUMN ai_status TEXT DEFAULT 'pending' 
    CHECK (ai_status IN ('pending', 'processing', 'completed', 'error'));
  ALTER TABLE videos ADD COLUMN tags JSONB DEFAULT '[]';
  ALTER TABLE videos ADD COLUMN ai_error TEXT;
  ```

#### 2. Queue System
- Enable Supabase Queues in dashboard
- Create `ai-processing` queue
- Trigger queue job when video upload completes

#### 3. Edge Function Workflow
```
Video Upload → Queue Job → Edge Function → Whisper API → GPT-4o → Update DB
```

#### 4. AI Processing Flow
1. Download video from Supabase Storage (temporary URL)
2. Send to Whisper API for transcription ($0.006/minute)
3. Use GPT-4o to generate summary from transcript ($3/1M input, $10/1M output)
4. Extract 5-10 relevant tags from summary
5. Store everything in database

### Cost Estimates
- 10-minute video: ~$0.074 total
  - Whisper: $0.06 (10 min × $0.006)
  - GPT-4o: ~$0.014 (assuming ~3k tokens)
- Well within budget for <10 users

## Handling Videos Over 25MB

### Option 1: Client-Side Compression (Recommended)
**Approach**: Compress video on client before upload
```javascript
// Use browser-based video compression
const compressVideo = async (file: File): Promise<File> => {
  // Options:
  // 1. Use video.js with custom encoding settings
  // 2. Use WebCodecs API (modern browsers)
  // 3. Use libraries like ffmpeg.wasm
  
  // Target: 720p, 30fps, lower bitrate
  // This typically reduces file size by 60-80%
}
```

**Pros**: 
- Works within existing architecture
- No additional backend services
- Faster uploads for users

**Cons**: 
- Processing burden on client device
- May impact mobile performance

### Option 2: Audio-Only Extraction (Most Efficient)
**Approach**: Extract audio track for transcription
```javascript
// Edge Function approach
const extractAudioForTranscription = async (videoUrl: string) => {
  // Use external service or Lambda function with ffmpeg
  // Convert to MP3/M4A at 64kbps mono
  // 10-minute audio ≈ 5MB (well under 25MB limit)
}
```

**Implementation Options**:
1. **Trigger.dev Integration** (Recommended)
   - Set up Trigger.dev worker with ffmpeg
   - Process: Video → Audio → Whisper
   - Cost: ~$20/month for starter plan

2. **AWS Lambda Layer**
   - Deploy Lambda with ffmpeg layer
   - Triggered by Supabase webhook
   - Cost: ~$0.0002 per invocation

3. **Cloudflare Workers + R2**
   - Use Workers for processing
   - Store temp files in R2
   - Cost: Minimal with free tier

### Option 3: Chunked Processing
**Approach**: Split video into smaller segments
```javascript
// Process video in chunks
const processLargeVideo = async (videoFile: File) => {
  const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks
  const chunks = splitVideo(videoFile, CHUNK_SIZE);
  
  const transcripts = await Promise.all(
    chunks.map(chunk => whisperAPI.transcribe(chunk))
  );
  
  return mergeTranscripts(transcripts);
}
```

**Pros**: Works with existing APIs
**Cons**: Complex transcript merging, potential context loss

### Option 4: Alternative Transcription Services
**Services that handle larger files**:
1. **AssemblyAI** 
   - 5GB file limit
   - $0.65/hour (competitive)
   - Direct video support

2. **Rev.ai**
   - 2GB file limit  
   - $0.02/minute
   - High accuracy

3. **AWS Transcribe**
   - 2GB file limit
   - $0.024/minute
   - Integrated with S3

## Phase 2: Enhanced Search with Tags

### Tag Implementation
```sql
-- Create GIN index for fast JSON searches
CREATE INDEX idx_videos_tags ON videos USING GIN (tags);

-- Enable fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_videos_title_trgm ON videos USING GIN (title gin_trgm_ops);
```

### Search Features
- Tag-based filtering
- Full-text search on titles/descriptions
- Fuzzy matching for typos
- Combined tag + text search

## Phase 3: Vision Fallback (Future Enhancement)

### For Silent/Visual Videos
1. **Detect Low Audio**
   - Check audio levels in first 30 seconds
   - Flag videos with <10% audio content

2. **Vision Processing**
   - Extract keyframes (every 10 seconds)
   - Use GPT-4 Vision or Gemini Vision
   - Generate visual-based summary

3. **Cost Optimization**
   - Process only first 2 minutes for preview
   - Let users request full analysis

## Recommended Implementation Path

### Week 1: Core Infrastructure
1. Set up Supabase Queues
2. Create Edge Function skeleton
3. Add database columns
4. Implement Trigger.dev for audio extraction

### Week 2: AI Integration  
1. Integrate Whisper API
2. Integrate GPT-4o for summaries
3. Implement tag extraction
4. Error handling & retries

### Week 3: UI Updates
1. Show AI processing status
2. Display summaries in video details
3. Implement tag display
4. Make search bar functional

### Week 4: Testing & Optimization
1. Test with various video types
2. Optimize for cost
3. Handle edge cases
4. Deploy to production

## Environment Variables to Add
```bash
# AI Services
OPENAI_API_KEY=sk-...
TRIGGER_DEV_API_KEY=... # If using Trigger.dev
AWS_LAMBDA_ENDPOINT=... # If using Lambda

# Feature Flags
ENABLE_AI_PROCESSING=true
MAX_VIDEO_SIZE_MB=100
```

## Success Metrics
- 95% successful transcription rate
- <2 minute processing time for 10-min videos
- <$0.10 cost per video
- 80% accuracy in tag generation

## Future Enhancements
1. Multi-language support
2. Speaker diarization
3. Sentiment analysis
4. Auto-generated chapters
5. Video highlights/clips
6. Q&A chatbot per video