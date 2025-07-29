// Supabase Edge Function for generating video thumbnails using Cloudinary
// This function generates real video frame thumbnails via Cloudinary's video API

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cloudinary Thumbnail Generator Edge Function

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log request received
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [CLOUDINARY] Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { videoId, userId, storagePath, cloudinaryCloudName, uploadPreset } = await req.json()
    
    // Request data: videoId, userId, storagePath, cloudinaryCloudName, uploadPreset

    if (!videoId || !userId || !storagePath || !cloudinaryCloudName) {
      console.error('❌ [CLOUDINARY] Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: videoId, userId, storagePath, cloudinaryCloudName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Note: We'll set thumb_status to 'processing' after generating the optimistic URL
    // Preparing thumbnail generation

    // Generate signed URL for the video
    // Generate signed URL for video access
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
    // Signed URL generated

    // Skip quota check for unsigned uploads

    // Get video metadata to determine optimal frame offset
    // Fetch video metadata for duration
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
      // Using calculated frame offset
    } else {
      // No duration data, using default offset
    }

    // Upload video to Cloudinary with simplified async approach
    // Start Cloudinary upload
    
    const publicId = `video_thumbnails/${videoId}`
    
    // Generate clean thumbnail URL with dynamic offset
    const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_${frameOffset},w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
    
    // Generated thumbnail URL
    
    // Start Cloudinary upload in fire-and-forget mode (don't wait)
    // Start background upload
    uploadVideoFireAndForget(
      videoUrl,
      publicId,
      cloudinaryCloudName,
      uploadPreset || 'video-thumbnails', // Default preset name if not provided
      supabaseClient,
      videoId,
      frameOffset
    ).catch((error) => {
      console.error('❌ [CLOUDINARY] Background upload failed:', error)
      // Don't fail the main function - this is background processing
    })
    
    // Background upload started

    // Update video record with thumbnail information
    // Update database with thumbnail info
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

    // Video record updated successfully

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
  uploadPreset: string,
  supabaseClient: any,
  videoId: string,
  frameOffset: number = 3
) {
  try {
    // Starting background upload
    
    // Create FormData for unsigned upload
    const formData = new FormData()
    formData.append('file', videoUrl)
    formData.append('public_id', publicId)
    formData.append('upload_preset', uploadPreset)
    formData.append('resource_type', 'video')
    formData.append('overwrite', 'true')
    
    // Sending upload request
    
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
    
    // Response received
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json()
      // Upload successful, validating thumbnail
      
      // Validate that the thumbnail is actually accessible
      const thumbnailUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_${frameOffset},w_400,h_225,c_fill,f_jpg/${publicId}.jpg`
      const isValid = await validateThumbnailUrl(thumbnailUrl)
      
      if (isValid) {
        // Thumbnail validated
        await updateVideoStatusWithRetry(supabaseClient, videoId, {
          thumb_status: 'ready'
        }, 'Status updated to ready after validation')
      } else {
        console.error('Thumbnail validation failed')
        await updateVideoStatusWithRetry(supabaseClient, videoId, {
          thumb_status: 'error',
          thumb_error_message: `THUMBNAIL_ERROR: Generated thumbnail is not accessible [${new Date().toISOString()}]`
        }, 'Error status updated after thumbnail validation failure')
      }
    } else {
      const errorText = await uploadResponse.text()
      console.error('Cloudinary upload failed:', errorText)
      
      // Update video with error status (with retry logic)
      await updateVideoStatusWithRetry(supabaseClient, videoId, {
        thumb_status: 'error',
        thumb_error_message: `THUMBNAIL_ERROR: Cloudinary upload failed: ${errorText} [${new Date().toISOString()}]`
      }, 'Error status updated after Cloudinary failure')
    }
    
  } catch (error) {
    console.error('Background upload error:', error.message)
    
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
      // Checking thumbnail accessibility
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (response.ok && response.status === 200) {
        // Thumbnail is accessible
        return true
      } else {
        // Thumbnail not ready yet
      }
    } catch (error) {
      // Validation attempt failed
    }
    
    if (attempt < maxRetries) {
      // Wait longer between retries (Cloudinary processing takes time)
      const delay = attempt * 5000 // 5s, 10s, 15s
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // Thumbnail validation failed after all retries
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
      
      // Database update successful
      return
    } catch (error) {
      // Database update failed
      
      if (attempt === maxRetries) {
        console.error('All database retry attempts failed')
        return
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
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
  // Update video with error status
  
  await updateVideoStatusWithRetry(supabaseClient, videoId, {
    thumb_status: 'error',
    thumb_error_message: standardizedError
  }, 'Error status updated with standardized format')
}