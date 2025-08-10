-- Add GIN indexes for better search performance on tags
CREATE INDEX IF NOT EXISTS idx_videos_tags_gin ON videos USING GIN (tags);

-- Add full text search capability to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS search_vector tsvector 
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tags::text, '')), 'C')
  ) STORED;

-- Create index on search vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_videos_search_vector ON videos USING GIN (search_vector);

-- Create a function for flexible tag search
CREATE OR REPLACE FUNCTION search_videos_by_tag(search_query text, user_id_param uuid)
RETURNS TABLE (
  id uuid,
  title text,
  tags jsonb,
  created_at timestamptz,
  match_score real
) AS $$
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
$$ LANGUAGE plpgsql;

-- Add RLS policy for the search function
GRANT EXECUTE ON FUNCTION search_videos_by_tag TO authenticated;