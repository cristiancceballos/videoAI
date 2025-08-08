import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueMessage {
  videoId: string;
  userId: string;
  audioUrl?: string;
  videoTitle?: string;
}

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

    // Initialize AI services
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')

    if (!openaiApiKey || !geminiApiKey) {
      throw new Error('AI API keys not configured')
    }

    // Parse request
    const { videoId, userId, audioUrl, videoTitle } = await req.json() as QueueMessage

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
      // Step 1: Transcribe audio using Whisper
      console.log('Starting transcription...')
      const transcription = await transcribeAudio(audioUrl!, openaiApiKey)
      
      // Save transcript
      await supabase
        .from('transcripts')
        .insert({
          video_id: videoId,
          content: transcription.text,
          language: transcription.language || 'en',
        })

      // Step 2: Generate summary and tags using Gemini
      console.log('Generating summary and tags...')
      const { summary, tags } = await generateSummaryAndTags(
        transcription.text,
        videoTitle,
        geminiApiKey
      )

      // Save summary
      await supabase
        .from('summaries')
        .insert({
          video_id: videoId,
          content: summary,
          model_used: 'gemini-1.5-flash',
        })

      // Update video with tags and completion status
      await supabase
        .from('videos')
        .update({
          tags: tags,
          ai_status: 'completed',
          ai_processed_at: new Date().toISOString(),
        })
        .eq('id', videoId)

      console.log(`Successfully processed video ${videoId}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          videoId,
          transcript: transcription.text.substring(0, 100) + '...',
          summary: summary.substring(0, 100) + '...',
          tags
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

async function transcribeAudio(audioUrl: string, apiKey: string): Promise<{ text: string; language?: string }> {
  // Download audio file
  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`)
  }

  const audioBlob = await response.blob()
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.mp3')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'json')

  // Call Whisper API
  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!whisperResponse.ok) {
    const error = await whisperResponse.text()
    throw new Error(`Whisper API error: ${error}`)
  }

  const result = await whisperResponse.json()
  
  return {
    text: result.text,
    language: result.language,
  }
}

async function generateSummaryAndTags(
  transcript: string,
  videoTitle: string | undefined,
  apiKey: string
): Promise<{ summary: string; tags: string[] }> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
    Analyze the following video transcript and provide:
    1. A concise summary (2-3 paragraphs)
    2. 5-10 relevant tags for categorization

    ${videoTitle ? `Video Title: ${videoTitle}` : ''}
    
    Transcript:
    ${transcript}

    Format your response as JSON with the following structure:
    {
      "summary": "Your summary here",
      "tags": ["tag1", "tag2", ...]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(text)
    return {
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch {
    // Fallback if not valid JSON
    return {
      summary: text.substring(0, 500),
      tags: extractBasicTags(text),
    }
  }
}

function extractBasicTags(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])
  
  const tagCandidates = words
    .filter(word => word.length > 3 && !commonWords.has(word))
    .filter(word => /^[a-z]+$/.test(word))

  return [...new Set(tagCandidates)].slice(0, 10)
}
