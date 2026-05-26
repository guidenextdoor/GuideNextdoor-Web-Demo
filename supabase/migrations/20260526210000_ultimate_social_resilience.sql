-- Final Resilience Migration for Social States
-- This migration ensures that interaction records are always visible to their owners.

-- 1. Bulletproof SELECT policies for post_likes
DROP POLICY IF EXISTS "Users can read own post likes" ON public.post_likes;
CREATE POLICY "Users can read own post likes"
ON public.post_likes
FOR SELECT
TO authenticated, anon -- Allow anon to attempt read, RLS will filter to zero results correctly
USING (user_id = auth.uid());

-- 2. Bulletproof SELECT policies for saved_posts
DROP POLICY IF EXISTS "Users can read own saved posts" ON public.saved_posts;
CREATE POLICY "Users can read own saved posts"
ON public.saved_posts
FOR SELECT
TO authenticated, anon
USING (user_id = auth.uid());

-- 3. Ensure the foreign keys are perfectly indexed for fast joins
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);

-- 4. Re-verify triggers for user_id enforcement
CREATE OR REPLACE FUNCTION public.force_social_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Always force the user_id to the actual authenticated user
  NEW.user_id = auth.uid();
  
  -- If somehow auth.uid() is null (shouldn't happen for authenticated role), 
  -- and we have a session user_id in the payload, we'll let it pass if it's an insert
  -- but the policy will still catch unauthorized attempts.
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for this action';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_force_post_likes_user_id ON public.post_likes;
CREATE TRIGGER tr_force_post_likes_user_id
BEFORE INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.force_social_user_id();

DROP TRIGGER IF EXISTS tr_force_saved_posts_user_id ON public.saved_posts;
CREATE TRIGGER tr_force_saved_posts_user_id
BEFORE INSERT ON public.saved_posts
FOR EACH ROW EXECUTE FUNCTION public.force_social_user_id();
