-- Add LP and investor profile fields to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'investor',
ADD COLUMN IF NOT EXISTS is_lp BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS check_size_min INTEGER,
ADD COLUMN IF NOT EXISTS check_size_max INTEGER,
ADD COLUMN IF NOT EXISTS preferred_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS preferred_team_sizes TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS preferred_tenure TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS is_family_office BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS investment_types TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS avg_check_size INTEGER;

-- Add promise tracking fields to match_suggestions table
ALTER TABLE match_suggestions
ADD COLUMN IF NOT EXISTS promise_status TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS promised_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN contacts.contact_type IS 'Type of contact: investor or lp';
COMMENT ON COLUMN contacts.is_lp IS 'Whether contact is a Limited Partner';
COMMENT ON COLUMN contacts.check_size_min IS 'Minimum check size in dollars';
COMMENT ON COLUMN contacts.check_size_max IS 'Maximum check size in dollars';
COMMENT ON COLUMN contacts.preferred_stages IS 'Preferred investment stages (seed, series-a, etc)';
COMMENT ON COLUMN contacts.preferred_team_sizes IS 'Preferred team sizes (1-10, 11-50, etc)';
COMMENT ON COLUMN contacts.preferred_tenure IS 'Preferred company tenure (0-2y, 2-5y, etc)';
COMMENT ON COLUMN contacts.is_family_office IS 'Whether LP is a family office';
COMMENT ON COLUMN contacts.investment_types IS 'Types of investments: fund, direct, co-invest';
COMMENT ON COLUMN contacts.avg_check_size IS 'Average check size for LP';
COMMENT ON COLUMN match_suggestions.promise_status IS 'Promise status: general or promised';
COMMENT ON COLUMN match_suggestions.promised_at IS 'Timestamp when intro was promised';
