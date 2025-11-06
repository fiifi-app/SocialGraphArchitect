-- Migration: Multi-Select Contact Types
-- Version: 2025_01_06_multiselect_types
-- Description: Changes contact_type to array, removes is_lp field

-- Step 1: Add new array column for contact types
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_types contact_type_enum[];

-- Step 2: Migrate existing data
-- Convert single contact_type to array, handle is_lp separately
UPDATE contacts 
SET contact_types = 
  CASE 
    -- If is_lp is true AND contact_type is set, include both
    WHEN is_lp = true AND contact_type IS NOT NULL THEN 
      ARRAY['LP'::contact_type_enum, contact_type]::contact_type_enum[]
    -- If is_lp is true but no contact_type, just LP
    WHEN is_lp = true THEN 
      ARRAY['LP'::contact_type_enum]
    -- If contact_type is set but not LP, use it
    WHEN contact_type IS NOT NULL THEN 
      ARRAY[contact_type]
    -- Otherwise empty array
    ELSE 
      ARRAY[]::contact_type_enum[]
  END
WHERE contact_types IS NULL;

-- Step 3: Remove duplicate 'LP' values if they exist
UPDATE contacts 
SET contact_types = (
  SELECT ARRAY(SELECT DISTINCT unnest(contact_types))
)
WHERE 'LP' = ANY(contact_types) AND array_length(contact_types, 1) > 1;

-- Step 4: Drop old columns and triggers
DROP TRIGGER IF EXISTS sync_lp_investor_flags_trigger ON contacts;
DROP FUNCTION IF EXISTS sync_lp_investor_flags();
DROP INDEX IF EXISTS idx_contacts_is_lp;
ALTER TABLE contacts DROP COLUMN IF EXISTS contact_type;
ALTER TABLE contacts DROP COLUMN IF EXISTS is_lp;

-- Step 5: Rename new column
ALTER TABLE contacts RENAME COLUMN contact_types TO contact_type;

-- Step 6: Create new function to auto-set is_investor based on contact_type array
CREATE OR REPLACE FUNCTION sync_investor_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Set is_investor to true if contact_type contains LP, GP, Angel, or FamilyOffice
  -- All these roles allocate capital and should be treated as investors
  IF NEW.contact_type && ARRAY['LP', 'GP', 'Angel', 'FamilyOffice']::contact_type_enum[] THEN
    NEW.is_investor := true;
  ELSE
    NEW.is_investor := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger
CREATE TRIGGER sync_investor_flag_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_investor_flag();

-- Step 8: Update existing data to sync is_investor flag
UPDATE contacts 
SET is_investor = (contact_type && ARRAY['LP', 'GP', 'Angel', 'FamilyOffice']::contact_type_enum[]);

-- Step 9: Update index for contact_type (now array)
DROP INDEX IF EXISTS idx_contacts_contact_type;
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts USING GIN(contact_type);

-- Record this migration
INSERT INTO migration_versions (version) 
VALUES ('2025_01_06_multiselect_types')
ON CONFLICT (version) DO NOTHING;
