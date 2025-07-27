// Supabase Edge Function for generating simple video thumbnails
// This function creates unique visual thumbnails without complex video processing

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("🚀 Simple Thumbnail Generator Edge Function starting...")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 [SIMPLE THUMBNAIL] Thumbnail generation request received')
    
    // Initialize Supabase client with environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [SIMPLE THUMBNAIL] Missing environment variables')
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
    
    console.log('📋 [SIMPLE THUMBNAIL] Request data:', { 
      videoId, 
      userId, 
      storagePath: storagePath?.substring(0, 50) + '...' 
    })

    if (!videoId || !userId || !storagePath) {
      console.error('❌ [SIMPLE THUMBNAIL] Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: videoId, userId, storagePath' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🎨 [SIMPLE THUMBNAIL] Starting simple thumbnail generation...')

    // Generate simple visual thumbnails
    const thumbnailOptions = await generateSimpleThumbnails(videoId, userId)

    if (!thumbnailOptions || thumbnailOptions.length === 0) {
      console.error('❌ [SIMPLE THUMBNAIL] Failed to generate any thumbnails')
      return new Response(
        JSON.stringify({ error: 'Failed to generate thumbnails' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🖼️ [SIMPLE THUMBNAIL] Generated', thumbnailOptions.length, 'thumbnail options')

    // Upload thumbnails to storage
    const uploadedThumbnails = []
    for (let i = 0; i < thumbnailOptions.length; i++) {
      const thumbnail = thumbnailOptions[i]
      const filename = `${videoId}_thumbnail_${thumbnail.position}.svg`
      
      console.log(`📤 [SIMPLE THUMBNAIL] Uploading thumbnail ${i + 1}/${thumbnailOptions.length}: ${filename}`)
      
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('thumbnails')
        .upload(`${userId}/${filename}`, thumbnail.blob, {
          contentType: 'image/svg+xml',
          upsert: true
        })

      if (uploadError) {
        console.error(`❌ [SIMPLE THUMBNAIL] Failed to upload thumbnail ${i + 1}:`, uploadError)
        continue
      }

      uploadedThumbnails.push({
        position: thumbnail.position,
        path: uploadData.path,
        filename: filename
      })
      
      console.log(`✅ [SIMPLE THUMBNAIL] Successfully uploaded ${filename}`)
    }

    console.log('✅ [SIMPLE THUMBNAIL] Successfully uploaded', uploadedThumbnails.length, 'thumbnails')

    // Update video record with thumbnail information
    console.log('💾 [SIMPLE THUMBNAIL] Updating database with thumbnail info...')
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        thumbnail_path: uploadedThumbnails[0]?.path || null, // Use first thumbnail
        status: 'ready'
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('❌ [SIMPLE THUMBNAIL] Failed to update video record:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update video record', details: updateError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ [SIMPLE THUMBNAIL] Successfully updated video record in database')
    console.log('🎉 [SIMPLE THUMBNAIL] Simple thumbnail generation completed successfully!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnails: uploadedThumbnails,
        message: `Generated ${uploadedThumbnails.length} simple thumbnail options`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 [SIMPLE THUMBNAIL] Unexpected error:', error)
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

// Generate simple visual thumbnails using fallback approach (Canvas may not be available in Deno)
async function generateSimpleThumbnails(videoId: string, userId: string) {
  try {
    console.log('🎨 [SIMPLE THUMBNAIL] Starting simple thumbnail generation for video:', videoId)
    
    // Since Canvas APIs may not be available in Deno Edge runtime, use SVG fallback directly
    console.log('🔄 [SIMPLE THUMBNAIL] Using SVG-based thumbnail generation (Canvas not available in Edge runtime)')
    return generateFallbackThumbnails(videoId)
    
  } catch (error) {
    console.error('❌ [SIMPLE THUMBNAIL] Failed to generate simple thumbnails:', error)
    return generateFallbackThumbnails(videoId)
  }
}

// Fallback thumbnail generation using simple image data
async function generateFallbackThumbnails(videoId: string) {
  console.log('🔄 [FALLBACK THUMBNAIL] Using fallback thumbnail generation')
  
  try {
    const hash = await hashString(videoId)
    const thumbnails = []
    
    const positions = ['0pct', '25pct', '50pct', '75pct']
    
    for (const position of positions) {
      // Create simple colored JPEG using data URL
      const hue = (hash + positions.indexOf(position) * 90) % 360
      const color = `hsl(${hue}, 70%, 50%)`
      
      // Create minimal SVG that can be converted to JPEG
      const svgContent = `
        <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
              <stop offset="100%" style="stop-color:hsl(${(hue + 30) % 360}, 60%, 60%);stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="400" height="225" fill="url(#grad)" />
          <circle cx="200" cy="112" r="30" fill="rgba(255,255,255,0.3)" />
          <text x="200" y="120" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">
            Video ${videoId.substring(0, 8)}
          </text>
          <text x="200" y="140" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial" font-size="12">
            ${position.replace('pct', '%')}
          </text>
        </svg>
      `
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      
      thumbnails.push({
        position: position,
        blob: blob
      })
    }
    
    console.log('✅ [FALLBACK THUMBNAIL] Generated', thumbnails.length, 'fallback thumbnails')
    return thumbnails
    
  } catch (error) {
    console.error('❌ [FALLBACK THUMBNAIL] Even fallback failed:', error)
    return []
  }
}

// Simple hash function for deterministic colors
async function hashString(str: string): Promise<number> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return hashArray.reduce((hash, byte) => ((hash << 5) - hash + byte) & 0xffffffff, 0) >>> 0
}