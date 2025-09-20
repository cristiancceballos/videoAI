# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VideoAI** - A mobile-first Progressive Web App (PWA) for video organization with AI-powered summaries and smart tagging. Built with Expo Web and deployed on Vercel, allowing users to upload videos, get AI transcriptions and summaries, and organize content with intelligent tags. Currently serving <10 users with MVP complete.

**Live App**: https://videoai-app.vercel.app

## Technology Stack

- **Frontend**: Expo Web (PWA) - mobile-first Progressive Web App
- **Backend**: Supabase (Auth, Storage, Postgres)
- **AI Services**: OpenAI Whisper (transcription), Google Gemini (summaries + tags)
- **Database**: Supabase Postgres for structured data storage
- **Deployment**: Vercel static hosting
- **Distribution**: QR code → PWA installation

## Architecture Overview

### Core Data Flow
1. **Upload Pipeline**: User uploads → Direct Supabase Storage → Status updates
2. **Processing Pipeline**: Videos ≤25MB → Whisper transcription → Gemini summary/tags → Database storage
3. **Search Pipeline**: User searches → Text-based search across titles and tags

### Key Components
- **Mobile App**: TikTok-style video feed, upload interface, summary/tag display
- **AI Processing**: Direct API calls to OpenAI and Google AI services
- **Search System**: Simple text search with abbreviation expansion support
- **Tag Management**: User-editable AI-generated tags

## Development Commands

```bash
# Development server
npx expo start --web    # Primary development target (PWA)
npx expo start         # Full dev server with mobile QR code

# Build and deployment
npx expo export --platform web    # Build for production
npx vercel                        # Deploy to Vercel

# TypeScript validation
npx tsc --noEmit

# Project structure
npm install             # Install dependencies
```

## Database Schema Design

### Core Tables
- `users` - Supabase Auth integration
- `videos` - Metadata, storage URLs, processing status, thumbnails, tags
- `transcripts` - Full video transcriptions from Whisper
- `summaries` - AI-generated summaries from Gemini
- `notes` - User-added notes per video

### Key Relationships
- Videos have one transcript, one summary, many notes
- All tables use RLS (Row Level Security) for multi-tenant isolation

## Critical Integration Points

### Supabase Configuration
- Configure Storage buckets: `videos`, `thumbnails` 
- Set up Row Level Security (RLS) policies
- Execute SQL schema from `sql/supabase-setup.sql`

### AI API Integration
- OpenAI Whisper API for audio transcription (videos ≤25MB)
- Google Gemini API for summarization and tag generation
- Implement proper error handling and rate limiting

### PWA Features
- Service worker for offline functionality
- Web app manifest for installability
- Mobile-first responsive design

## Key Development Patterns

### Upload Flow
Direct client-to-Supabase-Storage upload with progress tracking. AI processing triggered for videos ≤25MB.

### Search Implementation  
Text-based search across video titles and tags with abbreviation expansion (e.g., "cs" → "computer science").

### Tag Management
AI-generated tags from Gemini with user ability to add/remove tags dynamically.

### Error Handling
Graceful handling of AI API failures, file upload errors, and offline scenarios with user-friendly feedback.

### Performance Considerations
- Lazy load video thumbnails and metadata
- Implement proper caching for AI responses  
- Mobile-optimized TikTok-style video feed
- Real-time upload progress tracking

## Environment Variables Required

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
GOOGLE_AI_API_KEY=your_gemini_api_key
```

## Current Status: MVP Complete ✅

### Deployed Features:
- **Video Upload**: Gallery/camera selection with progress tracking
- **AI Transcription**: Whisper API for videos ≤25MB
- **AI Summaries**: Gemini-generated summaries with key insights
- **Smart Tags**: AI-generated tags with user edit/delete capability
- **Search & Filter**: Text search across titles and tags with abbreviation support
- **PWA**: Full Progressive Web App with offline support and installability
- **Mobile-Optimized**: TikTok-style feed designed for mobile browsers
- **User Authentication**: Secure Supabase auth with RLS policies

### Key Components:
- `VideoGridItem`: Mobile-optimized video cards with thumbnails and metadata
- `VideoDetailsSheet`: Swipe-up modal with summaries, transcripts, and tags
- `UploadProgressModal`: Real-time upload progress with visual feedback
- `webUploadService`: Direct-to-Supabase upload with progress tracking
- `aiService`: OpenAI Whisper + Google Gemini integration

### Architecture:
- **PWA-First**: Mobile browser optimized, installable via home screen
- **Direct API**: Client-side AI API calls, no complex backend processing
- **Real-time**: Supabase subscriptions for upload status updates
- **Vercel Deployed**: Production app at https://videoai-app.vercel.app

## Current Limitations

- AI processing limited to videos ≤25MB (Whisper API constraint)
- Maximum video upload: 50MB per file
- Text-based search only (no semantic/vector search)
- PWA-only distribution (no native app stores)
- Optimized for <10 users (free tier usage)

## Next Phase: Native App Conversion

The project is transitioning from PWA to native iOS/Android apps for broader distribution and enhanced mobile functionality.