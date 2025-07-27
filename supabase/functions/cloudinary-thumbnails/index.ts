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

    // Note: We'll set thumb_status to 'processing' after generating the optimistic URL
    console.log('🔄 [CLOUDINARY] Preparing thumbnail generation...')

    // Generate signed URL for the video
    console.log('🔐 [CLOUDINARY] Generating signed URL for video access...')
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('videos')
      .createSignedUrl(storagePath, 21600) // 6 hours expiry for large video processing

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

    // Basic quota check (warn if approaching limits)
    console.log('💰 [CLOUDINARY] Checking quota usage...')
    try {
      const quotaResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/usage`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${cloudinaryApiKey}:${cloudinaryApiSecret}`)}`
          },
          signal: AbortSignal.timeout(5000)
        }
      )
      
      if (quotaResponse.ok) {
        const quotaData = await quotaResponse.json()
        const creditsUsed = quotaData.credits?.usage || 0
        const creditsLimit = quotaData.credits?.limit || 1000
        const usagePercent = (creditsUsed / creditsLimit) * 100
        
        console.log(`📊 [CLOUDINARY] Credits: ${creditsUsed}/${creditsLimit} (${usagePercent.toFixed(1)}%)`)
        
        if (usagePercent > 80) {
          console.warn('⚠️ [CLOUDINARY] WARNING: Approaching credit limit (>80%)')
        }
      } else {
        console.warn('⚠️ [CLOUDINARY] Could not fetch quota data:', quotaResponse.status)
      }
    } catch (quotaError) {
      console.warn('⚠️ [CLOUDINARY] Quota check failed:', quotaError.message)
    }

    // Get video metadata to determine optimal frame offset
    console.log('📊 [CLOUDINARY] Fetching video metadata for duration...')
    const { data: videoData, error: videoError } = await supabaseClient
      .from('videos')
      .select('duration')
      .eq('id', videoId)
      .single()

    // Calculate optimal frame offset based on video duration
    let frameOffset = 3; // Default 3 seconds
    if (videoData?.duration) {
      if (videoData.duration < 3) {
        frameOffset = Math.max(1, Math.floor(videoData.duration / 2)); // Middle of short videos
      } else if (videoData.duration < 10) {
        frameOffset = 2; // 2 seconds for short videos
      } else {
        frameOffset = 3; // 3 seconds for longer videos
      }
      console.log(`🎯 [CLOUDINARY] Using frame offset ${frameOffset}s for ${videoData.duration}s video`);
    } else {
      console.log('⚠️ [CLOUDINARY] No duration data, using default 3s offset');
    }

    // Upload video to Cloudinary with simplified async approach
    console.log('☁️ [CLOUDINARY] Starting simplified Cloudinary upload...')
    
    const publicId = `video_thumbnails/${videoId}`
    
    // Generate clean thumbnail URL with dynamic offset
    const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_${frameOffset},w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
    
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
      videoId,
      frameOffset
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
        thumb_status: 'processing',
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
  videoId: string,
  frameOffset: number = 3
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
    
    // Add timeout signal for large video processing (10 minutes max)
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), 600000) // 10 minutes
    
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData,
        signal: timeoutController.signal
      }
    )
    
    clearTimeout(timeoutId) // Clear timeout if request completes
    
    console.log('📊 [FIRE_AND_FORGET] Response received:', uploadResponse.status)
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json()
      console.log('✅ [FIRE_AND_FORGET] Upload successful:', result.public_id)
      console.log('🎉 [FIRE_AND_FORGET] Video processing complete, validating thumbnail...')
      
      // Validate that the thumbnail is actually accessible
      const thumbnailUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_${frameOffset},w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
      const isValid = await validateThumbnailUrl(thumbnailUrl)
      
      if (isValid) {
        console.log('✅ [FIRE_AND_FORGET] Thumbnail validated, updating status to ready...')
        await updateVideoStatusWithRetry(supabaseClient, videoId, {
          thumb_status: 'ready'
        }, 'Status updated to ready after validation')
      } else {
        console.error('❌ [FIRE_AND_FORGET] Thumbnail validation failed')
        await updateVideoStatusWithRetry(supabaseClient, videoId, {
          thumb_status: 'error',
          thumb_error_message: `THUMBNAIL_ERROR: Generated thumbnail is not accessible [${new Date().toISOString()}]`
        }, 'Error status updated after thumbnail validation failure')
      }
    } else {
      const errorText = await uploadResponse.text()
      console.error('❌ [FIRE_AND_FORGET] Upload failed:', errorText)
      
      // Update video with error status (with retry logic)
      await updateVideoStatusWithRetry(supabaseClient, videoId, {
        thumb_status: 'error',
        thumb_error_message: `THUMBNAIL_ERROR: Cloudinary upload failed: ${errorText} [${new Date().toISOString()}]`
      }, 'Error status updated after Cloudinary failure')
    }
    
  } catch (error) {
    console.error('❌ [FIRE_AND_FORGET] Background upload error:', error.message)
    
    // Update video with error status (with retry logic)
    await updateVideoStatusWithRetry(supabaseClient, videoId, {
      thumb_status: 'error',
      thumb_error_message: `THUMBNAIL_ERROR: Background upload failed: ${error.message} [${new Date().toISOString()}]`
    }, 'Error status updated after background failure')
  }
}

// Validate that Cloudinary thumbnail URL is accessible
async function validateThumbnailUrl(url: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 [VALIDATION] Checking thumbnail accessibility (attempt ${attempt})...`)
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (response.ok && response.status === 200) {
        console.log('✅ [VALIDATION] Thumbnail is accessible')
        return true
      } else {
        console.warn(`⚠️ [VALIDATION] Thumbnail not ready yet: ${response.status}`)
      }
    } catch (error) {
      console.warn(`⚠️ [VALIDATION] Attempt ${attempt} failed:`, error.message)
    }
    
    if (attempt < maxRetries) {
      // Wait longer between retries (Cloudinary processing takes time)
      const delay = attempt * 5000 // 5s, 10s, 15s
      console.log(`⏳ [VALIDATION] Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error('❌ [VALIDATION] Thumbnail validation failed after all retries')
  return false
}

// Database update with retry logic
async function updateVideoStatusWithRetry(
  supabaseClient: any, 
  videoId: string, 
  updateData: any, 
  successMessage: string,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabaseClient
        .from('videos')
        .update(updateData)
        .eq('id', videoId)
      
      if (error) {
        throw error
      }
      
      console.log(`✅ [DB_RETRY] ${successMessage} (attempt ${attempt})`)
      return
    } catch (error) {
      console.error(`❌ [DB_RETRY] Attempt ${attempt}/${maxRetries} failed:`, error.message)
      
      if (attempt === maxRetries) {
        console.error('❌ [DB_RETRY] All retry attempts failed, video may remain in incorrect state')
        return
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000
      console.log(`⏳ [DB_RETRY] Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
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

// Update video with error status (standardized format)
async function updateVideoError(supabaseClient: any, videoId: string, errorMessage: string) {
  const standardizedError = `THUMBNAIL_ERROR: ${errorMessage} [${new Date().toISOString()}]`
  console.log('❌ [CLOUDINARY] Updating video with error status:', standardizedError)
  
  await updateVideoStatusWithRetry(supabaseClient, videoId, {
    thumb_status: 'error',
    thumb_error_message: standardizedError
  }, 'Error status updated with standardized format')
}