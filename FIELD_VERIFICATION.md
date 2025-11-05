# Contact Fields Verification

## ✅ All Fields Accounted For

### Core Fields (Already in Database)
- `id` - Primary key
- `owned_by_profile` - User reference
- `name` - Full name (computed from first + last)
- `email` - Email address
- `company` - Company name
- `title` - Job title
- `linkedin_url` - LinkedIn profile

### Personal Fields (Need Migration)
- ✅ `first_name` - First name
- ✅ `last_name` - Last name
- ✅ `phone` - Phone number
- ✅ `location` - Location/City
- ✅ `category` - Contact category
- ✅ `twitter` - Twitter handle/URL
- ✅ `angellist` - AngelList profile

### Company Information Fields (Need Migration)
- ✅ `company_address` - Company address
- ✅ `company_employees` - Number of employees
- ✅ `company_founded` - Founding year
- ✅ `company_url` - Company website
- ✅ `company_linkedin` - Company LinkedIn
- ✅ `company_twitter` - Company Twitter
- ✅ `company_facebook` - Company Facebook
- ✅ `company_angellist` - Company AngelList
- ✅ `company_crunchbase` - Company Crunchbase
- ✅ `company_owler` - Company Owler
- ✅ `youtube_vimeo` - YouTube/Vimeo channel

### LP/Investor Fields (Already in Database from earlier migration)
- `contact_type` - 'investor' or 'lp'
- `is_lp` - Boolean LP flag
- `check_size_min` - Minimum check size
- `check_size_max` - Maximum check size
- `preferred_stages` - Investment stages array
- `preferred_team_sizes` - Team size preferences array
- `preferred_tenure` - Tenure preferences array
- `is_family_office` - Family office flag
- `investment_types` - Investment types array
- `avg_check_size` - Average check size

### System Fields
- `is_shared` - Sharing flag
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

## Summary

**Total Contact Fields: 33**

**Status:**
- ✅ Schema (shared/schema.ts): ALL 33 fields defined
- ✅ Migration (20250103000000_add_contact_fields.sql): ALL 18 new fields included
- ✅ Dialog Form (ContactDialog.tsx): ALL 18 editable fields present
- ❌ Supabase Database: **Migration NOT YET APPLIED**

**Action Required:**
Apply migration `20250103000000_add_contact_fields.sql` to Supabase Cloud database.

## Field Mapping Verification

| UI Label | Form Field | Schema Field | DB Column | Status |
|----------|-----------|--------------|-----------|--------|
| First Name | firstName | firstName | first_name | ✅ |
| Last Name | lastName | lastName | last_name | ✅ |
| Email | email | email | email | ✅ |
| Title | title | title | title | ✅ |
| Company | company | company | company | ✅ |
| LinkedIn | linkedinUrl | linkedinUrl | linkedin_url | ✅ |
| Location | location | location | location | ✅ |
| Phone | phone | phone | phone | ✅ |
| Category | category | category | category | ✅ |
| Twitter | twitter | twitter | twitter | ✅ |
| AngelList | angellist | angellist | angellist | ✅ |
| Company Address | companyAddress | companyAddress | company_address | ✅ |
| # of Employees | companyEmployees | companyEmployees | company_employees | ✅ |
| Founded | companyFounded | companyFounded | company_founded | ✅ |
| Company Website | companyUrl | companyUrl | company_url | ✅ |
| Company LinkedIn | companyLinkedin | companyLinkedin | company_linkedin | ✅ |
| Company Twitter | companyTwitter | companyTwitter | company_twitter | ✅ |
| Company Facebook | companyFacebook | companyFacebook | company_facebook | ✅ |
| Company AngelList | companyAngellist | companyAngellist | company_angellist | ✅ |
| Company Crunchbase | companyCrunchbase | companyCrunchbase | company_crunchbase | ✅ |
| Company Owler | companyOwler | companyOwler | company_owler | ✅ |
| YouTube/Vimeo | youtubeVimeo | youtubeVimeo | youtube_vimeo | ✅ |

## Migration SQL Ready to Apply

```sql
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
```
