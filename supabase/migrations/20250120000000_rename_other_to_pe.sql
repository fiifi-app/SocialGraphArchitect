-- Migration: Rename 'Other' to 'PE' in contact_type_enum
-- Version: 2025_01_20_other_to_pe
-- Description: Updates contact_type_enum to replace 'Other' with 'PE'

-- Step 1: Add 'PE' to the enum if it doesn't exist
-- This must be in its own transaction and committed before use
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'PE' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contact_type_enum')
  ) THEN
    ALTER TYPE contact_type_enum ADD VALUE 'PE';
  END IF;
END $$;

-- IMPORTANT: The above ALTER TYPE must be committed before 'PE' can be used
-- In Supabase, run this migration, then run the next one separately
-- Or manually commit after step 1 before continuing

-- Record this migration (part 1)
INSERT INTO migration_versions (version) 
VALUES ('2025_01_20_other_to_pe_part1')
ON CONFLICT (version) DO NOTHING;
