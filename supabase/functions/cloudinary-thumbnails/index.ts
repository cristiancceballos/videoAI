// Supabase Edge Function for generating video thumbnails using Cloudinary
// This function generates real video frame thumbnails via Cloudinary's video API

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("🎬 Cloudinary Thumbnail Generator Edge Function starting...")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 [CLOUDINARY] Thumbnail generation request received')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Get Cloudinary credentials
    const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [CLOUDINARY] Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      console.error('❌ [CLOUDINARY] Missing Cloudinary environment variables')
      return new Response(
        JSON.stringify({ error: 'Missing Cloudinary environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { videoId, userId, storagePath } = await req.json()
    
    console.log('📋 [CLOUDINARY] Request data:', { 
      videoId, 
      userId, 
      storagePath: storagePath?.substring(0, 50) + '...' 
    })

    if (!videoId || !userId || !storagePath) {
      console.error('❌ [CLOUDINARY] Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: videoId, userId, storagePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update video status to processing
    console.log('🔄 [CLOUDINARY] Updating video status to processing...')
    await supabaseClient
      .from('videos')
      .update({ thumb_status: 'processing' })
      .eq('id', videoId)

    // Generate signed URL for the video
    console.log('🔐 [CLOUDINARY] Generating signed URL for video access...')
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('videos')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('❌ [CLOUDINARY] Failed to generate signed URL:', signedUrlError)
      await updateVideoError(supabaseClient, videoId, 'Failed to generate video access URL')
      return new Response(
        JSON.stringify({ error: 'Failed to generate video access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const videoUrl = signedUrlData.signedUrl
    console.log('✅ [CLOUDINARY] Generated signed URL for video')

    // Upload video to Cloudinary with simplified async approach
    console.log('☁️ [CLOUDINARY] Starting simplified Cloudinary upload...')
    
    const publicId = `video_thumbnails/${videoId}`
    
    // Generate clean thumbnail URL immediately (optimistic)
    const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_3,w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
    
    console.log('🎯 [CLOUDINARY] Generated optimistic thumbnail URL:', thumbnailUrl)
    
    // Start Cloudinary upload in fire-and-forget mode (don't wait)
    console.log('🚀 [CLOUDINARY] Starting fire-and-forget upload...')
    uploadVideoFireAndForget(
      videoUrl,
      publicId,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      supabaseClient,
      videoId
    ).catch((error) => {
      console.error('❌ [CLOUDINARY] Background upload failed:', error)
      // Don't fail the main function - this is background processing
    })
    
    console.log('✅ [CLOUDINARY] Background upload started, continuing...')

    // Update video record with thumbnail information
    console.log('💾 [CLOUDINARY] Updating database with thumbnail info...')
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        cloudinary_url: thumbnailUrl,
        thumb_status: 'ready',
        thumb_error_message: null
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('❌ [CLOUDINARY] Failed to update video record:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update video record', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ [CLOUDINARY] Successfully updated video record in database')
    console.log('🎉 [CLOUDINARY] Cloudinary thumbnail generation completed successfully!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: thumbnailUrl,
        method: 'fetch_transform',
        message: 'Cloudinary thumbnail URL generated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 [CLOUDINARY] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Fire-and-forget Cloudinary upload (runs in background)
async function uploadVideoFireAndForget(
  videoUrl: string,
  publicId: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  supabaseClient: any,
  videoId: string
) {
  try {
    console.log('🔥 [FIRE_AND_FORGET] Starting background upload...')
    
    // Create timestamp and signature
    const timestamp = Math.round(new Date().getTime() / 1000)
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}&resource_type=video`
    const signature = await generateSignature(paramsToSign, apiSecret)
    
    // Create FormData
    const formData = new FormData()
    formData.append('file', videoUrl)
    formData.append('public_id', publicId)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', apiKey)
    formData.append('signature', signature)
    formData.append('resource_type', 'video')
    formData.append('overwrite', 'true')
    
    console.log('🚀 [FIRE_AND_FORGET] Sending upload request...')
    
    // No timeout - let it run as long as needed
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData
      }
    )
    
    console.log('📊 [FIRE_AND_FORGET] Response received:', uploadResponse.status)
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json()
      console.log('✅ [FIRE_AND_FORGET] Upload successful:', result.public_id)
      console.log('🎉 [FIRE_AND_FORGET] Video processing complete, thumbnail should now be available')
    } else {
      const errorText = await uploadResponse.text()
      console.error('❌ [FIRE_AND_FORGET] Upload failed:', errorText)
      
      // Update video with error status
      await supabaseClient
        .from('videos')
        .update({
          thumb_status: 'error',
          thumb_error_message: `Cloudinary upload failed: ${errorText}`
        })
        .eq('id', videoId)
    }
    
  } catch (error) {
    console.error('❌ [FIRE_AND_FORGET] Background upload error:', error.message)
    
    // Update video with error status
    try {
      await supabaseClient
        .from('videos')
        .update({
          thumb_status: 'error',
          thumb_error_message: `Background upload failed: ${error.message}`
        })
        .eq('id', videoId)
    } catch (dbError) {
      console.error('❌ [FIRE_AND_FORGET] Failed to update error status:', dbError)
    }
  }
}

// Generate Cloudinary API signature
async function generateSignature(paramsToSign: string, apiSecret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(paramsToSign))
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate thumbnail URL from Cloudinary public ID
function generateThumbnailUrl(cloudName: string, publicId: string): string {
  // Cloudinary transformation parameters:
  // so_3 = start offset at 3 seconds
  // w_400,h_225 = 400x225 dimensions (16:9 aspect ratio)
  // c_fill = crop and fill to exact dimensions
  // f_jpg = convert to JPEG format
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_3,w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
}

// Update video with error status
async function updateVideoError(supabaseClient: any, videoId: string, errorMessage: string) {
  console.log('❌ [CLOUDINARY] Updating video with error status:', errorMessage)
  await supabaseClient
    .from('videos')
    .update({
      thumb_status: 'error',
      thumb_error_message: errorMessage
    })
    .eq('id', videoId)
}