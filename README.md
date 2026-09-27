# VideoAI - AI-Powered Video Management PWA
Visit the app here: https://videoai-app.vercel.app

A Progressive Web App (PWA) that helps users upload, organize, and interact with their video content through AI-powered summarization and search filtering.

## Features

### Current (MVP Complete)
- **Video Uploads**: Upload videos directly from your device photo gallery or camera (up to 100MB)
- **AI Video Analysis**: Google Gemini 3.5 Flash Lite multimodal processing for transcription, summaries, and tags in a single API call (Replaced OpenAI Whisper + Google Gemini combo)
- **Smart Tags**: Automatic tag generation from video content with ability for users to create or delete tags
- **Search & Filter**: Find videos quickly by searching across titles and tags (supports abbreviation expansion, e.g. "cs" → "computer science")
- **Secure Storage**: Videos stored in Supabase Storage with user authentication
- **Mobile Optimized**: PWA designed for mobile-first experience with TikTok-style feed
- **Upload Progress**: Real-time progress tracking with visual feedback

## Technology Stack

- **Frontend**: Expo (React Native for Web) deployed as PWA
- **Backend**: Supabase (Auth, Storage, Postgres, Edge Functions)
- **Database**: PostgreSQL for structured data storage
- **Deployment**: Vercel for web hosting
- **AI**: Google Gemini 3.5 Flash Lite (multimodal video analysis - transcription, summarization, and tagging)
- **Mobile**: Progressive Web App with native-like functionality

## Usage

1. **Access the App**: Visit the deployed Vercel URL on any mobile browser
2. **Sign Up/Login**: Create an account or sign in with existing credentials
3. **Upload Videos**: Use "Choose from Gallery" or "Take Video" options
4. **AI Processing**: Videos up to 100MB are automatically analyzed by Gemini AI to generate transcripts, summaries, and tags
5. **Search & Manage**: Browse your library, filter videos by tags, and edit/delete tags

## Project Structure

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

## Current Status

**MVP Complete**: Core upload + AI pipeline working
- User authentication
- Video upload (gallery/camera) up to 100MB
- AI video analysis via Gemini multimodal (transcription + summary + tags)
- Tag management (add/remove)
- Search across titles/tags
- Mobile-optimized UI
- Upload progress tracking

## Known Limitations

- Videos larger than 100MB not supported
- Limited to web browsers (no native app store distribution)

## Contributing

This is currently a personal project focused on small user base (~15 users). 

## License

Private project - All rights reserved

---

Built using modern web technologies for seamless video organization and AI interaction.