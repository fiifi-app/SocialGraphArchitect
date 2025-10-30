-- Social Graph Connector - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES (Links to auth.users)
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================

CREATE TABLE user_preferences (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  auto_transcribe BOOLEAN NOT NULL DEFAULT true,
  notification_email BOOLEAN NOT NULL DEFAULT true,
  match_threshold INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = profile_id);

-- ============================================================================
-- CONTACTS
-- ============================================================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_owner ON contacts(owned_by_profile);
CREATE INDEX idx_contacts_email ON contacts(email);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  WITH CHECK (auth.uid() = owned_by_profile);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  USING (auth.uid() = owned_by_profile);

-- ============================================================================
-- CONTACT SHARES
-- ============================================================================

CREATE TABLE contact_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  shared_with_profile UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, shared_with_profile)
);

CREATE INDEX idx_contact_shares_profile ON contact_shares(shared_with_profile);

ALTER TABLE contact_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contact_shares
      WHERE contact_id = contacts.id
      AND shared_with_profile = auth.uid()
    )
  );

-- ============================================================================
-- THESES
-- ============================================================================

CREATE TABLE theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sectors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  stages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  check_sizes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  geos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  personas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  intents TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_theses_contact ON theses(contact_id);
CREATE INDEX idx_theses_sectors ON theses USING GIN(sectors);
CREATE INDEX idx_theses_stages ON theses USING GIN(stages);

ALTER TABLE theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view theses for their contacts"
  ON theses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = theses.contact_id
      AND contacts.owned_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  duration_seconds INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_owner ON conversations(owned_by_profile);
CREATE INDEX idx_conversations_recorded ON conversations(recorded_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = owned_by_profile);

-- ============================================================================
-- CONVERSATION PARTICIPANTS
-- ============================================================================

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, contact_id)
);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of own conversations"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_participants.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- CONVERSATION SEGMENTS (Transcript)
-- ============================================================================

CREATE TABLE conversation_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_conversation ON conversation_segments(conversation_id, timestamp_ms);

ALTER TABLE conversation_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segments of own conversations"
  ON conversation_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_segments.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- CONVERSATION ENTITIES
-- ============================================================================

CREATE TABLE conversation_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence DECIMAL(3,2),
  context_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_conversation ON conversation_entities(conversation_id);
CREATE INDEX idx_entities_type ON conversation_entities(entity_type);

ALTER TABLE conversation_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entities of own conversations"
  ON conversation_entities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_entities.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- MATCH SUGGESTIONS
-- ============================================================================

CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 3),
  reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suggestions_conversation ON match_suggestions(conversation_id);
CREATE INDEX idx_suggestions_score ON match_suggestions(conversation_id, score DESC);
CREATE INDEX idx_suggestions_status ON match_suggestions(status);

ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suggestions for own conversations"
  ON match_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = match_suggestions.conversation_id
      AND conversations.owned_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- INTRODUCTION THREADS
-- ============================================================================

CREATE TABLE introduction_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES match_suggestions(id) ON DELETE CASCADE,
  initiated_by_profile UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_status TEXT NOT NULL DEFAULT 'draft',
  meeting_scheduled BOOLEAN NOT NULL DEFAULT false,
  meeting_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intro_threads_suggestion ON introduction_threads(suggestion_id);
CREATE INDEX idx_intro_threads_status ON introduction_threads(current_status);

ALTER TABLE introduction_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own introduction threads"
  ON introduction_threads FOR ALL
  USING (auth.uid() = initiated_by_profile);

-- ============================================================================
-- INTRODUCTION MESSAGES
-- ============================================================================

CREATE TABLE introduction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES introduction_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intro_messages_thread ON introduction_messages(thread_id);

ALTER TABLE introduction_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for own threads"
  ON introduction_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM introduction_threads
      WHERE introduction_threads.id = introduction_messages.thread_id
      AND introduction_threads.initiated_by_profile = auth.uid()
    )
  );

-- ============================================================================
-- RELATIONSHIP EVENTS
-- ============================================================================

CREATE TABLE relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score_delta DECIMAL(3,2),
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rel_events_contact ON relationship_events(contact_id);
CREATE INDEX idx_rel_events_profile ON relationship_events(profile_id);

ALTER TABLE relationship_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own relationship events"
  ON relationship_events FOR ALL
  USING (auth.uid() = profile_id);

-- ============================================================================
-- RELATIONSHIP SCORES
-- ============================================================================

CREATE TABLE relationship_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  last_interaction_at TIMESTAMPTZ,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, contact_id)
);

CREATE INDEX idx_rel_scores_profile ON relationship_scores(profile_id);
CREATE INDEX idx_rel_scores_score ON relationship_scores(current_score DESC);

ALTER TABLE relationship_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own relationship scores"
  ON relationship_scores FOR ALL
  USING (auth.uid() = profile_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  INSERT INTO public.user_preferences (profile_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_theses_updated_at BEFORE UPDATE ON theses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_suggestions_updated_at BEFORE UPDATE ON match_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_introduction_threads_updated_at BEFORE UPDATE ON introduction_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relationship_scores_updated_at BEFORE UPDATE ON relationship_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
