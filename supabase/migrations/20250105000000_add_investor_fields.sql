-- Migration: Add Investor/LP Fields and Role Tags
-- Version: 2025_01_05_investor_fields
-- Description: Adds is_investor, investor_notes, expands contact_type to full enum

-- Step 1: Add new columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_investor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS investor_notes TEXT;

-- Step 2: Create contact_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type_enum') THEN
    CREATE TYPE contact_type_enum AS ENUM ('LP', 'GP', 'Angel', 'FamilyOffice', 'Startup', 'Other');
  END IF;
END $$;

-- Step 3: Add temporary column for new enum type
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type_new contact_type_enum;

-- Step 4: Migrate existing data
UPDATE contacts SET contact_type_new = 
  CASE 
    WHEN contact_type = 'lp' THEN 'LP'::contact_type_enum
    WHEN contact_type = 'investor' THEN 'Other'::contact_type_enum
    ELSE 'Other'::contact_type_enum
  END
WHERE contact_type_new IS NULL;

-- Step 5: Drop old column and rename new one
ALTER TABLE contacts DROP COLUMN IF EXISTS contact_type;
ALTER TABLE contacts RENAME COLUMN contact_type_new TO contact_type;

-- Step 6: Add check constraint for check sizes
ALTER TABLE contacts 
  ADD CONSTRAINT check_size_range 
  CHECK (
    check_size_min IS NULL OR 
    check_size_max IS NULL OR 
    check_size_min <= check_size_max
  );

-- Step 7: Create function to auto-set is_investor when contact_type = LP
CREATE OR REPLACE FUNCTION sync_lp_investor_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- If contact_type is LP, set both is_lp and is_investor to true
  IF NEW.contact_type = 'LP' THEN
    NEW.is_lp := true;
    NEW.is_investor := true;
  END IF;
  
  -- If is_lp is true, ensure is_investor is also true
  IF NEW.is_lp = true THEN
    NEW.is_investor := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger
DROP TRIGGER IF EXISTS sync_lp_investor_flags_trigger ON contacts;
CREATE TRIGGER sync_lp_investor_flags_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_lp_investor_flags();

-- Step 9: Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_is_investor ON contacts(is_investor);
CREATE INDEX IF NOT EXISTS idx_contacts_is_lp ON contacts(is_lp);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_check_size_min ON contacts(check_size_min);
CREATE INDEX IF NOT EXISTS idx_contacts_check_size_max ON contacts(check_size_max);

-- Step 10: Update existing data to sync flags
UPDATE contacts 
SET is_investor = true 
WHERE is_lp = true AND is_investor = false;

-- Step 11: Create migration version tracking table
CREATE TABLE IF NOT EXISTS migration_versions (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

-- Record this migration
INSERT INTO migration_versions (version) 
VALUES ('2025_01_05_investor_fields')
ON CONFLICT (version) DO NOTHING;
