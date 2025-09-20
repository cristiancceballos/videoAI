# Audio Extraction Implementation Plan

## Overview
This document outlines the implementation plan for extracting audio from video files before sending to OpenAI's Whisper API. This will allow AI processing for all videos up to 50MB (Supabase limit) instead of being limited by Whisper's 25MB file size restriction.

## Current Problem
- **Current Flow**: Entire video file is sent to Whisper API
- **Limitation**: Whisper rejects files > 25MB
- **Impact**: Videos between 25-50MB can be uploaded but don't get AI summaries/tags

## Proposed Solution
Extract only the audio track from videos before sending to Whisper, significantly reducing file size.

## Benefits
- ✅ **AI processing for all videos under 50MB**: Audio tracks are typically 5-10% of video size
- ✅ **Faster processing**: Smaller files = faster uploads to Whisper
- ✅ **Cost savings**: Less bandwidth usage
- ✅ **Better reliability**: Less likely to timeout with smaller files

## Implementation Approaches

### Option 1: FFmpeg in Edge Function (Recommended)
Use FFmpeg.wasm (WebAssembly version) in the Supabase Edge Function.

#### Implementation Steps:
1. Install FFmpeg.wasm in Edge Function:
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
```

2. Modify `ai-processor/index.ts`:
```typescript
async function extractAudioFromVideo(videoUrl: string): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  
  // Download video
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile('input.mp4', videoData);
  
  // Extract audio (compress to reduce size further)
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vn',  // No video
    '-acodec', 'mp3',  // Convert to MP3
    '-b:a', '96k',  // Bitrate (lower = smaller file)
    'output.mp3'
  ]);
  
  const audioData = await ffmpeg.readFile('output.mp3');
  return new Blob([audioData.buffer], { type: 'audio/mp3' });
}
```

3. Update the transcription flow:
```typescript
// Instead of sending video directly
const audioBlob = await extractAudioFromVideo(audioUrl);
const formData = new FormData();
formData.append('file', audioBlob, 'audio.mp3');
// Continue with Whisper API call
```

### Option 2: Separate Audio Processing Service
Create a dedicated service for audio extraction using a Docker container with FFmpeg.

#### Architecture:
```
Video Upload → Supabase Storage 
    ↓
Trigger Audio Extraction Service (Docker/Cloud Run)
    ↓
Extract Audio → Temporary Storage
    ↓
Send Audio URL to AI Processor
    ↓
Whisper Transcription
```

### Option 3: Client-Side Audio Extraction
Extract audio on the client before upload (not recommended due to performance).

## File Size Calculations

| Video Size | Estimated Audio Size | Whisper Compatible |
|------------|---------------------|-------------------|
| 10 MB      | ~1 MB               | ✅ Yes            |
| 25 MB      | ~2.5 MB             | ✅ Yes            |
| 40 MB      | ~4 MB               | ✅ Yes            |
| 50 MB      | ~5 MB               | ✅ Yes            |

## Technical Requirements

### FFmpeg.wasm Requirements:
- Edge Function memory: ~512MB minimum
- Processing time: ~5-10 seconds for 50MB video
- Dependencies: @ffmpeg/ffmpeg, @ffmpeg/util

### FFmpeg Command Options:
```bash
# Basic audio extraction
ffmpeg -i input.mp4 -vn -acodec copy output.m4a

# Compressed MP3 (smaller file)
ffmpeg -i input.mp4 -vn -acodec mp3 -b:a 96k output.mp3

# Even smaller (mono, lower quality, but fine for transcription)
ffmpeg -i input.mp4 -vn -acodec mp3 -ac 1 -b:a 64k output.mp3
```

## Implementation Checklist

- [ ] Test FFmpeg.wasm compatibility with Supabase Edge Functions
- [ ] Implement audio extraction function
- [ ] Add error handling for extraction failures
- [ ] Update AI processor to use extracted audio
- [ ] Add file size validation before extraction
- [ ] Implement cleanup (delete temporary files)
- [ ] Add logging/monitoring
- [ ] Update UI to show "Extracting audio..." status
- [ ] Test with various video formats (mp4, mov, webm)
- [ ] Performance testing with 50MB videos

## Fallback Strategy

For videos where audio extraction fails:
1. Try direct video upload (current method)
2. If > 25MB, mark as "Too large for AI processing"
3. Log the failure for debugging

## Expected Outcomes

After implementation:
- **Before**: Only videos ≤ 25MB get AI summaries
- **After**: All videos ≤ 50MB get AI summaries
- **Performance**: ~5-10 second overhead for audio extraction
- **Success Rate**: Expected 95%+ success rate for supported formats

## Future Enhancements

1. **Chunked Processing**: For very long videos, process audio in chunks
2. **Format Detection**: Auto-detect optimal audio codec based on source
3. **Caching**: Cache extracted audio for re-processing
4. **Progressive Enhancement**: Start transcription while audio is still extracting

## References

- [FFmpeg.wasm Documentation](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [OpenAI Whisper API Limits](https://platform.openai.com/docs/guides/speech-to-text)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)