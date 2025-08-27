-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS merge_tags_trigger ON public.videos;
DROP FUNCTION IF EXISTS public.merge_video_tags();

-- Ensure columns exist with proper defaults
ALTER TABLE public.videos 
ALTER COLUMN user_tags SET DEFAULT ARRAY[]::text[],
ALTER COLUMN ai_tags SET DEFAULT ARRAY[]::text[],
ALTER COLUMN tags SET DEFAULT ARRAY[]::text[];