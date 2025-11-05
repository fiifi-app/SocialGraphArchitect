-- Add new fields to contacts table
-- This migration adds: firstName, lastName, phone, location, category, twitter, angellist

ALTER TABLE contacts
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN location TEXT,
  ADD COLUMN category TEXT,
  ADD COLUMN twitter TEXT,
  ADD COLUMN angellist TEXT;

-- Create indexes for commonly searched fields
CREATE INDEX IF NOT EXISTS idx_contacts_first_name ON contacts(first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_location ON contacts(location);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);

-- Update existing contacts to split name into first_name and last_name
-- This is a best-effort split (first word = first_name, rest = last_name)
UPDATE contacts
SET 
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(name, ' '), 1) > 1 
    THEN SUBSTRING(name FROM LENGTH(SPLIT_PART(name, ' ', 1)) + 2)
    ELSE NULL
  END
WHERE first_name IS NULL;

-- Keep the "name" field for backward compatibility
-- It will be computed as first_name + last_name going forward
