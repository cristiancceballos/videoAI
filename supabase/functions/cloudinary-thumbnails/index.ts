// TEMPORARY TEST VERSION - Just returns success without doing Cloudinary processing
// This will help us debug if the function routing and authentication is working

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("🧪 TEST Cloudinary Thumbnail Generator (Test Mode)")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 [TEST CLOUDINARY] Test request received')
    
    // Parse request body
    const { videoId, userId, storagePath } = await req.json()
    
    console.log('📋 [TEST CLOUDINARY] Request data:', { videoId, userId, storagePath })

    // Just return a fake success for testing
    const fakeCloudinaryUrl = `https://res.cloudinary.com/ddboyfn5x/video/upload/so_3,w_400,h_225,c_fill,f_jpg/test_${videoId}.jpg`
    
    console.log('✅ [TEST CLOUDINARY] Returning fake success with URL:', fakeCloudinaryUrl)

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: fakeCloudinaryUrl,
        message: 'TEST MODE: Fake Cloudinary thumbnail generated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 [TEST CLOUDINARY] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})