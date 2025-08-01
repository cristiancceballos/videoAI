-- Fix Supabase Security Issues

-- 1. Fix Function Search Path Mutable issue
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Recreate with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Reattach the trigger to any tables that use it
CREATE TRIGGER update_videos_updated_at 
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at 
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Move pgvector extension to dedicated schema
-- First create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;

-- Drop vector extension from public schema and recreate in extensions schema
-- WARNING: This will drop any vector columns! Back up your data first.
-- If you have existing vector data, you'll need to migrate it.

-- First check if you have any vector columns in use:
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE data_type = 'USER-DEFINED'
AND udt_name = 'vector';

-- If no vector columns exist, you can safely run:
/*
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector SCHEMA extensions;

-- Update search_path for your database to include extensions
ALTER DATABASE postgres SET search_path TO public, extensions;
*/

-- 3. Enable Leaked Password Protection (do this in Supabase Dashboard)
-- Go to Authentication > Settings > Security
-- Enable "Leaked password protection"

-- 4. Enable MFA Options (do this in Supabase Dashboard)
-- Go to Authentication > Settings > Multi-Factor Auth
-- Enable "Time-based One-Time Password (TOTP)"

-- Additional security recommendations:
-- Enable RLS on all tables if not already enabled
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;