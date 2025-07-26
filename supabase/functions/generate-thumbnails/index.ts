// Supabase Edge Function for generating video thumbnails
// This function processes uploaded videos and generates thumbnail options

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { FFmpeg } from 'ffmpeg'
import { fetchFile, toBlobURL } from 'ffmpeg-util'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("🚀 Generate Thumbnails Edge Function starting...")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 [EDGE DEBUG] Thumbnail generation request received')
    
    // Initialize Supabase client with environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [EDGE DEBUG] Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { videoId, userId, storagePath } = await req.json()
    
    console.log('📋 [EDGE DEBUG] Request data:', { 
      videoId, 
      userId, 
      storagePath: storagePath?.substring(0, 50) + '...' 
    })

    if (!videoId || !userId || !storagePath) {
      console.error('❌ [EDGE DEBUG] Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: videoId, userId, storagePath' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Download video file from storage
    console.log('📥 [EDGE DEBUG] Downloading video file from storage...')
    const { data: videoFile, error: downloadError } = await supabaseClient.storage
      .from('videos')
      .download(storagePath)

    if (downloadError || !videoFile) {
      console.error('❌ [EDGE DEBUG] Failed to download video:', downloadError)
      return new Response(
        JSON.stringify({ error: 'Failed to download video file', details: downloadError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ [EDGE DEBUG] Video file downloaded successfully, size:', videoFile.size)

    // Convert blob to array buffer for processing
    const videoBuffer = await videoFile.arrayBuffer()
    const videoUint8Array = new Uint8Array(videoBuffer)

    console.log('🎬 [EDGE DEBUG] Starting thumbnail generation process...')

    // Generate multiple thumbnail options using FFmpeg WASM
    const thumbnailOptions = await generateThumbnailOptions(videoUint8Array, videoId)

    if (!thumbnailOptions || thumbnailOptions.length === 0) {
      console.error('❌ [EDGE DEBUG] Failed to generate any thumbnails')
      return new Response(
        JSON.stringify({ error: 'Failed to generate thumbnails' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🖼️ [EDGE DEBUG] Generated', thumbnailOptions.length, 'thumbnail options')

    // Upload thumbnails to storage
    const uploadedThumbnails = []
    for (let i = 0; i < thumbnailOptions.length; i++) {
      const thumbnail = thumbnailOptions[i]
      // Create URL-safe filename - remove any potentially problematic characters
      const safePosition = thumbnail.position.replace(/[^a-zA-Z0-9]/g, '')
      const filename = `${videoId}_thumbnail_${safePosition}.jpg`
      
      console.log(`📤 [EDGE DEBUG] Uploading thumbnail ${i + 1}/${thumbnailOptions.length}: ${filename}`)
      console.log(`🔧 [VALIDATION DEBUG] Original position: ${thumbnail.position}, Safe position: ${safePosition}`)
      console.log(`📊 [EDGE DEBUG] Upload details:`, {
        bucket: 'thumbnails',
        path: `${userId}/${filename}`,
        blobSize: thumbnail.blob.size,
        blobType: thumbnail.blob.type,
        contentType: 'image/svg+xml',
        userId: userId,
        filename: filename
      })
      
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('thumbnails')
        .upload(`${userId}/${filename}`, thumbnail.blob, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (uploadError) {
        console.error(`❌ [EDGE DEBUG] Failed to upload thumbnail ${i + 1}:`, uploadError)
        console.error(`❌ [EDGE DEBUG] Upload error details:`, JSON.stringify(uploadError, null, 2))
        console.error(`❌ [EDGE DEBUG] Upload error message:`, uploadError.message)
        console.error(`❌ [EDGE DEBUG] Upload path attempted:`, `${userId}/${filename}`)
        continue
      }

      uploadedThumbnails.push({
        position: thumbnail.position,
        path: uploadData.path,
        filename: filename
      })
    }

    console.log('✅ [EDGE DEBUG] Successfully uploaded', uploadedThumbnails.length, 'thumbnails')
    console.log('📋 [EDGE DEBUG] Thumbnail details:', uploadedThumbnails)

    // Update video record with thumbnail information
    // Note: Only updating existing columns - thumbnail_path and status
    console.log('💾 [EDGE DEBUG] Starting database update for video:', videoId)
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        thumbnail_path: uploadedThumbnails[0]?.path || null, // Default to first thumbnail (0% position)
        status: 'ready' // Update status to ready since thumbnails are generated
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('❌ [EDGE DEBUG] Failed to update video record:', updateError)
      console.error('❌ [EDGE DEBUG] Update error details:', JSON.stringify(updateError, null, 2))
      return new Response(
        JSON.stringify({ error: 'Failed to update video record', details: updateError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ [EDGE DEBUG] Successfully updated video record in database')

    console.log('🎉 [EDGE DEBUG] Thumbnail generation completed successfully!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnails: uploadedThumbnails,
        message: `Generated ${uploadedThumbnails.length} thumbnail options`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 [EDGE DEBUG] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Global FFmpeg instance to avoid repeated initialization
let ffmpegInstance: FFmpeg | null = null

// Initialize FFmpeg WASM
async function initializeFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    console.log('🔧 [FFMPEG] Initializing FFmpeg WASM...')
    ffmpegInstance = new FFmpeg()
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm'
    
    ffmpegInstance.on('log', ({ message }) => {
      console.log('🎬 [FFMPEG]', message)
    })
    
    ffmpegInstance.on('progress', ({ progress, time }) => {
      console.log('📊 [FFMPEG] Progress:', Math.round(progress * 100) + '%', 'Time:', time)
    })
    
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    
    console.log('✅ [FFMPEG] FFmpeg WASM initialized successfully')
  }
  return ffmpegInstance
}

// Get video duration using FFmpeg probe
async function getVideoDuration(videoData: Uint8Array): Promise<number> {
  try {
    console.log('⏱️ [DURATION] Probing video duration...')
    const ffmpeg = await initializeFFmpeg()
    
    // Write video to FFmpeg filesystem
    await ffmpeg.writeFile('probe.mp4', videoData)
    
    // Use ffprobe to get video duration
    await ffmpeg.exec([
      '-i', 'probe.mp4',
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'csv=p=0'
    ])
    
    // For now, return a default duration since reading ffmpeg output is complex in Edge Functions
    // In production, you would parse the actual output
    console.log('⏱️ [DURATION] Using default duration of 60 seconds (ffprobe output parsing not implemented)')
    return 60 // Default fallback - in real implementation would parse ffmpeg output
    
  } catch (error) {
    console.error('❌ [DURATION] Failed to get video duration:', error)
    return 60 // Fallback duration
  }
}

// Extract a single frame from video at specific timestamp
async function extractVideoFrame(
  videoData: Uint8Array, 
  timestamp: number, 
  outputName: string
): Promise<Uint8Array> {
  try {
    console.log(`🎬 [EXTRACT] Extracting frame at ${timestamp}s -> ${outputName}`)
    const ffmpeg = await initializeFFmpeg()
    
    // Write video file to FFmpeg filesystem
    await ffmpeg.writeFile('input.mp4', videoData)
    
    // Extract frame at specific timestamp
    await ffmpeg.exec([
      '-i', 'input.mp4',              // Input video
      '-ss', timestamp.toString(),     // Seek to timestamp
      '-vframes', '1',                // Extract 1 frame
      '-q:v', '2',                    // High quality (1-31, lower is better)
      '-s', '400x225',                // Resize to 400x225 (16:9 aspect ratio)
      '-f', 'image2',                 // Force image format
      outputName                      // Output filename
    ])
    
    // Read the generated thumbnail
    const frameData = await ffmpeg.readFile(outputName)
    console.log(`✅ [EXTRACT] Successfully extracted frame, size: ${frameData.byteLength} bytes`)
    
    return frameData as Uint8Array
    
  } catch (error) {
    console.error(`❌ [EXTRACT] Failed to extract frame at ${timestamp}s:`, error)
    throw error
  }
}

// Generate real video thumbnails using FFmpeg
async function generateThumbnailOptions(videoData: Uint8Array, videoId: string) {
  try {
    console.log('🎨 [THUMBNAIL DEBUG] Starting REAL thumbnail generation with video data size:', videoData.length)
    
    // Get video duration
    const duration = await getVideoDuration(videoData)
    console.log('⏱️ [THUMBNAIL DEBUG] Video duration:', duration, 'seconds')
    
    // Define positions to extract frames
    const positions = [
      { percent: 0, label: '0pct', timestamp: 0 },
      { percent: 0.25, label: '25pct', timestamp: duration * 0.25 },
      { percent: 0.5, label: '50pct', timestamp: duration * 0.5 },
      { percent: 0.75, label: '75pct', timestamp: duration * 0.75 }
    ]
    
    const thumbnails = []

    for (const position of positions) {
      console.log(`🖼️ [THUMBNAIL DEBUG] Generating REAL thumbnail at position: ${position.label} (${position.timestamp.toFixed(2)}s)`)
      
      try {
        // Extract real frame using FFmpeg
        const frameFilename = `frame_${position.label}.jpg`
        const frameData = await extractVideoFrame(videoData, position.timestamp, frameFilename)
        
        // Convert to blob
        const blob = new Blob([frameData], { type: 'image/jpeg' })
        
        thumbnails.push({
          position: position.label,
          blob: blob
        })
        
        console.log(`✅ [THUMBNAIL DEBUG] Successfully generated ${position.label} thumbnail, size: ${blob.size} bytes`)
        
      } catch (error) {
        console.error(`❌ [THUMBNAIL DEBUG] Failed to generate ${position.label} thumbnail:`, error)
        // Continue with other thumbnails
      }
    }

    console.log('🎉 [THUMBNAIL DEBUG] Successfully generated', thumbnails.length, 'REAL thumbnails')
    return thumbnails
    
  } catch (error) {
    console.error('❌ [THUMBNAIL DEBUG] Failed to generate real thumbnails:', error)
    return null
  }
}

