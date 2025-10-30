# Supabase Migration - Completion Guide

## ✅ What's Been Completed

### 1. **Frontend Supabase Integration**
- ✅ Created Supabase client with environment variables
- ✅ Added authentication context (AuthContext)
- ✅ Created Login and Signup pages
- ✅ Protected routes with auth guards
- ✅ Created data access hooks:
  - `useContacts` - CRUD operations for contacts
  - `useConversations` - CRUD for conversations & transcripts
  - `useProfile` - User profile management
  - `useMatches` - Match suggestions

### 2. **Supabase Edge Functions**
- ✅ Created `extract-entities` - Extract investment entities using GPT-4
- ✅ Created `generate-matches` - Score contacts against conversation
- ✅ Created `generate-intro-email` - Generate double opt-in emails
- ✅ Created Edge Function wrapper (`client/src/lib/edgeFunctions.ts`)

### 3. **Database Schema**
- ✅ Created comprehensive SQL migration (`supabase/migrations/20250101000000_initial_schema.sql`)
- ✅ 14 tables with Row Level Security (RLS) policies
- ✅ Automatic profile creation on signup
- ✅ Proper indexes and foreign keys

### 4. **Updated Pages**
- ✅ Contacts page now uses Supabase hooks
- ✅ Loading states with skeletons
- ✅ Search functionality
- ✅ Empty states

---

## 🚧 Steps to Complete Migration

### Step 1: Link Supabase Project

```bash
# In the Replit Shell
supabase link --project-ref <your-project-ref>
```

**Find your project ref:**
- Go to https://supabase.com/dashboard
- Click on your project
- Copy the project reference from the URL: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`

### Step 2: Run Database Migrations

```bash
# Push migrations to Supabase
supabase db push
```

This will create all 14 tables with RLS policies.

**Verify migration:**
```bash
supabase db diff
```

Should show "No schema changes detected" if successful.

### Step 3: Deploy Edge Functions

```bash
# Deploy all Edge Functions
supabase functions deploy extract-entities
supabase functions deploy generate-matches
supabase functions deploy generate-intro-email
```

**Set Edge Function secrets:**
```bash
supabase secrets set OPENAI_API_KEY=your-openai-key
```

### Step 4: Test the Application

1. **Test Authentication:**
   - Visit your app
   - Click "Sign Up"
   - Create a new account
   - Verify you're redirected to the home page
   - Log out and log back in

2. **Test Contacts:**
   - Go to Contacts page
   - Should show empty state (no contacts yet)
   - Add a contact (feature still needs UI)

3. **Test Recording Flow (when complete):**
   - Record a conversation
   - Extract entities (calls Edge Function)
   - Generate matches (calls Edge Function)
   - Generate intro email (calls Edge Function)

---

## 📋 Remaining Work

### High Priority
1. **Add Contact Creation UI**
   - Dialog/modal for adding contacts
   - Form with validation (name, email, company, title)
   - Connect to `useCreateContact` hook

2. **Update History Page**
   - Use `useConversations` hook
   - Show real conversation data
   - Connect to Supabase

3. **Update ConversationDetail Page**
   - Use `useConversation` and `useConversationSegments` hooks
   - Load real transcript data
   - Integrate with Edge Functions for entity extraction

4. **Update Record Page**
   - Save recordings to Supabase
   - Call `extract-entities` Edge Function
   - Call `generate-matches` Edge Function
   - Display real-time results

### Medium Priority
5. **Add Thesis Management**
   - UI for adding investment theses to contacts
   - Sectors, stages, check sizes, geos, personas, intents

6. **Introduction Email Flow**
   - UI for reviewing generated emails
   - Edit email before sending
   - Track email status (sent, opened, replied)

7. **Relationship Tracking**
   - Display relationship scores on contact cards
   - Track interactions automatically
   - Update scores based on meetings

### Low Priority
8. **Remove Old Backend**
   - Delete `server/storage.ts`
   - Delete `server/db.ts`
   - Remove Drizzle dependencies
   - Remove Neon PostgreSQL dependency
   - Update `package.json`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│           FRONTEND (React)                   │
│                                              │
│  • Supabase SDK (Direct DB Access)          │
│  • Auth (Login/Signup/Logout)               │
│  • CRUD via Hooks (RLS Protected)           │
│  • Edge Functions (AI Operations)           │
└─────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────────┐
        │   SUPABASE PLATFORM        │
        ├───────────────────────────┤
        │  • PostgreSQL + RLS       │
        │  • Edge Functions (Deno)  │
        │  • Auth                   │
        │  • Realtime               │
        └───────────────────────────┘
                    │
                    ↓
            ┌──────────────┐
            │  OpenAI API  │
            └──────────────┘
```

**Benefits:**
- ✅ No Express backend to maintain
- ✅ Auto-scaling Edge Functions
- ✅ Built-in auth integration
- ✅ Row Level Security enforced
- ✅ Real-time subscriptions ready
- ✅ Simpler deployment

---

## 🔑 Environment Variables Reference

| Variable | Purpose | Location | Status |
|----------|---------|----------|---------|
| `VITE_SUPABASE_URL` | Frontend Supabase connection | Replit Secrets | ✅ Set |
| `VITE_SUPABASE_ANON_KEY` | Frontend auth (public) | Replit Secrets | ✅ Set |
| `SUPABASE_URL` | Edge Functions connection | Auto-set by Supabase CLI | ✅ Auto |
| `SUPABASE_ANON_KEY` | Edge Functions auth | Auto-set by Supabase CLI | ✅ Auto |
| `OPENAI_API_KEY` | OpenAI API access | Edge Function Secrets | ⚠️ Manual |

---

## 📊 Database Tables

| Table | Purpose | RLS Enabled |
|-------|---------|-------------|
| `profiles` | User profiles | ✅ |
| `user_preferences` | App settings | ✅ |
| `contacts` | Network contacts | ✅ |
| `contact_shares` | Shared contacts | ✅ |
| `theses` | Investment criteria | ✅ |
| `conversations` | Recording sessions | ✅ |
| `conversation_participants` | Participants | ✅ |
| `conversation_segments` | Transcript lines | ✅ |
| `conversation_entities` | Extracted entities | ✅ |
| `match_suggestions` | Scored matches | ✅ |
| `introduction_threads` | Intro workflow | ✅ |
| `introduction_messages` | Email tracking | ✅ |
| `relationship_events` | Interaction history | ✅ |
| `relationship_scores` | Relationship strength | ✅ |

---

## 🧪 Testing Checklist

- [ ] Can sign up with email/password
- [ ] Can log in with existing account
- [ ] Can log out
- [ ] Redirects to /login when not authenticated
- [ ] Contacts page loads (shows empty state)
- [ ] Can search contacts (when populated)
- [ ] History page loads
- [ ] Can record a conversation (when implemented)
- [ ] Entity extraction works (Edge Function)
- [ ] Match generation works (Edge Function)
- [ ] Intro email generation works (Edge Function)

---

## 💡 Development Commands

```bash
# Start local Supabase (optional)
supabase start

# View logs
supabase functions logs extract-entities
supabase functions logs generate-matches
supabase functions logs generate-intro-email

# Generate TypeScript types from database
supabase gen types typescript --linked > client/src/types/supabase.ts

# Create new migration
supabase migration new <name>

# Reset database (⚠️ destroys all data)
supabase db reset
```

---

## 🎯 Next Steps

1. Run migrations: `supabase db push`
2. Deploy Edge Functions (see Step 3 above)
3. Add contact creation UI
4. Update remaining pages (History, ConversationDetail, Record)
5. Test end-to-end recording flow
6. Remove old backend code

---

**Questions?** Check:
- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
