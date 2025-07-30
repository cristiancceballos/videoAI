// Supabase Edge Function for processing videos with Bunny.net Stream
// This function creates a video entry in Bunny Stream and uploads the video file

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { videoId, userId, storagePath, bunnyLibraryId, bunnyApiKey, bunnyCdnHostname } = await req.json()
    
    if (!videoId || !userId || !storagePath || !bunnyLibraryId || !bunnyApiKey || !bunnyCdnHostname) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update video status to processing
    await supabaseClient
      .from('videos')
      .update({ thumb_status: 'processing' })
      .eq('id', videoId)

    // Generate signed URL for the video
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('videos')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      await updateVideoError(supabaseClient, videoId, 'Failed to generate video access URL')
      return new Response(
        JSON.stringify({ error: 'Failed to generate video access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const videoUrl = signedUrlData.signedUrl

    // Get video metadata to determine optimal thumbnail time
    const { data: videoData } = await supabaseClient
      .from('videos')
      .select('duration, title')
      .eq('id', videoId)
      .single()

    // Calculate optimal thumbnail time based on video duration
    let thumbnailTime = 3000; // Default 3 seconds
    if (videoData?.duration) {
      if (videoData.duration < 3) {
        thumbnailTime = Math.floor(videoData.duration * 1000 / 2); // Middle of short videos
      } else if (videoData.duration < 10) {
        thumbnailTime = 2000; // 2 seconds for short videos
      } else {
        thumbnailTime = 3000; // 3 seconds for longer videos
      }
    }

    // Step 1: Create video entry in Bunny Stream
    const createVideoResponse = await fetch(
      `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'AccessKey': bunnyApiKey
        },
        body: JSON.stringify({
          title: videoData?.title || `video-${videoId}`,
          thumbnailTime: thumbnailTime
        })
      }
    )

    if (!createVideoResponse.ok) {
      const errorText = await createVideoResponse.text()
      await updateVideoError(supabaseClient, videoId, `Bunny create failed: ${errorText}`)
      return new Response(
        JSON.stringify({ error: `Failed to create video in Bunny: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bunnyVideo = await createVideoResponse.json()
    const bunnyVideoGuid = bunnyVideo.guid

    // Step 2: Fetch video from Supabase
    const videoResponse = await fetch(videoUrl)
    
    if (!videoResponse.ok) {
      await updateVideoError(supabaseClient, videoId, `Failed to fetch video: ${videoResponse.status}`)
      return new Response(
        JSON.stringify({ error: `Failed to fetch video from storage: ${videoResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get video as blob
    const videoBlob = await videoResponse.blob()

    // Check size limit (100MB for Edge Functions)
    if (videoBlob.size > 100 * 1024 * 1024) {
      await updateVideoError(supabaseClient, videoId, 'Video too large (max 100MB)')
      return new Response(
        JSON.stringify({ error: 'Video file too large for processing (max 100MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Upload video to Bunny Stream
    const uploadResponse = await fetch(
      `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos/${bunnyVideoGuid}`,
      {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'AccessKey': bunnyApiKey
        },
        body: videoBlob
      }
    )

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      await updateVideoError(supabaseClient, videoId, `Bunny upload failed: ${errorText}`)
      return new Response(
        JSON.stringify({ error: `Failed to upload video to Bunny: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct URLs
    const thumbnailUrl = `https://${bunnyCdnHostname}/${bunnyVideoGuid}/thumbnail.jpg`
    const videoPlaybackUrl = `https://${bunnyCdnHostname}/${bunnyVideoGuid}/playlist.m3u8`

    // Update video record with Bunny information
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        bunny_video_id: bunnyVideoGuid,
        bunny_video_url: videoPlaybackUrl,
        bunny_thumbnail_url: thumbnailUrl,
        thumb_status: 'ready',
        thumb_error_message: null
      })
      .eq('id', videoId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update video record', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        bunnyVideoId: bunnyVideoGuid,
        thumbnailUrl: thumbnailUrl,
        videoUrl: videoPlaybackUrl,
        message: 'Video processed successfully with Bunny Stream'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Update video with error status
async function updateVideoError(supabaseClient: any, videoId: string, errorMessage: string) {
  await supabaseClient
    .from('videos')
    .update({
      thumb_status: 'error',
      thumb_error_message: `BUNNY_ERROR: ${errorMessage} [${new Date().toISOString()}]`
    })
    .eq('id', videoId)
}