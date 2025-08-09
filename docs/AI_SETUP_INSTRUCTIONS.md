# AI Integration Setup Instructions

## Prerequisites

Before running the AI features, you need to set up the following services:

### 1. Google AI Studio (Gemini) - FREE
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Get API key" in the left sidebar
4. Create a new API key
5. Copy the key (starts with `AIza...`)

### 2. OpenAI (Whisper)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API keys section
4. Create a new secret key
5. Copy the key (starts with `sk-...`)

### 3. Supabase Configuration

#### Run Database Migration
```bash
npx supabase db push
```

#### Set Edge Function Secrets
```bash
# Set your API keys as Edge Function secrets
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set GOOGLE_AI_API_KEY=AIza...
```

#### Deploy Edge Function
```bash
npx supabase functions deploy ai-processor
```

### 4. Trigger.dev Setup (Optional - For Videos > 25MB)

**Note**: For MVP with videos under 25MB, this step is optional. The system will process videos directly.

For production with larger videos:
1. Create account at [trigger.dev](https://trigger.dev)
2. Create a new project
3. Install CLI: `npm install -g @trigger.dev/cli`
4. Initialize in project: `npx trigger.dev@latest init`
5. Follow the setup wizard

Create a new task file `trigger/audio-extractor.ts`:

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

export const extractAudio = task({
  id: "extract-audio",
  run: async (payload: { videoUrl: string; videoId: string }) => {
    // This is where you'd implement audio extraction
    // For now, we'll pass through the video URL
    // In production, you'd use ffmpeg here
    
    console.log(`Extracting audio from video ${payload.videoId}`);
    
    // For testing, return the original video URL
    // Whisper can handle MP4 directly up to 25MB
    return {
      audioUrl: payload.videoUrl,
      format: 'mp4',
      duration: 0 // Would be calculated
    };
  },
});
```

Deploy your Trigger.dev project:
```bash
npx trigger.dev@latest deploy
```

## How It Works

1. **Automatic Processing**: When you upload a video, AI processing starts automatically
2. **Status Tracking**: The video grid shows AI status with icons:
   - 🟠 Orange spinner = Processing
   - ✨ Green sparkle = Completed
   - ❌ Red alert = Error

## Testing the Integration

### 1. Test Locally
```bash
# Start Supabase locally
npx supabase start

# In another terminal, serve functions with environment variables
npx supabase functions serve ai-processor --env-file .env.local
```

Create `.env.local` file:
```
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
```

### 2. Test with a Video
1. Upload a video through the app (< 25MB for now)
2. AI processing will start automatically
3. Check Supabase Dashboard → Table Editor → videos
4. Look for `ai_status` column changing from 'pending' → 'processing' → 'completed'
5. Check `transcripts` and `summaries` tables for results

### 3. Manual Testing
You can manually trigger AI processing by calling the Edge Function:

```bash
curl -X POST http://localhost:54321/functions/v1/ai-processor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "your-video-id",
    "userId": "your-user-id",
    "audioUrl": "https://your-video-url",
    "videoTitle": "Test Video"
  }'
```

## Monitoring

1. **Edge Function Logs**: Check Supabase Dashboard → Functions → Logs
2. **Queue Status**: Check pgmq tables in Database
3. **AI Status**: Monitor `ai_status` column in videos table

## Troubleshooting

### Common Issues

1. **"AI API keys not configured"**
   - Make sure you've set the secrets using `supabase secrets set`

2. **Whisper API errors**
   - Check your OpenAI API key is valid
   - Ensure you have credits in your OpenAI account

3. **Gemini API errors**
   - Verify your Google AI API key
   - Check rate limits (15 requests/minute for free tier)

4. **Video too large**
   - Videos over 25MB need audio extraction
   - Implement Trigger.dev task for production

## Cost Optimization

- **Gemini Free Tier**: 1,500 requests/day
- **Whisper**: $0.006/minute of audio
- **Total per video**: ~$0.06 (10-minute video)

## Next Steps

1. Implement proper audio extraction with Trigger.dev + ffmpeg
2. Add retry logic for failed processing
3. Implement webhook to auto-trigger on upload
4. Add user notifications when processing completes