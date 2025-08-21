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
  apiKey: string
): Promise<{ summary: string; tags: string[] }> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
    Analyze the following video transcript and provide:
    1. A concise summary (2-3 paragraphs) based ONLY on the transcript content
    2. Generate 5-7 relevant tags following this pattern:
       - 1-2 specific tags about the exact topic/subject
       - 2-3 broader category tags from: education, technology, programming, cooking, 
         fitness, health, motivation, lifestyle, business, science, entertainment, 
         gaming, music, art, travel, sports, diy, tutorial, review, comedy, news
       - 1 mood/tone tag if clearly identifiable from: inspirational, educational, humorous, 
         serious, relaxing, energetic, informative, entertaining, emotional, calming, exciting
       - Only include mood tag if it's clearly present in the content
    
    Example patterns:
    - Cooking video: ["pasta recipes", "italian cuisine", "cooking", "food", "lifestyle", "relaxing"]
    - Programming video: ["react hooks", "web development", "programming", "technology", "education", "informative"]
    - Workout video: ["hiit workout", "cardio", "fitness", "health", "lifestyle", "energetic"]
    - Motivational speech: ["success mindset", "personal growth", "motivation", "education", "lifestyle", "inspirational"]
    
    Transcript:
    ${transcript}

    IMPORTANT: Return ONLY valid JSON without any markdown formatting or code blocks.
    Format your response as plain JSON:
    {
      "summary": "Your summary here",
      "tags": ["specific_tag1", "specific_tag2", "broad_category1", "broad_category2", "mood_tag_if_applicable"]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  let text = response.text()

  // Clean up common markdown formatting
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(text)
    return {
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 7) : [], // Limit to 7 tags
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', text)
    // Fallback if not valid JSON
    return {
      summary: text.substring(0, 500),
      tags: extractBasicTags(text).slice(0, 7),
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
