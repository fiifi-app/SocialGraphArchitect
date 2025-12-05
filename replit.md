# Social Graph Connector

## Overview
The Social Graph Connector is a web-based application designed for VCs and investors. Its primary purpose is to help users identify valuable introductions from their conversations by automatically matching discussion topics against their network's investment theses. Key capabilities include recording conversations with live transcription, extracting investment entities (sectors, stages, check sizes, geos, personas, intents), matching these against a contact/thesis database with explainable scoring, and generating double opt-in introduction emails using AI. The project aims to provide multi-user support with secure authentication and a clean, professional user interface.

## REMINDER: Deploy Edge Functions (when at laptop)
Deploy the Edge Functions to Supabase:
```bash
# From your laptop with Supabase CLI installed:
supabase functions deploy research-contact --project-ref YOUR_PROJECT_REF
supabase functions deploy batch-extract-thesis --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=your_key --project-ref YOUR_PROJECT_REF
```
Or manually via Supabase Dashboard → Edge Functions → Create → paste code from:
- `supabase/functions/research-contact/index.ts` (AI bio/thesis research)
- `supabase/functions/batch-extract-thesis/index.ts` (batch thesis extraction)

## Recent Changes
- **Auto-Enrich Contact Bios (NEW):** AI-powered research pipeline on Settings page:
  - Step 1: Researches each contact using OpenAI with web_search tool for real external data
  - Step 2: For investor contacts (GP, Angel, Family Office, PE), also searches for investment thesis info
  - Step 3: Auto-detects contact types (LP, GP, Angel, Family Office, Startup, PE) from title/bio and sets tags
  - Step 4: Automatically sets is_investor=true when investor-type tags are detected
  - Step 5: Automatically runs thesis extraction on ALL contacts after enrichment completes
  - Browser-based batch processing with pause/resume/stop controls
  - Processes 3 contacts at a time with 3-second delays for rate limiting
  - Edge Function: `research-contact` handles AI research + auto-tagging per contact
- **Automatic Thesis Extraction:** AI-powered thesis extraction now runs automatically when:
  - A new contact is created (if they have bio, title, or investor notes)
  - Contacts are imported via CSV (batch processing after enrichment completes)
  - Manual "Extract thesis keywords" button available as fallback for existing contacts
  - Extracts sectors, stages, check sizes, geos, and keywords from contact profiles
  - Keywords displayed as badges in ContactCard
- **Transcript Speaker Names:** TranscriptView and StructuredTranscriptView now display the logged-in user's registered name (from profile) instead of "Unknown"
- **Post-Conversation Validation Popover:** New ContactValidationPopover component appears after recording stops, allowing users to:
  - Identify detected speakers and mark them as "new contact" or "existing contact"
  - Capture conversation keywords (Sector, Check Size, Geographic Focus) for better context tracking
- **Authentication:** Implemented Supabase PKCE authentication flow for seamless mobile compatibility
- **Password Visibility Toggle:** Added eye icon button on login page to reveal/hide passwords during entry
- **Login UI Cleanup:** Removed Supabase connection status indicator for cleaner, more focused login experience
- **Data Fetching:** Fixed contacts and conversation queries to properly fetch all data without user ID filtering (relies on RLS)
- **Mobile Support:** Both desktop and mobile versions now working seamlessly with consistent authentication and data access

## User Preferences
I prefer the agent to focus on high-level feature implementation and architectural consistency. When making changes, please prioritize the established design guidelines, aiming for a minimalist and professional UI with high information density and clear visual hierarchy. I appreciate detailed explanations for significant changes or complex logic. For UI/UX elements, refer to the `design_guidelines.md` for inspiration from Granola and Linear. I expect the agent to utilize the existing `run_test` tool for E2E testing with Playwright for UI testing. Do not make changes to files or folders not explicitly mentioned or required for the task.

## System Architecture
The application follows a modern web architecture, utilizing React 18 with TypeScript for the frontend, built with Vite. State management is handled by TanStack Query v5, routing by wouter, and styling with Tailwind CSS and shadcn/ui. Forms are managed with React Hook Form and Zod. The backend is powered by Supabase, leveraging PostgreSQL for the database with Row Level Security (RLS), Supabase Auth for authentication, and Edge Functions (Deno/TypeScript) for server-side logic.

**UI/UX Decisions:**
The design draws inspiration from Granola and Linear, emphasizing high information density, a clean and professional aesthetic, subtle animations, and clear visual hierarchy. The color scheme uses professional blue/purple as primary, grayscale for text hierarchy, and subtle accents for key actions.

**Technical Implementations:**
- **Data Access:** Frontend CRUD operations directly access Supabase via its SDK, protected by RLS. AI-driven operations utilize Supabase Edge Functions with service role privileges.
- **Database Schema:** Comprises 15 tables with RLS, covering user profiles, contacts, investment theses, calendar events, conversations, entity extraction, match suggestions, and introduction workflows.
- **Contact Management:** Includes full CRUD for contacts, pagination, searching, real-time updates, toast notifications, and comprehensive CSV bulk import with validation and enrichment. Contact type auto-detection recognizes keywords in title field (GP, Angel, Family Office, Startup, etc.) and automatically selects appropriate tags.
- **Contact Enrichment:** A comprehensive Edge Function uses Hunter.io and People Data Labs APIs for deep contact enrichment. From PDL, it captures personal info (name, email, title, company, location, phone, LinkedIn, Twitter, bio), company info (website, address, size, founded date, LinkedIn, Twitter, Facebook), all with preview showing original vs. enriched data side-by-side. LinkedIn bio is displayed on contact cards (first 140 characters) and fully editable in the contact dialog's "About" section.
- **Investor Profile Feature:** Incorporates an `is_investor` flag, extended contact types (GP/Angel/FamilyOffice/Startup/PE), check size ranges, and investor notes, conditionally visible based on selected contact types. A feature flag system manages the visibility of these fields based on database migration status.
- **Google Calendar Integration (OAuth-based):** Full Google Calendar OAuth integration with automatic event sync - **FULLY OPERATIONAL**:
  - Google OAuth 2.0 flow with access/refresh token management stored in user_preferences table
  - OAuth consent screen configured as "External" with test users added
  - Backend OAuth routes (`/api/auth/google/connect`, `/callback`, `/disconnect`) handle authentication
  - Supabase Edge Function (sync-google-calendar) deployed with all secrets configured
  - Implements incremental sync using Google's sync tokens with pagination support
  - Automatic token refresh when expired, ensuring continuous sync capability
  - calendar_events table stores meeting metadata (title, time, attendees, location, meeting URL, external_event_id)
  - "Coming Up" section on Home page showing today's upcoming meetings with one-click "Record" buttons
  - Event details displayed prominently on Record page (title, time, location, attendees) before recording starts
  - Conversations automatically linked to calendar events via event_id foreign key
  - Event titles auto-populate conversation titles when recording from calendar
  - Settings page provides "Connect Google Calendar" button and connection status display
  - Automatic background sync on Home page load, with manual refresh button
  - Handles cancelled events and duplicate detection during sync
  - All security vulnerabilities addressed: session authentication, CSRF protection, token refresh error handling
- **Real-Time Conversation Recording:** Production-ready implementation featuring:
  - Browser audio capture via MediaRecorder API with 5-second chunking
  - Real-time transcription using OpenAI Whisper API (transcribe-audio Edge Function)
  - AI-powered participant extraction from conversations (extract-participants Edge Function)
  - Live contact matching with 1-3 star scoring every 30 seconds (generate-matches Edge Function)
  - Post-conversation processing with duplicate detection and auto-fill (process-participants Edge Function)
  - Real-time Supabase subscriptions for instant transcript updates
  - Pending contact workflow: new contacts discovered during conversations require user review/acceptance
  - Contact status field (verified/pending) for managing discovered contacts
  - Comprehensive security: ALL conversation-related Edge Functions enforce ownership verification to prevent cross-tenant data exposure
- **Authentication System:**
  - Supabase PKCE flow for mobile-friendly authentication
  - Password visibility toggle on login page for better UX
  - Seamless experience across desktop and mobile browsers
  - Singleton Supabase client to prevent duplicate authentication instances

**System Design Choices:**
- **Security:** RLS protects all database access. Service role keys are confined to Edge Functions. API keys are secured in Supabase secrets.
- **Modularity:** Clear project structure separating frontend, Supabase functions, and shared types.
- **Scalability:** Supabase provides a scalable backend infrastructure.
- **Observability:** Real-time statistics are pulled from Supabase for total conversations, introductions made, and new contacts added.

## External Dependencies
- **OpenAI:** Utilized for Whisper (transcription) and GPT-4 (entity extraction, matching, email generation).
- **Supabase:** Provides Database, Authentication, Edge Functions, and Realtime capabilities.
- **Hunter.io:** Used for email finding and verification in contact enrichment.
- **People Data Labs:** Used for person enrichment (LinkedIn, job history, skills) in contact enrichment.
