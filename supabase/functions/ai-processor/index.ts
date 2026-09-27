import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-3.5-flash-lite'

interface QueueMessage {
  videoId: string;
  userId: string;
  audioUrl?: string;
  videoTitle?: string;
}

interface GeminiFile {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

interface VideoAnalysisResult {
  transcript: string;
  language: string;
  summary: string;
  tags: string[];
}

const MULTIMODAL_ANALYSIS_PROMPT = `
Analyze this video and provide:

1. TRANSCRIPT: Complete, accurate transcript of all spoken content. Include all dialogue and narration.
2. LANGUAGE: Detected language code (e.g., 'en', 'es', 'fr')
3. SUMMARY: 1-2 paragraph summary covering main topics and key takeaways. Consider both audio and visual content.
4. TAGS: 5-6 relevant tags following this pattern:
   - 1-2 specific tags about the exact topic/subject
   - 2-3 broader category tags from: education, technology, programming, cooking, fitness, health, motivation, lifestyle, business, science, entertainment, gaming, music, art, travel, sports, diy, tutorial, review, comedy, news
   - 1 mood/tone tag if clearly identifiable from: inspirational, educational, humorous, serious, relaxing, energetic, informative, entertaining, emotional, calming, exciting

Return ONLY valid JSON without any markdown formatting or code blocks:
{
  "transcript": "Full transcript text here...",
  "language": "en",
  "summary": "Your summary here (2-3 paragraphs)...",
  "tags": ["specific_tag1", "specific_tag2", "broad_category1", "broad_category2", "mood_tag"]
}
`

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Gemini API key
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')

    if (!geminiApiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured')
    }

    // Parse request
    const { videoId, userId, audioUrl } = await req.json() as QueueMessage

    console.log(`Processing video ${videoId} for user ${userId}`)

    // Update status to processing
    await supabase
      .from('videos')
      .update({
        ai_status: 'processing',
        ai_error: null
      })
      .eq('id', videoId)

    try {
      // Step 1: Download video from Supabase storage
      console.log('Downloading video from storage...')
      const videoBlob = await downloadVideo(audioUrl!)
      console.log(`Downloaded video: ${videoBlob.size} bytes`)

      // Determine mime type from URL or default to mp4
      const mimeType = getMimeType(audioUrl!)

      // Step 2: Upload video to Gemini Files API
      console.log('Uploading video to Gemini Files API...')
      const uploadedFile = await uploadVideoToGemini(videoBlob, mimeType, geminiApiKey)
      console.log(`Uploaded file: ${uploadedFile.name}, state: ${uploadedFile.state}`)

      // Step 3: Wait for file to be ready (ACTIVE state)
      console.log('Waiting for file processing...')
      await waitForFileReady(uploadedFile.name, geminiApiKey)
      console.log('File is ready for analysis')

      // Step 4: Generate content with unified prompt
      console.log('Generating video analysis...')
      const analysisResult = await generateVideoAnalysis(
        uploadedFile.uri,
        mimeType,
        MULTIMODAL_ANALYSIS_PROMPT,
        geminiApiKey
      )
      console.log('Analysis complete')

      // Step 5: Clean up uploaded file from Gemini
      console.log('Cleaning up Gemini file...')
      await deleteGeminiFile(uploadedFile.name, geminiApiKey)

      // Step 6: Save transcript to database
      await supabase
        .from('transcripts')
        .insert({
          video_id: videoId,
          content: analysisResult.transcript,
          language: analysisResult.language || 'en',
        })

      // Step 7: Save summary to database
      await supabase
        .from('summaries')
        .insert({
          video_id: videoId,
          content: analysisResult.summary,
          model_used: GEMINI_MODEL,
        })

      // Step 8: Get current user_tags to merge with AI tags
      const { data: videoData } = await supabase
        .from('videos')
        .select('user_tags')
        .eq('id', videoId)
        .single()

      const userTags = videoData?.user_tags || []
      const mergedTags = [...new Set([...userTags, ...analysisResult.tags])] // Merge and remove duplicates

      // Step 9: Update video with AI tags and merged tags
      await supabase
        .from('videos')
        .update({
          ai_tags: analysisResult.tags,
          tags: mergedTags,
          ai_status: 'completed',
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', videoId)

      console.log(`Successfully processed video ${videoId}`)

      return new Response(
        JSON.stringify({
          success: true,
          videoId,
          transcript: analysisResult.transcript.substring(0, 100) + '...',
          summary: analysisResult.summary.substring(0, 100) + '...',
          tags: analysisResult.tags
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (processingError) {
      console.error('Processing error:', processingError)

      // Update video with error status
      await supabase
        .from('videos')
        .update({
          ai_status: 'error',
          ai_error: processingError instanceof Error ? processingError.message : 'Unknown error',
        })
        .eq('id', videoId)

      throw processingError
    }
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Download video from Supabase signed URL
async function downloadVideo(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }
  return await response.blob()
}

// Get MIME type from URL
function getMimeType(url: string): string {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'm4v': 'video/x-m4v',
  }
  return mimeTypes[extension || ''] || 'video/mp4'
}

// Upload video to Gemini Files API using resumable upload
async function uploadVideoToGemini(
  videoBlob: Blob,
  mimeType: string,
  apiKey: string
): Promise<GeminiFile> {
  // Step 1: Initiate resumable upload
  // Note: Upload endpoint uses /upload/v1beta/files (not /v1beta/files)
  const initResponse = await fetch(
    'https://generativelanguage.googleapis.com/upload/v1beta/files',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': videoBlob.size.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
      },
      body: JSON.stringify({
        file: {
          displayName: `video-${Date.now()}`
        }
      }),
    }
  )

  if (!initResponse.ok) {
    const errorText = await initResponse.text()
    throw new Error(`Failed to initiate upload: ${errorText}`)
  }

  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) {
    throw new Error('No upload URL returned from Gemini')
  }

  // Step 2: Upload the video content
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': videoBlob.size.toString(),
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    },
    body: videoBlob,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(`Failed to upload video: ${errorText}`)
  }

  const fileInfo = await uploadResponse.json()
  return fileInfo.file as GeminiFile
}

// Wait for Gemini file to be ready (ACTIVE state)
async function waitForFileReady(
  fileName: string,
  apiKey: string,
  maxWaitMs: number = 120000
): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 3000 // 3 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `${GEMINI_API_BASE}/${fileName}?key=${apiKey}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to check file status: ${errorText}`)
    }

    const fileInfo = await response.json() as GeminiFile

    if (fileInfo.state === 'ACTIVE') {
      return
    } else if (fileInfo.state === 'FAILED') {
      throw new Error('Gemini file processing failed')
    }

    // Still processing, wait and try again
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Timeout waiting for Gemini file processing')
}

// Generate video analysis using Gemini multimodal
async function generateVideoAnalysis(
  fileUri: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<VideoAnalysisResult> {
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              fileData: {
                mimeType: mimeType,
                fileUri: fileUri,
              }
            },
            {
              text: prompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        }
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini content generation failed: ${errorText}`)
  }

  const result = await response.json()

  // Extract text from response
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No content generated from Gemini')
  }

  // Parse JSON response
  return parseAnalysisResponse(text)
}

// Parse and validate the analysis response
function parseAnalysisResponse(text: string): VideoAnalysisResult {
  // Clean up common markdown formatting
  let cleanedText = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleanedText)

    return {
      transcript: parsed.transcript || '',
      language: parsed.language || 'en',
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 7) : [],
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', cleanedText)

    // Fallback: try to extract information from text
    return {
      transcript: cleanedText.substring(0, 5000),
      language: 'en',
      summary: cleanedText.substring(0, 500),
      tags: extractBasicTags(cleanedText),
    }
  }
}

// Extract basic tags from text as fallback
function extractBasicTags(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'were'])

  const tagCandidates = words
    .filter(word => word.length > 3 && !commonWords.has(word))
    .filter(word => /^[a-z]+$/.test(word))

  return [...new Set(tagCandidates)].slice(0, 5)
}

// Delete file from Gemini Files API
async function deleteGeminiFile(fileName: string, apiKey: string): Promise<void> {
  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${fileName}?key=${apiKey}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      // Log but don't throw - file cleanup is not critical
      console.warn(`Failed to delete Gemini file: ${await response.text()}`)
    }
  } catch (error) {
    // Log but don't throw - file cleanup is not critical
    console.warn('Error deleting Gemini file:', error)
  }
}
