# FFmpeg Integration Guide

## What FFmpeg Does

FFmpeg is a powerful multimedia framework that enables:

### 🎬 **Video Frame Extraction**
- Extract specific frames from videos at precise timestamps
- Generate thumbnails at 0%, 25%, 50%, 75% of video duration
- Support for all major video formats (MP4, MOV, AVI, WebM, etc.)

### 🖼️ **Image Processing** 
- Resize thumbnails to optimal dimensions (400x225, 160x240, etc.)
- Compress images for web delivery
- Convert between formats (JPEG, PNG, WebP)

### ⚡ **Performance Benefits**
- Industry-standard video processing
- Optimized for server-side execution
- Handles large video files efficiently

## Current vs FFmpeg Implementation

### **Current (Placeholder System):**
```typescript
// Creates colored SVG rectangles with text
const svgContent = `
  <svg width="400" height="225">
    <rect fill="url(#grad)" />
    <text>Frame at 25%</text>
  </svg>
`
```

**Limitations:**
- No actual video frames
- Generic colored placeholders
- No real timestamp information

### **With FFmpeg Integration:**
```typescript
// Real video frame extraction
import { FFmpeg } from '@ffmpeg/ffmpeg'

const ffmpeg = new FFmpeg()
await ffmpeg.load()

// Extract frame at 25% of video duration
const duration = await getVideoDuration(videoBuffer)
const timestamp = duration * 0.25

await ffmpeg.writeFile('input.mp4', videoBuffer)
await ffmpeg.exec([
  '-i', 'input.mp4',
  '-ss', timestamp.toString(),
  '-vframes', '1',
  '-q:v', '2',
  '-s', '400x225',
  'thumbnail_25.jpg'
])

const thumbnailBuffer = await ffmpeg.readFile('thumbnail_25.jpg')
```

**Benefits:**
- Real video frames extracted
- Precise timestamp positioning
- Professional quality output
- Supports all video formats

## Implementation Steps

### **Step 1: Add FFmpeg Dependencies**

Update `supabase/functions/generate-thumbnails/deno.json`:
```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2.39.3",
    "ffmpeg": "https://esm.sh/@ffmpeg/ffmpeg@0.12.7",
    "ffmpeg-core": "https://esm.sh/@ffmpeg/core@0.12.4"
  }
}
```

### **Step 2: Initialize FFmpeg in Edge Function**

```typescript
import { FFmpeg } from 'ffmpeg'
import { fetchFile, toBlobURL } from 'ffmpeg'

let ffmpeg: FFmpeg | null = null

async function initializeFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg()
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm'
    ffmpeg.on('log', ({ message }) => {
      console.log('🎬 [FFMPEG]', message)
    })
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
  }
  return ffmpeg
}
```

### **Step 3: Replace Placeholder Generation**

```typescript
async function extractVideoFrame(
  videoBuffer: Uint8Array, 
  timestamp: number, 
  outputName: string
): Promise<Uint8Array> {
  const ffmpeg = await initializeFFmpeg()
  
  // Write video file to FFmpeg filesystem
  await ffmpeg.writeFile('input.mp4', videoBuffer)
  
  // Extract frame at specific timestamp
  await ffmpeg.exec([
    '-i', 'input.mp4',              // Input video
    '-ss', timestamp.toString(),     // Seek to timestamp
    '-vframes', '1',                // Extract 1 frame
    '-q:v', '2',                    // High quality
    '-s', '400x225',                // Resize to 400x225
    '-f', 'image2',                 // Force image format
    outputName                      // Output filename
  ])
  
  // Read the generated thumbnail
  const data = await ffmpeg.readFile(outputName)
  return data as Uint8Array
}
```

### **Step 4: Calculate Video Duration**

```typescript
async function getVideoDuration(videoBuffer: Uint8Array): Promise<number> {
  const ffmpeg = await initializeFFmpeg()
  
  await ffmpeg.writeFile('probe.mp4', videoBuffer)
  
  // Use ffprobe to get video information
  await ffmpeg.exec([
    '-i', 'probe.mp4',
    '-show_entries', 'format=duration',
    '-v', 'quiet',
    '-of', 'csv=p=0'
  ])
  
  // Parse duration from output (this is simplified)
  // Real implementation would capture ffmpeg output
  return 120 // placeholder - would be parsed from ffmpeg output
}
```

### **Step 5: Generate Multiple Thumbnails**

```typescript
async function generateRealThumbnails(
  videoBuffer: Uint8Array, 
  videoId: string
): Promise<Array<{position: string, blob: Blob}>> {
  const duration = await getVideoDuration(videoBuffer)
  const positions = [
    { percent: 0, label: '0%' },
    { percent: 0.25, label: '25%' },
    { percent: 0.5, label: '50%' },
    { percent: 0.75, label: '75%' }
  ]
  
  const thumbnails = []
  
  for (const pos of positions) {
    const timestamp = duration * pos.percent
    const filename = `thumb_${pos.label.replace('%', '')}.jpg`
    
    const frameBuffer = await extractVideoFrame(
      videoBuffer, 
      timestamp, 
      filename
    )
    
    const blob = new Blob([frameBuffer], { type: 'image/jpeg' })
    thumbnails.push({
      position: pos.label,
      blob: blob
    })
  }
  
  return thumbnails
}
```

## Performance Considerations

### **Memory Management**
- FFmpeg processes can use significant memory
- Clean up temporary files after processing
- Consider processing limits for large videos

### **Processing Time**
- Video processing takes time (10-30 seconds for typical videos)
- Consider timeout limits for Edge Functions
- Add progress indicators for users

### **File Size Limits**
- Edge Functions have memory constraints
- Consider chunked processing for very large files
- Optimize thumbnail sizes for web delivery

## Deployment Steps with FFmpeg

1. **Update Edge Function** with FFmpeg code
2. **Test locally** with `supabase functions serve`
3. **Deploy updated function** with `supabase functions deploy`
4. **Monitor memory usage** and processing times
5. **Optimize** thumbnail sizes and quality settings

## Expected Results

✅ **Real video thumbnails** instead of colored placeholders
✅ **Multiple frame options** at different video positions  
✅ **Professional quality** compressed thumbnails
✅ **Format compatibility** with all major video types
✅ **Optimized file sizes** for fast web loading

## Testing FFmpeg Integration

```bash
# Test with actual video file
curl -X POST 'http://localhost:54321/functions/v1/generate-thumbnails' \
  -H 'Content-Type: application/json' \
  -d '{
    "videoId": "real-video-123",
    "userId": "user-456", 
    "storagePath": "user-456/actual-video.mp4"
  }'

# Check logs for FFmpeg processing
supabase functions logs generate-thumbnails --follow
```

This integration will transform the placeholder system into professional video thumbnail generation!