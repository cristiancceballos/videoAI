-- Enable realtime for videos table to track AI processing status updates
ALTER PUBLICATION supabase_realtime ADD TABLE videos;

-- Enable realtime for summaries table to track new AI summaries
ALTER PUBLICATION supabase_realtime ADD TABLE summaries;

-- Note: Realtime is required for the VideoDetailsSheet to update automatically
-- when AI processing completes without requiring navigation