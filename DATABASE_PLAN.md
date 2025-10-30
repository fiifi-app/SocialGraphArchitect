# Social Graph Connector - Database & Authentication Plan

## 🔐 Authentication Flow

### Supabase Auth Integration
- **Provider**: Supabase Auth (email/password + social logins)
- **Client Flow**: 
  - Users sign up/login via Supabase JS SDK
  - Session JWT stored in browser
  - Protected routes check for valid session
- **Backend Verification**:
  - Validate JWT on API requests
  - Use `auth.getUser()` for session verification
  - Service role key for server-side operations (transcription ingestion)

### User Onboarding
1. Sign up with email/password or social OAuth
2. Create profile record (linked to `auth.users`)
3. Set preferences (transcription settings, notification preferences)
4. Optional: Import existing contacts

---

## 📊 Database Schema

### Core Tables

#### 1. **profiles**
Links to Supabase auth.users, stores user metadata
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user', -- 'user' | 'admin'
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. **user_preferences**
User-specific settings
```sql
CREATE TABLE user_preferences (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  auto_transcribe BOOLEAN DEFAULT true,
  notification_email BOOLEAN DEFAULT true,
  match_threshold INTEGER DEFAULT 2, -- Minimum score to surface matches
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **contacts**
People in the user's network
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  is_shared BOOLEAN DEFAULT false, -- Can other users see this contact?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_owner ON contacts(owned_by_profile);
CREATE INDEX idx_contacts_email ON contacts(email);
```

#### 4. **contact_shares**
Enables sharing contacts across network
```sql
CREATE TABLE contact_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  shared_with_profile UUID REFERENCES profiles(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'view', -- 'view' | 'intro_request'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, shared_with_profile)
);

CREATE INDEX idx_contact_shares_profile ON contact_shares(shared_with_profile);
```

#### 5. **theses**
Investment theses linked to contacts (for matching)
```sql
CREATE TABLE theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  sectors TEXT[], -- ['AI', 'DevTools', 'FinTech']
  stages TEXT[], -- ['Seed', 'Series A']
  check_sizes TEXT[], -- ['$1M-$3M', '$3M-$5M']
  geos TEXT[], -- ['SF Bay Area', 'NYC']
  personas TEXT[], -- ['Technical Founders', 'B2B SaaS']
  intents TEXT[], -- ['Invest', 'Advise', 'Recruit']
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_theses_contact ON theses(contact_id);
CREATE INDEX idx_theses_sectors ON theses USING GIN(sectors);
CREATE INDEX idx_theses_stages ON theses USING GIN(stages);
```

#### 6. **conversations**
Meeting recordings
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  duration_seconds INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed', -- 'recording' | 'processing' | 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_owner ON conversations(owned_by_profile);
CREATE INDEX idx_conversations_recorded ON conversations(recorded_at DESC);
```

#### 7. **conversation_participants**
Who was in the meeting
```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, contact_id)
);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
```

#### 8. **conversation_segments**
Transcript with timestamps
```sql
CREATE TABLE conversation_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_segments_conversation ON conversation_segments(conversation_id, timestamp_ms);
```

#### 9. **conversation_entities**
Extracted entities from conversation
```sql
CREATE TABLE conversation_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'sector' | 'stage' | 'check_size' | 'geo' | 'persona' | 'intent'
  value TEXT NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  context_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_conversation ON conversation_entities(conversation_id);
CREATE INDEX idx_entities_type ON conversation_entities(entity_type);
```

#### 10. **match_suggestions**
AI-generated intro suggestions
```sql
CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 3), -- 1=low, 2=medium, 3=high
  reasons JSONB NOT NULL, -- ['reason1', 'reason2', ...]
  justification TEXT, -- Detailed explanation
  status TEXT DEFAULT 'pending', -- 'pending' | 'promised' | 'maybe' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suggestions_conversation ON match_suggestions(conversation_id);
CREATE INDEX idx_suggestions_score ON match_suggestions(conversation_id, score DESC);
CREATE INDEX idx_suggestions_status ON match_suggestions(status);
```

#### 11. **introduction_threads**
Tracks intro email exchanges (double opt-in)
```sql
CREATE TABLE introduction_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES match_suggestions(id) ON DELETE CASCADE,
  initiated_by_profile UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_a_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  current_status TEXT DEFAULT 'draft', -- 'draft' | 'sent_to_a' | 'sent_to_b' | 'both_confirmed' | 'intro_made' | 'declined'
  meeting_scheduled BOOLEAN DEFAULT false,
  meeting_outcome TEXT, -- 'positive' | 'neutral' | 'no_meeting'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intro_threads_suggestion ON introduction_threads(suggestion_id);
CREATE INDEX idx_intro_threads_status ON introduction_threads(current_status);
```

#### 12. **introduction_messages**
Email messages in the intro flow
```sql
CREATE TABLE introduction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES introduction_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'to_contact_a' | 'to_contact_b' | 'double_opt_in'
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intro_messages_thread ON introduction_messages(thread_id);
```

#### 13. **relationship_events**
Track relationship strength changes
```sql
CREATE TABLE relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'meeting' | 'email' | 'intro_made' | 'intro_received'
  score_delta DECIMAL(3,2), -- Change in relationship strength
  notes TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rel_events_contact ON relationship_events(contact_id);
CREATE INDEX idx_rel_events_profile ON relationship_events(profile_id);
```

#### 14. **relationship_scores**
Materialized relationship strength
```sql
CREATE TABLE relationship_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  current_score DECIMAL(3,2) DEFAULT 0.5, -- 0.00 to 1.00
  last_interaction_at TIMESTAMPTZ,
  interaction_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, contact_id)
);

CREATE INDEX idx_rel_scores_profile ON relationship_scores(profile_id);
CREATE INDEX idx_rel_scores_score ON relationship_scores(current_score DESC);
```

---

## 🔒 Row Level Security (RLS) Policies

### General Approach
- Enable RLS on all tables
- Users can only access their own data
- Contacts can be shared via `contact_shares` table
- Conversations visible to owner + participants
- Introduction threads visible to initiator + involved contacts

### Example Policies

```sql
-- Profiles: users can view their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Contacts: users see owned contacts + shared contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can view shared contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contact_shares
      WHERE contact_id = contacts.id
      AND shared_with_profile = auth.uid()
    )
  );

-- Conversations: only owner can access
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = owned_by_profile);
```

---

## 🚀 Migration Strategy

### Phase 1: Setup Supabase
1. Create Supabase project (already have credentials)
2. Run SQL migrations to create tables
3. Enable RLS policies
4. Set up authentication in Supabase dashboard

### Phase 2: Update Schema Definition
1. Update `shared/schema.ts` with new Drizzle schema
2. Add Supabase client initialization
3. Create type definitions from schema

### Phase 3: Implement Auth
1. Install `@supabase/supabase-js`
2. Create auth context provider
3. Add login/signup pages
4. Protect routes with auth guards
5. Update backend to verify JWT tokens

### Phase 4: Data Layer Migration
1. Replace `MemStorage` with Supabase queries
2. Create repository pattern for each entity
3. Implement RLS-safe RPC functions for complex queries
4. Add error handling and retry logic

### Phase 5: Feature Rollout
1. User authentication and profiles
2. Contact management (CRUD)
3. Conversation recording with transcript storage
4. Entity extraction and storage
5. Match suggestion engine
6. Introduction email workflow

---

## 📈 Key Indexes

```sql
-- Fast contact lookups
CREATE INDEX idx_contacts_name ON contacts USING GIN(to_tsvector('english', name));

-- Entity search
CREATE INDEX idx_entities_value ON conversation_entities USING GIN(to_tsvector('english', value));

-- Match suggestion queries
CREATE INDEX idx_suggestions_composite ON match_suggestions(conversation_id, score DESC, status);

-- Relationship queries
CREATE INDEX idx_rel_scores_composite ON relationship_scores(profile_id, current_score DESC);
```

---

## 🎯 Next Steps

1. **Create Supabase migrations** - Generate SQL files for all tables
2. **Install Supabase client** - Add `@supabase/supabase-js` to project
3. **Implement authentication** - Login/signup flow with protected routes
4. **Build data access layer** - Replace in-memory storage with Supabase queries
5. **Test with demo data** - Seed database and verify all flows work
