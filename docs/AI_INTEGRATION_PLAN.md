# VideoAI - AI Integration

## Current Implementation (September 2026)

### Architecture Overview
The AI integration uses **Google Gemini 3.5 Flash Lite** multimodal capabilities to process videos directly. This replaced the previous OpenAI Whisper + Gemini combo approach.

```
Video Upload → Supabase Storage → Edge Function → Gemini Files API → Gemini generateContent → Database
```

### How It Works
1. **Video Upload**: User uploads video to Supabase Storage (up to 100MB)
2. **Edge Function Triggered**: `ai-processor` edge function is invoked with video details
3. **Download Video**: Edge function downloads video from Supabase using signed URL
4. **Gemini Files API Upload**: Video uploaded to Gemini's temporary storage (resumable upload)
5. **Wait for Processing**: Poll until file state is `ACTIVE`
6. **Multimodal Analysis**: Single `generateContent` call analyzes video and returns:
   - Complete transcript of spoken content
   - Language detection (e.g., 'en', 'es', 'fr')
   - 1-2 paragraph summary considering both audio and visual content
   - 5-6 relevant tags (specific topics + categories + mood)
7. **Database Storage**: Results saved to `transcripts`, `summaries` tables; tags merged into `videos` table
8. **Cleanup**: Temporary file deleted from Gemini (auto-deletes after 48 hours anyway)

### Key Files
| File | Purpose |
|------|---------|
| `supabase/functions/ai-processor/index.ts` | Edge function handling all AI processing |
| `src/services/webUploadService.ts` | Triggers AI processing after upload |

### Edge Function Flow
```typescript
// Simplified flow in ai-processor/index.ts
1. downloadVideo(signedUrl)           // Get video blob from Supabase
2. uploadVideoToGemini(blob, mimeType) // Upload to Gemini Files API
3. waitForFileReady(fileName)          // Poll until ACTIVE
4. generateVideoAnalysis(fileUri)      // Single multimodal API call
5. deleteGeminiFile(fileName)          // Cleanup
6. Save to database                    // transcripts, summaries, videos tables
```

### Environment Variables
```bash
# Required (set in Supabase Edge Function secrets)
GOOGLE_AI_API_KEY=your_gemini_api_key

# Automatic (provided by Supabase)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### Database Schema
```sql
-- AI status tracking on videos table
ai_status: 'pending' | 'processing' | 'completed' | 'error'
ai_tags: string[]           -- AI-generated tags
user_tags: string[]         -- User-added tags  
tags: string[]              -- Merged (ai_tags + user_tags)
ai_error: string            -- Error message if failed
ai_processed_at: timestamp  -- When processing completed

-- Separate tables
transcripts: video_id, content, language
summaries: video_id, content, model_used
```

### Advantages Over Previous Implementation
| Aspect | Old (Whisper + Gemini) | New (Gemini Multimodal) |
|--------|------------------------|-------------------------|
| API Calls | 2 (Whisper → Gemini) | 1 (Gemini only) |
| Max Video Size | 25MB | 100MB |
| Dependencies | OpenAI + Google | Google only |
| Analysis | Audio only | Audio + Visual |
| Cost | ~$0.07/10-min video | Free tier available |

---

## Historical Reference

<details>
<summary>Original Plan (August 2025) - Archived</summary>

The original implementation used:
- **OpenAI Whisper API** for transcription (25MB limit, $0.006/minute)
- **Google Gemini 1.5 Flash** for summarization and tagging

The original approach required complex workarounds for videos >25MB. The new approach uses Gemini’s multimodal capabilities to process videos directly, supporting files up to 2GB while eliminating the need for multiple tools.
</details>
