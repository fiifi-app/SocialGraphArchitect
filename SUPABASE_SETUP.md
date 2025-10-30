# Supabase CLI Setup Guide

This project uses the Supabase CLI to manage database migrations and local development.

## Quick Start

### 1. Link to Your Supabase Project

First, you need to link this Replit project to your Supabase project:

```bash
supabase link --project-ref <your-project-ref>
```

You can find your project reference in your Supabase dashboard URL:
- URL format: `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>`

When prompted, enter your Supabase database password.

### 2. Push Migrations to Supabase

Once linked, push the migration to create all tables:

```bash
supabase db push
```

This will:
- ✅ Create all 14 database tables
- ✅ Set up Row Level Security (RLS) policies
- ✅ Create indexes for performance
- ✅ Add triggers for auto-updating timestamps

### 3. Verify the Migration

Check that your tables were created:

```bash
supabase db diff
```

If everything is synced, you should see "No schema changes detected."

## Alternative: Manual Migration

If you prefer to run the SQL manually:

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase/migrations/20250101000000_initial_schema.sql`
5. Paste and click **Run**

## Environment Variables

Don't forget to add these to your Replit Secrets:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then restart the application.

## Useful CLI Commands

### Check migration status
```bash
supabase migration list
```

### Generate TypeScript types from database
```bash
supabase gen types typescript --linked > shared/supabase-types.ts
```

### View database schema
```bash
supabase db dump --schema public
```

### Create a new migration
```bash
supabase migration new <migration_name>
```

## Database Schema Overview

This migration creates 14 tables:

**Core Tables:**
- `profiles` - User profiles linked to Supabase auth
- `user_preferences` - App settings per user
- `contacts` - Network contacts
- `contact_shares` - Share contacts with other users
- `theses` - Investment criteria (sectors, stages, check sizes, etc.)

**Conversation Tables:**
- `conversations` - Recording sessions
- `conversation_participants` - Participants in conversations
- `conversation_segments` - Timestamped transcript lines
- `conversation_entities` - Extracted entities from conversations

**Matching & Intro Tables:**
- `match_suggestions` - Scored contact matches (1-3 stars)
- `introduction_threads` - Double opt-in intro workflow
- `introduction_messages` - Email tracking for intros

**Relationship Tables:**
- `relationship_events` - Interaction history
- `relationship_scores` - Relationship strength scores

All tables include Row Level Security (RLS) to ensure users can only access their own data.
