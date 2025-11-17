/**
 * This application uses Supabase as the default database.
 * 
 * All database operations are performed through:
 * - Frontend: Direct Supabase queries using hooks (useContacts, useConversations, etc.)
 * - Backend: Supabase Edge Functions for AI-powered operations
 * - Auth: Supabase Auth for user authentication
 * 
 * The Supabase client is configured in client/src/lib/supabase.ts
 * Database schema is defined in shared/schema.ts
 * Migrations are in supabase/migrations/
 */
