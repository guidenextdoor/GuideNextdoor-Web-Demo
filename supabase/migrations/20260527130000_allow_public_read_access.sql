-- Allow public read access to essential tables for the Explore and Home views

-- 1. instructor_profiles
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read instructor profiles" ON public.instructor_profiles;
CREATE POLICY "Anyone can read instructor profiles" ON public.instructor_profiles
FOR SELECT USING (true);

-- 2. users (limited columns for public)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read basic user info" ON public.users;
CREATE POLICY "Anyone can read basic user info" ON public.users
FOR SELECT USING (true);

-- 3. locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
CREATE POLICY "Anyone can read locations" ON public.locations
FOR SELECT USING (true);

-- 4. instructor_services
ALTER TABLE public.instructor_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read instructor services" ON public.instructor_services;
CREATE POLICY "Anyone can read instructor services" ON public.instructor_services
FOR SELECT USING (true);

-- 5. ref_activities
ALTER TABLE public.ref_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read activities" ON public.ref_activities;
CREATE POLICY "Anyone can read activities" ON public.ref_activities
FOR SELECT USING (true);

-- 6. instructor_pricing
ALTER TABLE public.instructor_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read pricing" ON public.instructor_pricing;
CREATE POLICY "Anyone can read pricing" ON public.instructor_pricing
FOR SELECT USING (true);

-- 7. instructor_qualifications
ALTER TABLE public.instructor_qualifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read qualifications" ON public.instructor_qualifications;
CREATE POLICY "Anyone can read qualifications" ON public.instructor_qualifications
FOR SELECT USING (true);

-- 8. user_languages
ALTER TABLE public.user_languages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read user languages" ON public.user_languages;
CREATE POLICY "Anyone can read user languages" ON public.user_languages
FOR SELECT USING (true);

-- 9. ref_languages
ALTER TABLE public.ref_languages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read ref languages" ON public.ref_languages;
CREATE POLICY "Anyone can read ref languages" ON public.ref_languages
FOR SELECT USING (true);
