# 🚀 Deployment Guide for GrowthOfWisdom PWA

## Quick Deploy to Vercel (Recommended)

### 1. Prerequisites
- GitHub account
- Vercel account (free tier available)
- Your Supabase project set up with environment variables

### 2. Push to GitHub
```bash
# Initialize git repository (if not already done)
git init
git add .
git commit -m "Ready for deployment"

# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/growth-of-wisdom.git
git push -u origin main
```

### 3. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables:
   - `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
5. Click "Deploy"

### 4. Automatic Features
✅ **HTTPS**: Automatically enabled (required for PWA)  
✅ **Global CDN**: Fast loading worldwide  
✅ **Custom Domain**: Add your own domain  
✅ **Auto Deployments**: Updates on every git push  

---

## Alternative: Manual Deployment

### Netlify
```bash
# Build the app
npx expo export --platform web

# Drag the 'dist' folder to netlify.com/drop
# Or use Netlify CLI:
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

### Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Build the app
npx expo export --platform web

# Initialize Firebase
firebase init hosting

# Deploy
firebase deploy
```

### GitHub Pages
```bash
# Build the app
npx expo export --platform web

# Install gh-pages
npm install -g gh-pages

# Deploy to GitHub Pages
gh-pages -d dist
```

---

## Environment Variables Setup

### In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add the following variables:

| Name | Value | Environment |
|------|-------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production |

### Getting Supabase Credentials:
1. Go to your Supabase dashboard
2. Navigate to Settings → API
3. Copy "Project URL" and "anon/public" key

---

## Post-Deployment Checklist

### ✅ Verify PWA Features
- [ ] App loads correctly on HTTPS
- [ ] Service worker registers successfully
- [ ] Add to home screen prompt appears
- [ ] App works offline (cached content)
- [ ] Authentication works properly
- [ ] File uploads function correctly

### ✅ Test on Mobile Devices
- [ ] iOS Safari: PWA installation works
- [ ] Android Chrome: PWA installation works
- [ ] Network status detection works
- [ ] Responsive design looks good

### ✅ Performance Check
- [ ] Fast loading times (< 3 seconds)
- [ ] Lighthouse PWA score > 90
- [ ] No console errors
- [ ] Videos upload successfully

---

## QR Code Generation

Once deployed, your app will be available at a URL like:
- **Vercel**: `https://your-app-name.vercel.app`
- **Netlify**: `https://your-app-name.netlify.app`
- **Custom Domain**: `https://yourdomain.com`

Generate QR codes pointing to your deployed URL using:
- [QR Code Generator](https://www.qr-code-generator.com)
- [QRCode.js](https://davidshimjs.github.io/qrcodejs/)
- Any QR code generator tool

---

## Troubleshooting

### Build Failures
```bash
# Clear Metro cache
npx expo start --clear

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npx expo export --platform web
```

### PWA Not Installing
- Ensure HTTPS is enabled (automatic with most hosts)
- Check service worker in browser dev tools
- Verify manifest.json is accessible
- Test on different browsers/devices

### Environment Variables Not Working
- Double-check variable names match exactly
- Ensure they start with `EXPO_PUBLIC_`
- Redeploy after adding variables
- Check browser console for connection errors

---

## Custom Domain Setup (Optional)

### For Vercel:
1. Go to your project dashboard
2. Click "Domains" tab
3. Add your custom domain
4. Follow DNS configuration instructions

### Benefits of Custom Domain:
- Professional appearance for QR codes
- Better user trust
- Branded experience
- SEO benefits

Your PWA is now ready for distribution via QR code! 🎉