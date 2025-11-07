-- Enable Realtime for conversation_segments table
ALTER TABLE conversation_segments REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_segments;
