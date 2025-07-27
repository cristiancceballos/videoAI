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

    // Upload video to Cloudinary and generate thumbnail
    console.log('☁️ [CLOUDINARY] Uploading video to Cloudinary...')
    const cloudinaryResult = await uploadVideoToCloudinary(
      videoUrl,
      videoId,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret
    )

    if (!cloudinaryResult.success) {
      console.error('❌ [CLOUDINARY] Failed to upload to Cloudinary:', cloudinaryResult.error)
      await updateVideoError(supabaseClient, videoId, cloudinaryResult.error)
      return new Response(
        JSON.stringify({ error: 'Failed to process video with Cloudinary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate thumbnail URL
    const thumbnailUrl = generateThumbnailUrl(cloudinaryCloudName, cloudinaryResult.publicId)
    console.log('🖼️ [CLOUDINARY] Generated thumbnail URL:', thumbnailUrl)

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
        publicId: cloudinaryResult.publicId,
        message: 'Cloudinary thumbnail generated successfully'
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

// Upload video to Cloudinary
async function uploadVideoToCloudinary(
  videoUrl: string, 
  videoId: string, 
  cloudName: string, 
  apiKey: string, 
  apiSecret: string
) {
  try {
    console.log('📤 [CLOUDINARY] Starting video upload...')
    
    // Create timestamp for API signature
    const timestamp = Math.round(new Date().getTime() / 1000)
    const publicId = `video_thumbnails/${videoId}`
    
    // Create signature for authenticated upload
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}&resource_type=video`
    const signature = await generateSignature(paramsToSign, apiSecret)
    
    // Prepare form data for upload
    const formData = new FormData()
    formData.append('file', videoUrl)
    formData.append('public_id', publicId)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', apiKey)
    formData.append('signature', signature)
    formData.append('resource_type', 'video')
    formData.append('overwrite', 'true')
    
    // Upload to Cloudinary
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData
      }
    )
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('❌ [CLOUDINARY] Upload failed:', errorText)
      return { success: false, error: `Upload failed: ${errorText}` }
    }
    
    const result = await uploadResponse.json()
    console.log('✅ [CLOUDINARY] Video uploaded successfully:', result.public_id)
    
    return { 
      success: true, 
      publicId: result.public_id,
      cloudinaryResponse: result
    }
    
  } catch (error) {
    console.error('❌ [CLOUDINARY] Upload error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
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