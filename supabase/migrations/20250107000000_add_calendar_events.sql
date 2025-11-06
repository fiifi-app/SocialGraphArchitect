-- Create calendar_events table for manual event management (Granola-style workflow)
CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  attendees JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  meeting_url TEXT,
  external_event_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add event_id to conversations table to link conversations to calendar events
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS event_id VARCHAR REFERENCES calendar_events(id) ON DELETE SET NULL;

-- Create index for querying upcoming events efficiently
CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx ON calendar_events(owned_by_profile, start_time);
CREATE INDEX IF NOT EXISTS conversations_event_id_idx ON conversations(event_id);

-- Enable RLS on calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can insert their own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = owned_by_profile);

CREATE POLICY "Users can update their own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can delete their own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = owned_by_profile);
