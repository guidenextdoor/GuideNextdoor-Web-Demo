-- Add nickname to users and enforce unique username
-- Also ensure proper RLS for profile editing

-- 1. Update users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname text;

-- Clean up duplicate usernames before applying constraint
-- This appends a short UUID suffix to any duplicate username to ensure uniqueness
WITH duplicates AS (
    SELECT username, id, 
           row_number() OVER (PARTITION BY username ORDER BY created_at ASC) as rn
    FROM public.users
    WHERE username IS NOT NULL
)
UPDATE public.users u
SET username = u.username || '_' || substring(u.id::text from 1 for 4)
FROM duplicates d
WHERE u.id = d.id AND d.rn > 1;

-- Ensure username is unique
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

-- 2. RLS for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- 3. RLS for instructor_profiles table
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can update own profile" ON public.instructor_profiles;
CREATE POLICY "Instructors can update own profile" ON public.instructor_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 4. Storage permissions for avatars (if not already handled)
-- We'll assume 'posts' bucket or create an 'avatars' bucket
-- For simplicity, let's allow avatars in the 'posts' bucket under 'avatars/' prefix
-- or just use the existing bucket structure.
