-- Migration: Add Contact Status Field
-- Version: 2025_01_06_contact_status
-- Description: Adds status field to contacts table for tracking pending/verified contacts

-- Step 1: Create enum type for contact status
DO $$ BEGIN
  CREATE TYPE contact_status_enum AS ENUM ('verified', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add status column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status contact_status_enum NOT NULL DEFAULT 'verified';

-- Step 3: Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- Step 4: Create index for finding pending contacts by owner
CREATE INDEX IF NOT EXISTS idx_contacts_pending ON contacts(owned_by_profile, status) 
WHERE status = 'pending';

-- Record this migration
INSERT INTO migration_versions (version) 
VALUES ('2025_01_06_contact_status')
ON CONFLICT (version) DO NOTHING;
