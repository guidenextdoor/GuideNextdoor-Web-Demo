-- Enable RLS for posts (already enabled but for completeness)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 1. Allow instructors to create posts
-- We check if the instructor_id in the post corresponds to an instructor_profile that belongs to the authenticated user
CREATE POLICY "Instructors can create posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.instructor_profiles
    WHERE id = posts.instructor_id
    AND user_id = auth.uid()
  )
);

-- 2. Allow instructors to update their own posts
CREATE POLICY "Instructors can update own posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.instructor_profiles
    WHERE id = posts.instructor_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.instructor_profiles
    WHERE id = posts.instructor_id
    AND user_id = auth.uid()
  )
);

-- 3. Allow instructors to delete their own posts
CREATE POLICY "Instructors can delete own posts"
ON public.posts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.instructor_profiles
    WHERE id = posts.instructor_id
    AND user_id = auth.uid()
  )
);
