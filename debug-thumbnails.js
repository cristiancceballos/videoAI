// Debug script to check video thumbnails
// Run this in browser console at http://localhost:8081

console.log('🔍 Starting thumbnail debugging...');

// Check if supabase client is available
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase client found');
  
  // Get current user
  window.supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      console.log('✅ User session found:', session.user.id);
      
      // Fetch videos from database
      window.supabase
        .from('videos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching videos:', error);
            return;
          }
          
          console.log('📹 Videos in database:', data.length);
          
          data.forEach((video, index) => {
            console.log(`\n📹 Video ${index + 1}:`, {
              id: video.id,
              title: video.title,
              status: video.status,
              thumbnail_path: video.thumbnail_path,
              storage_path: video.storage_path,
              created_at: video.created_at
            });
            
            // If video has thumbnail_path, try to get signed URL
            if (video.thumbnail_path) {
              window.supabase.storage
                .from('thumbnails')
                .createSignedUrl(video.thumbnail_path, 3600)
                .then(({ data: urlData, error: urlError }) => {
                  if (urlError) {
                    console.error(`❌ Failed to create signed URL for ${video.title}:`, urlError);
                  } else {
                    console.log(`✅ Signed URL for ${video.title}:`, urlData.signedUrl);
                    
                    // Test if URL is accessible
                    fetch(urlData.signedUrl, { method: 'HEAD' })
                      .then(response => {
                        if (response.ok) {
                          console.log(`✅ Thumbnail accessible for ${video.title}`);
                        } else {
                          console.error(`❌ Thumbnail not accessible for ${video.title}:`, response.status);
                        }
                      })
                      .catch(err => console.error(`❌ Error testing thumbnail for ${video.title}:`, err));
                  }
                });
            } else {
              console.log(`⚠️ No thumbnail_path for ${video.title}`);
            }
          });
        });
    } else {
      console.error('❌ No user session found');
    }
  });
} else {
  console.error('❌ Supabase client not found');
}