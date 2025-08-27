alter table "public"."videos" add column "bunny_thumbnail_url" text;

alter table "public"."videos" add column "bunny_video_id" text;

alter table "public"."videos" add column "bunny_video_url" text;

alter table "public"."videos" add column "codec" text;

alter table "public"."videos" add column "fps" double precision;

alter table "public"."videos" add column "search_vector" tsvector generated always as (((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE((tags)::text, ''::text)), 'C'::"char"))) stored;

CREATE INDEX idx_videos_search_vector ON public.videos USING gin (search_vector);

CREATE INDEX idx_videos_source_type ON public.videos USING btree (source_type);

CREATE INDEX idx_videos_tags_gin ON public.videos USING gin (tags);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.search_videos_by_tag(search_query text, user_id_param uuid)
 RETURNS TABLE(id uuid, title text, tags jsonb, created_at timestamp with time zone, match_score real)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.title,
    v.tags,
    v.created_at,
    -- Calculate relevance score
    CASE 
      -- Exact tag match gets highest score
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v.tags) AS tag 
        WHERE lower(tag) = lower(search_query)
      ) THEN 1.0
      -- Partial tag match gets medium score
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v.tags) AS tag 
        WHERE lower(tag) LIKE '%' || lower(search_query) || '%'
      ) THEN 0.7
      -- Title match gets lower score
      WHEN lower(v.title) LIKE '%' || lower(search_query) || '%' THEN 0.5
      ELSE 0.3
    END AS match_score
  FROM videos v
  WHERE 
    v.user_id = user_id_param
    AND v.status = 'ready'
    AND (
      -- Search in tags
      EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v.tags) AS tag 
        WHERE lower(tag) LIKE '%' || lower(search_query) || '%'
      )
      -- Search in title
      OR lower(v.title) LIKE '%' || lower(search_query) || '%'
      -- Full text search
      OR v.search_vector @@ plainto_tsquery('english', search_query)
    )
  ORDER BY match_score DESC, v.created_at DESC;
END;
$function$
;


