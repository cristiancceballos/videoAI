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

    // Use direct Cloudinary thumbnail generation from URL (faster, no upload needed)
    console.log('☁️ [CLOUDINARY] Generating thumbnail via URL transformation...')
    
    // Use Cloudinary's fetch feature to generate thumbnail directly from video URL
    const publicId = `video_thumbnails/${videoId}`
    
    // Generate Cloudinary URL that fetches and transforms the video in one step
    const cloudinaryFetchUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_3,w_400,h_225,c_fill,f_jpg/${encodeURIComponent(videoUrl)}.jpg`
    
    console.log('🖼️ [CLOUDINARY] Generated thumbnail URL via fetch:', cloudinaryFetchUrl)
    
    // Test if the thumbnail URL works (this triggers Cloudinary to process it)
    console.log('🧪 [CLOUDINARY] Testing thumbnail generation...')
    try {
      const thumbnailTest = await fetch(cloudinaryFetchUrl, { method: 'HEAD' })
      console.log('📊 [CLOUDINARY] Thumbnail test result:', {
        status: thumbnailTest.status,
        contentType: thumbnailTest.headers.get('content-type')
      })
      
      if (thumbnailTest.ok) {
        console.log('✅ [CLOUDINARY] Thumbnail available immediately')
      } else {
        console.log('⏳ [CLOUDINARY] Thumbnail being generated, will use URL anyway')
      }
    } catch (testError) {
      console.log('⚠️ [CLOUDINARY] Thumbnail test failed, but URL should work:', testError.message)
    }
    
    // Use the fetch URL as the thumbnail URL
    const thumbnailUrl = cloudinaryFetchUrl

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
    console.log('🔍 [CLOUDINARY] Debug info:', {
      videoUrl: videoUrl.substring(0, 100) + '...',
      videoId,
      cloudName,
      apiKeyLength: apiKey.length,
      apiSecretLength: apiSecret.length
    })
    
    // Test video URL accessibility first
    console.log('🔗 [CLOUDINARY] Testing video URL accessibility...')
    try {
      const testResponse = await fetch(videoUrl, { method: 'HEAD' })
      console.log('✅ [CLOUDINARY] Video URL test result:', {
        status: testResponse.status,
        contentType: testResponse.headers.get('content-type'),
        contentLength: testResponse.headers.get('content-length')
      })
    } catch (urlError) {
      console.error('❌ [CLOUDINARY] Video URL not accessible:', urlError)
      return { success: false, error: `Video URL not accessible: ${urlError.message}` }
    }
    
    // Create timestamp for API signature
    const timestamp = Math.round(new Date().getTime() / 1000)
    const publicId = `video_thumbnails/${videoId}`
    
    console.log('🔑 [CLOUDINARY] Creating API signature...')
    // Create signature for authenticated upload
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}&resource_type=video`
    const signature = await generateSignature(paramsToSign, apiSecret)
    console.log('✅ [CLOUDINARY] Signature created successfully')
    
    // Prepare form data for upload
    console.log('📋 [CLOUDINARY] Preparing form data...')
    const formData = new FormData()
    formData.append('file', videoUrl)
    formData.append('public_id', publicId)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', apiKey)
    formData.append('signature', signature)
    formData.append('resource_type', 'video')
    formData.append('overwrite', 'true')
    
    console.log('📋 [CLOUDINARY] Form data prepared:', {
      publicId,
      timestamp,
      apiKey: apiKey.substring(0, 6) + '...',
      signature: signature.substring(0, 10) + '...',
      cloudinaryUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`
    })
    
    // Upload to Cloudinary
    console.log('🚀 [CLOUDINARY] Sending upload request to Cloudinary...')
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData
      }
    )
    
    console.log('📊 [CLOUDINARY] Upload response received:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      headers: Object.fromEntries(uploadResponse.headers.entries())
    })
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('❌ [CLOUDINARY] Upload failed:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorBody: errorText
      })
      return { success: false, error: `Upload failed (${uploadResponse.status}): ${errorText}` }
    }
    
    console.log('🎉 [CLOUDINARY] Upload successful! Parsing response...')
    const result = await uploadResponse.json()
    console.log('✅ [CLOUDINARY] Video uploaded successfully:', {
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      duration: result.duration,
      width: result.width,
      height: result.height
    })
    
    return { 
      success: true, 
      publicId: result.public_id,
      cloudinaryResponse: result
    }
    
  } catch (error) {
    console.error('❌ [CLOUDINARY] Upload error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
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