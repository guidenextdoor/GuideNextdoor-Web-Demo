-- Create instructor_qualifications table
CREATE TABLE IF NOT EXISTS public.instructor_qualifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id uuid NOT NULL REFERENCES public.instructor_profiles(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL REFERENCES public.ref_activities(id) ON DELETE CASCADE,
    qualification_name text NOT NULL,
    attainment_year integer,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instructor_qualifications ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Public can read instructor qualifications" ON public.instructor_qualifications;
CREATE POLICY "Public can read instructor qualifications"
ON public.instructor_qualifications FOR SELECT
TO public
USING (true);

-- Migrate existing qualification data from instructor_services
INSERT INTO public.instructor_qualifications (instructor_id, activity_id, qualification_name, attainment_year)
SELECT 
    s.instructor_id, 
    s.activity_id, 
    q.qualification_name, 
    s.attainment_year
FROM public.instructor_services s
JOIN public.ref_qualifications q ON s.qualification_id = q.id
WHERE s.qualification_id IS NOT NULL;
