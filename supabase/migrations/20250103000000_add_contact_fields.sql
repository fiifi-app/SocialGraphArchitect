-- Add new fields to contacts table
-- Personal fields: firstName, lastName, phone, location, category, twitter, angellist
-- Company fields: company_address, company_employees, company_founded, company_url, 
--                 company_linkedin, company_twitter, company_facebook, company_angellist,
--                 company_crunchbase, company_owler, youtube_vimeo

ALTER TABLE contacts
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN location TEXT,
  ADD COLUMN category TEXT,
  ADD COLUMN twitter TEXT,
  ADD COLUMN angellist TEXT,
  ADD COLUMN company_address TEXT,
  ADD COLUMN company_employees TEXT,
  ADD COLUMN company_founded TEXT,
  ADD COLUMN company_url TEXT,
  ADD COLUMN company_linkedin TEXT,
  ADD COLUMN company_twitter TEXT,
  ADD COLUMN company_facebook TEXT,
  ADD COLUMN company_angellist TEXT,
  ADD COLUMN company_crunchbase TEXT,
  ADD COLUMN company_owler TEXT,
  ADD COLUMN youtube_vimeo TEXT;

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
