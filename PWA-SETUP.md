# 🚀 GrowthOfWisdom PWA Setup Guide

## Overview
GrowthOfWisdom is now a **Progressive Web App (PWA)** optimized for mobile-first usage with QR code distribution.

## 📱 PWA Benefits
- ✅ **No App Store**: Direct distribution via QR code
- ✅ **Instant Updates**: All users get updates immediately  
- ✅ **Cross-Platform**: Works on any mobile device (iOS/Android)
- ✅ **Add to Home Screen**: App-like experience
- ✅ **Small User Base Friendly**: Perfect for <10 users

---

## 🛠️ Development Setup

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account (free tier)
- Code editor (VS Code recommended)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Supabase (One-time Setup)

#### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait for provisioning (~2 minutes)

#### B. Set Up Database
1. Go to SQL Editor in Supabase dashboard
2. Run `supabase-setup.sql` (creates all tables)
3. Run `phase2-columns.sql` (adds video metadata fields)
4. Run `storage-policies.sql` (sets up file permissions)

#### C. Create Storage Buckets
1. Go to Storage in Supabase dashboard
2. Create bucket: `videos` (private)
3. Create bucket: `thumbnails` (private)

#### D. Configure Environment
1. Go to Settings > API in Supabase
2. Copy Project URL and anon key
3. Update `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 🔄 Development Workflow

### Start Development Server
```bash
npx expo start --web
```
This opens the PWA in your browser at `http://localhost:8081`

### Test on Mobile
1. **Same WiFi**: Scan QR code from terminal with phone
2. **Different Network**: Use tunnel mode:
   ```bash
   npx expo start --web --tunnel
   ```

### Development Tips
- **Primary Target**: Mobile browsers (Chrome/Safari)
- **Desktop**: Works but mobile-optimized
- **Debugging**: Use browser dev tools (F12)

---

## 📦 Building for Production

### 1. Build PWA
```bash
npx expo export --platform web
```
Creates optimized build in `dist/` folder

### 2. Deploy Options

#### Option A: Vercel (Recommended)
```bash
npx vercel
# Follow prompts to deploy dist/ folder
```

#### Option B: Netlify
1. Drag `dist/` folder to [netlify.com/drop](https://netlify.com/drop)
2. Get deployment URL

#### Option C: Static Hosting
Upload `dist/` contents to any static host (GitHub Pages, Firebase Hosting, etc.)

---

## 📱 Distribution & Usage

### 1. Generate QR Code
After deployment, create QR code pointing to your URL:
- Use [qr-code-generator.com](https://www.qr-code-generator.com)
- Point to your deployed app URL
- Save QR code image

### 2. User Experience
1. **Scan QR Code** → Opens in mobile browser
2. **"Add to Home Screen"** prompt appears
3. **Tap Add** → Creates app icon on home screen
4. **Use Like Native App** → Full-screen, app-like experience

### 3. Sharing Process
1. Show QR code on your phone/laptop
2. Others scan with camera app
3. They add to home screen
4. Instant access to your video app!

---

## 🧪 Testing Checklist

### Mobile Browser Testing
- [ ] Authentication works on mobile
- [ ] File upload from mobile gallery works
- [ ] Video preview plays correctly
- [ ] Upload progress displays properly
- [ ] Video feed loads and scrolls smoothly
- [ ] Add to home screen works
- [ ] PWA launches properly from home screen

### Cross-Platform Testing
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop browsers (Chrome, Firefox, Safari)

---

## 🔧 Troubleshooting

### Authentication Issues
- Check browser console for errors
- Verify environment variables are set
- Test with incognito/private browsing

### Upload Not Working
- Verify storage buckets exist in Supabase
- Check storage policies are configured
- Test file size (max 100MB)

### PWA Not Installing
- Ensure HTTPS (required for PWA)
- Check manifest.json is accessible
- Verify service worker registration

### Performance Issues
- Test on slower mobile connections
- Check Supabase storage region
- Optimize video file sizes

---

## 🎯 Current Status

### ✅ Working Features
- PWA installation and manifest
- Mobile-optimized authentication
- Web-compatible file uploads
- Video preview with HTML5 player
- Real-time video feed updates
- Responsive mobile design

### 🔄 Phase 3 (Next)
- AI transcription (Whisper API)
- Video summarization (GPT-4)
- Vector search and Q&A chat
- Background processing

---

## 🆘 Support

### Quick Fixes
1. **Clear browser cache** if app not updating
2. **Re-add to home screen** if PWA not working
3. **Check internet connection** for Supabase access

### Development Issues
- Check browser console for error messages
- Verify all environment variables are set
- Test in incognito mode to avoid cache issues

Your PWA is ready for QR code distribution! 🎉