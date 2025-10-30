# Social Graph Connector

A web-based application for recording conversations with live transcription, extracting entities, matching them against a contact database, and suggesting high-quality introductions with explainable scoring.

## 🎯 Project Overview

**Purpose:** Help VCs and investors identify valuable introductions from their conversations by automatically matching discussion topics against their network's investment theses.

**Key Features:**
- 🎙️ Record conversations with live transcription (OpenAI Whisper)
- 🔍 Extract investment entities (sectors, stages, check sizes, geos, personas, intents)
- 🤝 Match against contact/thesis database with scoring (1-3 stars)
- 📧 Generate double opt-in introduction emails with GPT-4
- 🔐 Multi-user support with Supabase authentication

## 🏗️ Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Routing:** wouter
- **State Management:** TanStack Query v5
- **Styling:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Auth:** Supabase JS SDK

### Backend
- **Platform:** Supabase
- **Database:** PostgreSQL with Row Level Security (RLS)
- **Functions:** Edge Functions (Deno/TypeScript)
- **Auth:** Supabase Auth

### External Services
- **OpenAI:** Whisper (transcription) + GPT-4 (entity extraction, matching, email generation)
- **Supabase:** Database, Auth, Edge Functions, Realtime

## 📁 Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── contexts/        # React contexts (Auth)
│   │   ├── hooks/           # Supabase data access hooks
│   │   ├── lib/             # Utilities (Supabase client, Edge Functions)
│   │   └── pages/           # Route pages
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── extract-entities/
│   │   ├── generate-matches/
│   │   └── generate-intro-email/
│   └── migrations/          # Database migrations
├── shared/
│   └── schema.ts            # Shared TypeScript types (Drizzle schema)
└── server/                  # (Legacy - being removed)
```

## 🗄️ Database Schema

14 tables with Row Level Security:

**Core:**
- `profiles` - User profiles
- `user_preferences` - App settings
- `contacts` - Network contacts
- `contact_shares` - Shared contacts
- `theses` - Investment criteria

**Conversations:**
- `conversations` - Recording sessions
- `conversation_participants` - Participants
- `conversation_segments` - Transcript lines
- `conversation_entities` - Extracted entities

**Matching:**
- `match_suggestions` - Scored matches (1-3 stars)
- `introduction_threads` - Intro workflow
- `introduction_messages` - Email tracking

**Relationships:**
- `relationship_events` - Interaction history
- `relationship_scores` - Relationship strength

## 🔑 Environment Variables

**Frontend (Replit Secrets):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

**Edge Functions (Supabase Secrets):**
- `OPENAI_API_KEY` - OpenAI API key

**Auto-set by Supabase CLI:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 🚀 Getting Started

### 1. Install Dependencies
Already done via packager_tool.

### 2. Link Supabase Project
```bash
supabase link --project-ref <your-project-ref>
```

### 3. Run Database Migrations
```bash
supabase db push
```

### 4. Deploy Edge Functions
```bash
supabase functions deploy extract-entities
supabase functions deploy generate-matches
supabase functions deploy generate-intro-email

# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=your-key
```

### 5. Start Development
```bash
npm run dev
```

## 📝 Data Access Patterns

### Frontend Direct Access (via Supabase SDK)
All CRUD operations go directly to Supabase, protected by RLS:
- Contacts management
- Conversations & transcripts
- Profile & preferences
- Match suggestions (read)

### Edge Functions (for AI Operations)
Privileged operations requiring service role:
- Extract entities from conversations (GPT-4)
- Generate match suggestions (GPT-4 + scoring)
- Generate introduction emails (GPT-4)

**Example:**
```typescript
import { useContacts, useCreateContact } from '@/hooks/useContacts';
import { extractEntities } from '@/lib/edgeFunctions';

// Direct Supabase access
const { data: contacts } = useContacts();
const createContact = useCreateContact();

// Edge Function call
const entities = await extractEntities(conversationId);
```

## 🎨 Design Guidelines

**Inspiration:** Granola + Linear minimalist design

**Principles:**
- High information density
- Clean, professional UI
- Subtle animations
- Clear visual hierarchy

**Color Scheme:**
- Primary: Professional blue/purple
- Neutral: Gray scale for text hierarchy
- Accent: Subtle highlights for key actions

## 🧪 Testing

### Manual Testing Checklist
- [ ] Sign up / Login / Logout
- [ ] Add/edit contacts
- [ ] Record conversation (when complete)
- [ ] Extract entities
- [ ] Generate matches
- [ ] Generate intro email

### E2E Testing (Playwright)
Use `run_test` tool for automated UI testing.

## 📊 Current Status

### ✅ Completed
- Frontend Supabase integration
- Authentication (Login/Signup)
- Protected routes
- Data access hooks (Contacts, Conversations, Profile, Matches)
- Edge Functions (3 functions created)
- Database schema (14 tables with RLS)
- Contacts page (uses Supabase)

### 🚧 In Progress
- Contact creation UI
- History page integration
- ConversationDetail integration
- Record page with real-time matching

### 📋 Pending
- Thesis management UI
- Introduction email review UI
- Relationship tracking display
- Remove legacy Express backend

## 🔗 Important Links

- **Supabase Dashboard:** https://supabase.com/dashboard
- **OpenAI API:** https://platform.openai.com
- **Design Guidelines:** `design_guidelines.md`
- **Migration Guide:** `MIGRATION_COMPLETE.md`
- **Database Plan:** `DATABASE_PLAN.md`

## 🛠️ Development Commands

```bash
# Supabase
supabase link --project-ref <ref>
supabase db push
supabase functions deploy <name>
supabase gen types typescript --linked

# Application
npm run dev                 # Start dev server
npm run build              # Build for production
```

## 🔐 Security Notes

- All database access is protected by Row Level Security (RLS)
- Users can only access their own data
- Service role key is server-side only (Edge Functions)
- OpenAI API key stored in Supabase secrets
- No sensitive data in frontend code

## 📚 Additional Documentation

- `MIGRATION_COMPLETE.md` - Detailed migration guide
- `SUPABASE_SETUP.md` - Supabase CLI setup
- `DATABASE_PLAN.md` - Database architecture plan
- `design_guidelines.md` - UI/UX guidelines

---

**Last Updated:** October 30, 2025
**Current Phase:** Supabase migration in progress
**Next Milestone:** Complete remaining page integrations
