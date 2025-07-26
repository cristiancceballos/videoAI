// Supabase Edge Function for generating video thumbnails
// This function processes uploaded videos and generates thumbnail options

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
      const filename = `${videoId}_thumbnail_${thumbnail.position}.svg`
      
      console.log(`📤 [EDGE DEBUG] Uploading thumbnail ${i + 1}/${thumbnailOptions.length}: ${filename}`)
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
          contentType: 'image/svg+xml',
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

// Generate thumbnail options at different time positions
async function generateThumbnailOptions(videoData: Uint8Array, videoId: string) {
  try {
    console.log('🎨 [THUMBNAIL DEBUG] Starting thumbnail generation with video data size:', videoData.length)
    
    // For now, we'll create placeholder thumbnails
    // In a full implementation, you would use FFmpeg WASM here
    const positions = ['0%', '25%', '50%', '75%'] // First frame, quarter, half, three-quarter
    const thumbnails = []

    for (const position of positions) {
      console.log(`🖼️ [THUMBNAIL DEBUG] Generating thumbnail at position: ${position}`)
      
      // Create a simple placeholder thumbnail (in real implementation, use FFmpeg)
      const placeholderThumbnail = await createPlaceholderThumbnail(videoId, position)
      
      thumbnails.push({
        position,
        blob: placeholderThumbnail
      })
    }

    console.log('✅ [THUMBNAIL DEBUG] Successfully generated', thumbnails.length, 'thumbnails')
    return thumbnails
    
  } catch (error) {
    console.error('❌ [THUMBNAIL DEBUG] Failed to generate thumbnails:', error)
    return null
  }
}

// Create a placeholder thumbnail using SVG (server-side compatible)
async function createPlaceholderThumbnail(videoId: string, position: string): Promise<Blob> {
  console.log(`🎨 [PLACEHOLDER DEBUG] Creating placeholder for position: ${position}`)
  
  // Define colors based on position
  let color1: string, color2: string
  
  switch (position) {
    case '0%':
      color1 = '#FF6B6B'
      color2 = '#FF8E8E'
      break
    case '25%':
      color1 = '#4ECDC4'
      color2 = '#70D4CD'
      break
    case '50%':
      color1 = '#45B7D1'
      color2 = '#67C5DA'
      break
    case '75%':
      color1 = '#F7D794'
      color2 = '#F9E2A7'
      break
    default:
      color1 = '#DDA0DD'
      color2 = '#E6B8E6'
  }
  
  // Create SVG string for the placeholder thumbnail
  const svgContent = `
    <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill="url(#grad)" />
      <text x="200" y="120" text-anchor="middle" fill="white" font-family="Arial" font-size="24">
        Frame at ${position}
      </text>
      <text x="200" y="150" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial" font-size="14">
        Video ID: ${videoId.substring(0, 8)}...
      </text>
    </svg>
  `
  
  // Convert SVG to blob
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  console.log(`✅ [PLACEHOLDER DEBUG] Created SVG placeholder, size: ${blob.size} bytes`)
  
  return blob
}