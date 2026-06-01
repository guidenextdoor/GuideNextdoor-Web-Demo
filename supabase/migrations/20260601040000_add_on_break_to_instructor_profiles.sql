-- Add is_on_break column to instructor_profiles
ALTER TABLE instructor_profiles ADD COLUMN IF NOT EXISTS is_on_break BOOLEAN DEFAULT false;

-- Update RLS if necessary (usually instructors can update their own profile)
-- Assuming policies are already in place for instructor_profiles
