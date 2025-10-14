-- Add comprehensive provider fields from Claude extraction
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_type TEXT,
  ADD COLUMN IF NOT EXISTS organization TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS fax_number TEXT,
  ADD COLUMN IF NOT EXISTS npi TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS context_in_case TEXT;

-- Update the name column to be nullable since we now have first_name/last_name/full_name
ALTER TABLE providers
  ALTER COLUMN name DROP NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN providers.first_name IS 'Provider first name';
COMMENT ON COLUMN providers.last_name IS 'Provider last name';
COMMENT ON COLUMN providers.full_name IS 'Full name as mentioned in transcript';
COMMENT ON COLUMN providers.provider_type IS 'Type: doctor, nurse, hospital, clinic, healthcare-system';
COMMENT ON COLUMN providers.organization IS 'Hospital or healthcare system name';
COMMENT ON COLUMN providers.city IS 'City location';
COMMENT ON COLUMN providers.state IS 'State location';
COMMENT ON COLUMN providers.address IS 'Full address if available';
COMMENT ON COLUMN providers.phone_number IS 'Phone number';
COMMENT ON COLUMN providers.fax_number IS 'Fax number';
COMMENT ON COLUMN providers.npi IS 'National Provider Identifier';
COMMENT ON COLUMN providers.role IS 'Role in case: primary-care, specialist, surgeon, treating-physician, consulting, emergency';
COMMENT ON COLUMN providers.context_in_case IS 'Description of their involvement in this case';
