-- Add Google Calendar OAuth token storage to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_calendar_sync_token TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN NOT NULL DEFAULT false;

-- Create index for finding users with Google Calendar connected
CREATE INDEX IF NOT EXISTS idx_user_prefs_google_connected 
ON user_preferences(profile_id) 
WHERE google_calendar_connected = true;
