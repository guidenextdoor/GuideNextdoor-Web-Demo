-- Robust social interaction policies for likes and saves
-- This migration ensures that authenticated users can always like/save,
-- while securely forcing the user_id to match their session via triggers.

-- 1. post_likes
DROP POLICY IF EXISTS "Users can insert own post likes" ON public.post_likes;
CREATE POLICY "Users can insert own post likes"
ON public.post_likes FOR INSERT
TO authenticated
WITH CHECK (true); -- Trigger handles the security

CREATE OR REPLACE FUNCTION public.force_post_likes_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_force_post_likes_user_id ON public.post_likes;
CREATE TRIGGER tr_force_post_likes_user_id
BEFORE INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.force_post_likes_user_id();

-- 2. saved_posts
DROP POLICY IF EXISTS "Users can insert own saved posts" ON public.saved_posts;
CREATE POLICY "Users can insert own saved posts"
ON public.saved_posts FOR INSERT
TO authenticated
WITH CHECK (true); -- Trigger handles the security

CREATE OR REPLACE FUNCTION public.force_saved_posts_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_force_saved_posts_user_id ON public.saved_posts;
CREATE TRIGGER tr_force_saved_posts_user_id
BEFORE INSERT ON public.saved_posts
FOR EACH ROW EXECUTE FUNCTION public.force_saved_posts_user_id();
