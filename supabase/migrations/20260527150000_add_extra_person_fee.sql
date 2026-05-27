-- Add extra_person_fee to instructor_pricing
ALTER TABLE public.instructor_pricing
ADD COLUMN extra_person_fee integer DEFAULT 0;
