-- Final removal of trigger and function to fix upload issues
-- This must run AFTER all other migrations

DROP TRIGGER IF EXISTS merge_tags_trigger ON public.videos;
DROP FUNCTION IF EXISTS public.merge_video_tags() CASCADE;

-- Ensure the columns have proper defaults
ALTER TABLE public.videos 
ALTER COLUMN user_tags SET DEFAULT ARRAY[]::text[],
ALTER COLUMN ai_tags SET DEFAULT ARRAY[]::text[];