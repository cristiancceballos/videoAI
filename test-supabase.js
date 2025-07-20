// Quick test to verify Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsylhhfhimyurgrbcrku.supabase.co';
const supabaseKey = 'sb_publishable_GRFMubBoqdgc3cgmhMJZiw_soD1W2u1';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Basic connection
    const { data, error } = await supabase.from('videos').select('count', { count: 'exact' });
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    console.log('✅ Database connected successfully');
    
    // Test 2: Check if columns exist
    const { data: testData, error: testError } = await supabase
      .from('videos')
      .select('source_type')
      .limit(1);
    
    if (testError && testError.message.includes('column "source_type" does not exist')) {
      console.error('❌ Missing columns! Run fix-database.sql in Supabase');
      return false;
    }
    console.log('✅ Database schema looks good');
    
    // Test 3: Storage buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Storage check failed:', bucketsError.message);
      return false;
    }
    
    const hasVideos = buckets.some(b => b.name === 'videos');
    const hasThumbnails = buckets.some(b => b.name === 'thumbnails');
    
    if (!hasVideos || !hasThumbnails) {
      console.error('❌ Missing storage buckets. Create "videos" and "thumbnails" buckets');
      return false;
    }
    console.log('✅ Storage buckets exist');
    
    console.log('🎉 All tests passed! Your setup is ready.');
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

testConnection();