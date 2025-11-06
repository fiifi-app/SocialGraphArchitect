# Social Graph Connector

## Overview
The Social Graph Connector is a web-based application designed for VCs and investors. Its primary purpose is to help users identify valuable introductions from their conversations by automatically matching discussion topics against their network's investment theses. Key capabilities include recording conversations with live transcription, extracting investment entities (sectors, stages, check sizes, geos, personas, intents), matching these against a contact/thesis database with explainable scoring, and generating double opt-in introduction emails using AI. The project aims to provide multi-user support with secure authentication and a clean, professional user interface.

## User Preferences
I prefer the agent to focus on high-level feature implementation and architectural consistency. When making changes, please prioritize the established design guidelines, aiming for a minimalist and professional UI with high information density and clear visual hierarchy. I appreciate detailed explanations for significant changes or complex logic. For UI/UX elements, refer to the `design_guidelines.md` for inspiration from Granola and Linear. I expect the agent to utilize the existing `run_test` tool for E2E testing with Playwright for UI testing. Do not make changes to files or folders not explicitly mentioned or required for the task.

## System Architecture
The application follows a modern web architecture, utilizing React 18 with TypeScript for the frontend, built with Vite. State management is handled by TanStack Query v5, routing by wouter, and styling with Tailwind CSS and shadcn/ui. Forms are managed with React Hook Form and Zod. The backend is powered by Supabase, leveraging PostgreSQL for the database with Row Level Security (RLS), Supabase Auth for authentication, and Edge Functions (Deno/TypeScript) for server-side logic.

**UI/UX Decisions:**
The design draws inspiration from Granola and Linear, emphasizing high information density, a clean and professional aesthetic, subtle animations, and clear visual hierarchy. The color scheme uses professional blue/purple as primary, grayscale for text hierarchy, and subtle accents for key actions.

**Technical Implementations:**
- **Data Access:** Frontend CRUD operations directly access Supabase via its SDK, protected by RLS. AI-driven operations utilize Supabase Edge Functions with service role privileges.
- **Database Schema:** Comprises 14 tables with RLS, covering user profiles, contacts, investment theses, conversations, entity extraction, match suggestions, and introduction workflows.
- **Contact Management:** Includes full CRUD for contacts, pagination, searching, real-time updates, toast notifications, and comprehensive CSV bulk import with validation and enrichment.
- **Contact Enrichment:** An Edge Function uses Hunter.io and People Data Labs APIs for email verification and person enrichment, with a preview showing original vs. enriched data.
- **Investor Profile Feature:** Incorporates an `is_investor` flag, extended contact types (GP/Angel/FamilyOffice/Startup/Other), check size ranges, and investor notes, conditionally visible based on selected contact types. A feature flag system manages the visibility of these fields based on database migration status.
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