-- Add certificate_url to instructor_qualifications
ALTER TABLE public.instructor_qualifications
ADD COLUMN IF NOT EXISTS certificate_url text;

-- Update sample data with a placeholder certificate image
UPDATE public.instructor_qualifications
SET certificate_url = 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&q=80&w=800'
WHERE certificate_url IS NULL;
