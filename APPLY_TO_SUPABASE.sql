ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS twitter TEXT,
  ADD COLUMN IF NOT EXISTS angellist TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS company_employees TEXT,
  ADD COLUMN IF NOT EXISTS company_founded TEXT,
  ADD COLUMN IF NOT EXISTS company_url TEXT,
  ADD COLUMN IF NOT EXISTS company_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS company_twitter TEXT,
  ADD COLUMN IF NOT EXISTS company_facebook TEXT,
  ADD COLUMN IF NOT EXISTS company_angellist TEXT,
  ADD COLUMN IF NOT EXISTS company_crunchbase TEXT,
  ADD COLUMN IF NOT EXISTS company_owler TEXT,
  ADD COLUMN IF NOT EXISTS youtube_vimeo TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_first_name ON contacts(first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_location ON contacts(location);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);

UPDATE contacts
SET 
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(name, ' '), 1) > 1 
    THEN SUBSTRING(name FROM LENGTH(SPLIT_PART(name, ' ', 1)) + 2)
    ELSE NULL
  END
WHERE first_name IS NULL;
