# Setup Guide - Phase 1 (PWA)

## 1. Supabase Project Setup

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be ready

### Database Setup
1. Go to SQL Editor in your Supabase dashboard
2. Run the SQL script from `supabase-setup.sql`
3. This will create all tables, indexes, and RLS policies

### Enable Authentication
1. Go to Authentication > Settings
2. Enable Email authentication
3. Optionally enable Google OAuth:
   - Add Google provider
   - Configure OAuth credentials

### Storage Setup
1. Go to Storage
2. Create three buckets:
   - `videos` (for video files)
   - `thumbnails` (for video thumbnails)
   - `transcripts` (for transcript files)
3. Configure bucket policies:
   ```sql
   -- Allow authenticated users to upload to their own folders
   CREATE POLICY "Users can upload videos" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'videos' AND 
     auth.uid()::text = (storage.foldername(name))[1]
   );
   
   -- Similar policies for thumbnails and transcripts buckets
   ```

### Get Environment Variables
1. Go to Settings > API
2. Copy your `Project URL` and `anon/public key`
3. Update `.env` file:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## 2. Run the PWA

```bash
# Install dependencies (already done)
npm install

# Start the web development server
npx expo start --web

# For mobile testing with QR code
npx expo start --web --tunnel
```

## 3. Test Authentication

1. Register a new account
2. Check that the user appears in Authentication > Users
3. Test login/logout functionality

## Phase 1 Complete! ✅

You now have:
- ✅ Working PWA with TypeScript
- ✅ Supabase integration with web-compatible auth
- ✅ Database schema with RLS
- ✅ Auth screens and navigation
- ✅ Protected routes
- ✅ Mobile-first responsive design

## Next Steps (Phase 2)

- Video upload functionality
- File storage integration
- Basic video feed UI
- Processing status tracking