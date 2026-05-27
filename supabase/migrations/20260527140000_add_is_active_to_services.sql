-- Add is_active flag for soft-deletion of instructor services
ALTER TABLE public.instructor_services
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Update the public read access policy to only show active services
DROP POLICY IF EXISTS "Anyone can read instructor services" ON public.instructor_services;
CREATE POLICY "Anyone can read active instructor services" ON public.instructor_services
FOR SELECT USING (is_active = true);

-- Allow instructors to read their own services even if inactive
CREATE POLICY "Instructors can read own inactive services" ON public.instructor_services
FOR SELECT USING (instructor_id IN (
    SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()
));
ALTER TABLE public.instructor_services ADD COLUMN min_duration_hours integer DEFAULT 1;
-- Add attainment_year to instructor_services, replace years_of_experience
ALTER TABLE public.instructor_services
ADD COLUMN attainment_year integer;

-- Update to create instructor_qualifications table if user-added
CREATE TABLE IF NOT EXISTS public.instructor_qualifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id uuid REFERENCES public.instructor_profiles(id),
    activity_id uuid REFERENCES public.ref_activities(id),
    qualification_name text NOT NULL,
    cert_url text,
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.instructor_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instructors can manage own qualifications" ON public.instructor_qualifications
FOR ALL USING (instructor_id IN (
    SELECT id FROM public.instructor_profiles WHERE user_id = auth.uid()
));
CREATE POLICY "Public can read verified qualifications" ON public.instructor_qualifications
FOR SELECT USING (is_verified = true);
-- 1. Drop the incorrect table we created earlier
DROP TABLE IF EXISTS public.instructor_qualifications CASCADE;

-- 2. Add verification flag to the existing ref_qualifications table
ALTER TABLE public.ref_qualifications ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;

-- 3. Allow authenticated users to insert unverified reference qualifications
ALTER TABLE public.ref_qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ref_qualifications" ON public.ref_qualifications;
CREATE POLICY "Anyone can read ref_qualifications" ON public.ref_qualifications
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert custom ref_qualifications" ON public.ref_qualifications;
CREATE POLICY "Users can insert custom ref_qualifications" ON public.ref_qualifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

