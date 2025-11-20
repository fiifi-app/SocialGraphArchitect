-- Migration: Rename 'Other' to 'PE' in contact_type_enum
-- Version: 2025_01_20_other_to_pe
-- Description: Updates contact_type_enum to replace 'Other' with 'PE'

-- Step 1: Add 'PE' to the enum if it doesn't exist
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

-- Step 2: Update any existing records from 'Other' to 'PE'
-- Since contact_type is an array, we need to replace 'Other' with 'PE' in arrays
UPDATE contacts 
SET contact_type = array_replace(contact_type, 'Other'::contact_type_enum, 'PE'::contact_type_enum)
WHERE 'Other'::contact_type_enum = ANY(contact_type);

-- Step 3: Update the is_investor flag logic to include PE
-- Recreate the function to include PE in the investor check
CREATE OR REPLACE FUNCTION sync_investor_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Set is_investor to true if contact_type contains LP, GP, Angel, FamilyOffice, or PE
  -- All these roles allocate capital and should be treated as investors
  IF NEW.contact_type && ARRAY['LP', 'GP', 'Angel', 'FamilyOffice', 'PE']::contact_type_enum[] THEN
    NEW.is_investor := true;
  ELSE
    NEW.is_investor := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update existing data to sync is_investor flag for PE contacts
UPDATE contacts 
SET is_investor = (contact_type && ARRAY['LP', 'GP', 'Angel', 'FamilyOffice', 'PE']::contact_type_enum[]);

-- Note: PostgreSQL doesn't support removing enum values directly
-- 'Other' will remain in the enum type but is no longer used in the application
-- This is safe and prevents breaking any existing data

-- Record this migration
INSERT INTO migration_versions (version) 
VALUES ('2025_01_20_other_to_pe')
ON CONFLICT (version) DO NOTHING;
