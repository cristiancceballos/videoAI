import { supabase } from '../services/supabase';

export async function clearCloudinaryUrls() {
  try {
    console.log('Clearing old Cloudinary URLs from database...');
    
    // Clear any Cloudinary URLs from bunny_thumbnail_url column
    const { data, error } = await supabase
      .from('videos')
      .update({ bunny_thumbnail_url: null })
      .like('bunny_thumbnail_url', '%cloudinary%')
      .select();
    
    if (error) {
      console.error('Error clearing Cloudinary URLs:', error);
      return { success: false, error };
    }
    
    console.log(`Cleared ${data?.length || 0} Cloudinary URLs from database`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Failed to clear Cloudinary URLs:', error);
    return { success: false, error };
  }
}