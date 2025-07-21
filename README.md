# VideoAI - Smart Video Organizer with AI

A Progressive Web App (PWA) that helps users upload, organize, and interact with their video content through AI-powered summarization and Q&A capabilities.

## 🚀 Features

### Current (Phase 2)
- **Device Gallery Upload**: Upload videos directly from your device photo gallery
- **Camera Recording**: Record videos using device camera
- **Secure Storage**: Videos stored in Supabase Storage with user authentication
- **Mobile Optimized**: PWA designed for mobile-first experience
- **Real-time Progress**: Upload progress tracking with visual feedback

### Coming Soon (Phase 3+)
- **AI Transcription**: Automatic video transcription using Whisper API
- **Smart Summaries**: AI-generated video summaries with GPT-4/Claude
- **Interactive Q&A**: Ask questions about video content and get AI responses
- **Vector Search**: Find videos by content similarity using pgvector
- **URL Downloads**: Support for YouTube/TikTok video processing

## 🛠 Technology Stack

- **Frontend**: Expo (React Native for Web) deployed as PWA
- **Backend**: Supabase (Auth, Storage, Postgres+pgvector, Edge Functions)
- **Database**: PostgreSQL with pgvector extension for embeddings
- **Deployment**: Vercel for web hosting
- **AI**: OpenAI APIs (Whisper, GPT-4, Embeddings)
- **Mobile**: Progressive Web App with native-like functionality

## 📱 Usage

1. **Access the App**: Visit the deployed Vercel URL on any mobile browser
2. **Sign Up/Login**: Create an account or sign in with existing credentials
3. **Upload Videos**: Use "Choose from Gallery" or "Take Video" options
4. **View Library**: Browse your uploaded videos in the main feed

## 🔧 Development Setup

### Prerequisites
- Node.js (18+)
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd videoAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create `.env.local` with your Supabase credentials:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Database Setup**
   Run the SQL schema in your Supabase dashboard:
   ```bash
   # Execute the contents of supabase-setup.sql in your Supabase SQL editor
   ```

5. **Development Server**
   ```bash
   npx expo start --web
   ```

### Deployment

Deploy to Vercel:
```bash
npx vercel
```

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, etc.)
├── screens/            # Main app screens
├── services/           # API services and utilities
├── types/              # TypeScript type definitions
└── utils/              # Helper utilities

supabase-setup.sql      # Database schema
buildingPlain.md        # Development roadmap
prd.md                  # Product requirements
```

## 📋 Current Status

**Phase 2 Complete**: Core upload functionality working
- ✅ User authentication
- ✅ Gallery and camera video uploads
- ✅ Secure cloud storage
- ✅ Mobile-optimized UI
- ✅ Upload progress tracking

**Next Phase**: AI processing pipeline implementation

## 🚧 Known Limitations

- URL-based video downloads not yet implemented (planned for Phase 6)
- AI features (transcription, summarization) in development
- Search functionality not yet available
- Limited to web browsers (no native app store distribution)

## 🤝 Contributing

This is currently a personal project focused on small user base (<10 users). 

## 📄 License

Private project - All rights reserved

## 🆘 Troubleshooting

### Mobile Issues
- **Use deployed Vercel URL**, not Expo dev server for mobile testing
- Ensure camera/storage permissions are granted when prompted
- iOS Safari and Chrome mobile browsers are officially supported

### Development Issues
- Verify Supabase environment variables are correctly configured
- Check that RLS policies are properly set up in your Supabase dashboard
- For upload issues, verify storage buckets exist and have proper policies

---

Built with ❤️ using modern web technologies for seamless video organization and AI interaction.