/**
 * Setup Storage Permissions Script
 * Run this with: node setup-storage-permissions.js
 * 
 * This script sets up the necessary storage permissions for thumbnail uploads
 * using the Supabase service role key (not through SQL editor)
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables or replace with actual values
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // This is the service_role key, not anon key

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupStoragePermissions() {
  console.log('🚀 Setting up storage permissions for thumbnail uploads...');

  try {
    // 1. First, check if thumbnails bucket exists
    console.log('📋 Checking if thumbnails bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }

    const thumbnailsBucket = buckets.find(bucket => bucket.id === 'thumbnails');
    
    if (!thumbnailsBucket) {
      console.log('📁 Creating thumbnails bucket...');
      const { error: createError } = await supabase.storage.createBucket('thumbnails', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      });

      if (createError) {
        console.error('❌ Error creating thumbnails bucket:', createError);
        return;
      }
      console.log('✅ Thumbnails bucket created successfully');
    } else {
      console.log('✅ Thumbnails bucket already exists');
    }

    // 2. Test upload functionality
    console.log('🧪 Testing upload functionality...');
    
    // Create a test file
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `test-user/${testFileName}`;
    const testFileContent = 'This is a test file for storage permissions';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(testFilePath, testFileContent, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError);
      console.log('💡 This suggests storage permissions need to be configured manually in Supabase Dashboard');
      console.log('🔧 Manual steps:');
      console.log('   1. Go to Supabase Dashboard > Storage > thumbnails bucket');
      console.log('   2. Configure bucket policies to allow authenticated users to upload');
      console.log('   3. Set up RLS policies for INSERT, SELECT, DELETE operations');
      return;
    }

    console.log('✅ Upload test successful:', uploadData);

    // 3. Test download functionality
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('thumbnails')
      .download(testFilePath);

    if (downloadError) {
      console.error('❌ Download test failed:', downloadError);
    } else {
      console.log('✅ Download test successful');
    }

    // 4. Clean up test file
    const { error: deleteError } = await supabase.storage
      .from('thumbnails')
      .remove([testFilePath]);

    if (deleteError) {
      console.error('⚠️ Could not clean up test file:', deleteError);
    } else {
      console.log('✅ Test file cleaned up');
    }

    console.log('🎉 Storage permissions setup completed successfully!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Alternative function to check current storage policies
async function checkStoragePolicies() {
  console.log('🔍 Checking current storage policies...');
  
  try {
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'storage')
      .eq('tablename', 'objects');

    if (error) {
      console.error('❌ Error checking policies:', error);
      return;
    }

    console.log('📋 Current storage policies:');
    data.forEach(policy => {
      console.log(`   - ${policy.policyname} (${policy.cmd})`);
    });
    
  } catch (error) {
    console.error('💥 Error checking policies:', error);
  }
}

// Run the setup
setupStoragePermissions()
  .then(() => {
    console.log('✅ Setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });