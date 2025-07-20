# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GrowthOfWisdom** - A mobile-first Progressive Web App (PWA) for video organization with AI-powered summaries and Q&A. Built with Expo for web deployment, allowing users to upload videos, generate AI summaries, and interact with content through intelligent chat. Distributed via QR code for easy sharing to <10 users.

## Technology Stack

- **Frontend**: Expo Web (PWA) - mobile-first Progressive Web App
- **Backend**: Supabase (Auth, Storage, Postgres+pgvector, Edge Functions, Queues)
- **AI Services**: OpenAI (Whisper for transcription, GPT-4 for summaries/Q&A, text-embedding-ada-002)
- **Database**: Supabase Postgres with pgvector extension for vector similarity search
- **Video Processing**: ffmpeg via Supabase Edge Functions for audio extraction
- **Real-time**: Supabase Realtime for status updates
- **Deployment**: Static web hosting (Vercel/Netlify)
- **Distribution**: QR code → PWA installation

## Architecture Overview

### Core Data Flow
1. **Upload Pipeline**: User uploads → Presigned URL → Supabase Storage → Queue job trigger
2. **Processing Pipeline**: Queue worker → Audio extraction (ffmpeg) → Whisper transcription → GPT-4 summary → Vector embeddings → Database storage
3. **Retrieval Pipeline**: User question → Embed query → pgvector similarity search → GPT-4 with context → Response

### Key Components
- **Mobile App**: Video feed, upload interface, swipe-up summary sheet, chat interface
- **Background Processing**: Supabase Queue workers for video processing
- **Edge Functions**: Upload hooks, AI processing coordinators, search endpoints
- **Vector Search**: Chunked transcripts with embeddings for RAG-powered Q&A

## Development Commands

```bash
# Project setup (completed)
npx create-expo-app --template
npm install @supabase/supabase-js

# PWA dependencies
npx expo install expo-image-picker expo-file-system expo-media-library expo-av
npx expo install react-dom react-native-web @expo/metro-runtime

# Development (PWA-focused)
npx expo start --web    # Primary development target
npx expo start         # Full dev server with QR code

# TypeScript validation
npx tsc --noEmit

# Build for production (PWA)
npx expo export --platform web
npx expo build:web

# Supabase
npx supabase start
npx supabase db reset
npx supabase functions serve
npx supabase functions deploy <function-name>

# Deployment
# Build → Upload to Vercel/Netlify → Generate QR code
```

## Database Schema Design

### Core Tables
- `users` - Supabase Auth integration
- `videos` - Metadata, storage URLs, processing status, thumbnails
- `transcripts` - Full video transcriptions from Whisper
- `summaries` - AI-generated summaries from GPT-4
- `notes` - User-added notes per video (markdown support)
- `embeddings` - Vector embeddings for transcript chunks (pgvector)
- `conversations` - Q&A chat history per video

### Key Relationships
- Videos have one transcript, one summary, many notes, many embedding chunks
- All tables use RLS (Row Level Security) for multi-tenant isolation

## Critical Integration Points

### Supabase Configuration
- Enable pgvector extension in SQL editor
- Configure Storage buckets: `videos`, `thumbnails`, `transcripts`
- Set up Edge Functions for upload hooks and AI processing
- Configure Queues for background video processing

### AI API Integration
- OpenAI Whisper API for audio transcription
- GPT-4 Turbo for video summarization and Q&A responses
- Text-embedding-ada-002 for vector embeddings
- Implement proper error handling and rate limiting

### Real-time Features
- Subscribe to video status changes for processing updates
- Real-time chat message updates
- Push notifications when video processing completes

## Key Development Patterns

### Upload Flow
Use presigned URLs for direct client-to-storage upload to avoid server bandwidth limits. Trigger processing via Supabase Storage webhooks.

### Vector Search Implementation
Chunk transcripts into semantic segments (500-1000 chars), generate embeddings, store with metadata. Use hybrid search combining vector similarity and full-text search.

### Error Handling
Implement retry logic for AI API calls, graceful degradation for offline scenarios, and user-friendly error states for failed video processing.

### Performance Considerations
- Lazy load video thumbnails and metadata
- Implement proper caching for AI responses
- Use React Native performance best practices for large video lists
- Optimize vector search queries with proper indexing

## Environment Variables Required

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY= (for Edge Functions)
```

## Phase 2 Features (PWA Video Upload & Storage) ✅

### Completed PWA Features:
- **PWA Configuration**: Full manifest, service worker, add-to-home-screen capability
- **Web-Compatible Upload**: HTML5 file input, drag-drop support for mobile browsers
- **Mobile-First Design**: Responsive layout optimized for mobile devices
- **Cross-Platform Auth**: Web storage that works on mobile browsers
- **Real-time Updates**: Live status changes via Supabase subscriptions
- **File Validation**: Size (100MB), duration (30min), format checks
- **Video Grid Feed**: TikTok-style layout with thumbnails and status indicators
- **Secure Storage**: User-isolated file organization in Supabase Storage

### Key PWA Components:
- `WebVideoPreviewModal`: Browser-native video preview with HTML5 player
- `webMediaService`: Web-compatible file selection and camera access
- `webUploadService`: XMLHttpRequest-based uploads with progress tracking
- `webStorage`: localStorage/sessionStorage adapter for auth persistence
- `VideoCard`: Mobile-optimized video display with touch interactions

### PWA Architecture:
- **Web-First**: Built for mobile browsers, not native apps
- **Offline-Ready**: Service worker for basic offline functionality
- **Installable**: Add to home screen creates app-like experience
- **QR Distribution**: Easy sharing via QR code → instant PWA install

## Constraints

- Initial deployment targets <10 users (free tier optimization)
- Video upload size limits: 100MB per file, 30 minutes duration
- AI API rate limits require queueing for bulk processing (Phase 3)
- Mobile-first design with responsive web support