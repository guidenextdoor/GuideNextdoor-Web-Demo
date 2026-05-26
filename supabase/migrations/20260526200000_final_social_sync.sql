-- Final comprehensive fix for social interactions and counts
-- This migration ensures all posts have valid counts and triggers work flawlessly.

-- 1. Ensure columns are NOT NULL and have defaults
ALTER TABLE public.posts 
  ALTER COLUMN likes_count SET DEFAULT 0,
  ALTER COLUMN likes_count SET NOT NULL,
  ALTER COLUMN comments_count SET DEFAULT 0,
  ALTER COLUMN comments_count SET NOT NULL;

-- 2. Clean up any existing NULLs
UPDATE public.posts SET likes_count = 0 WHERE likes_count IS NULL;
UPDATE public.posts SET comments_count = 0 WHERE comments_count IS NULL;

-- 3. Consolidated and bulletproof count sync function
CREATE OR REPLACE FUNCTION public.sync_post_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle Likes
  IF (TG_TABLE_NAME = 'post_likes') THEN
    IF (TG_OP = 'INSERT') THEN
      UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
      UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
  
  -- Handle Comments
  ELSIF (TG_TABLE_NAME = 'post_comments') THEN
    IF (TG_OP = 'INSERT') THEN
      IF (NEW.status = 'visible' AND NEW.deleted_at IS NULL) THEN
        UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
      END IF;
    ELSIF (TG_OP = 'DELETE') THEN
      IF (OLD.status = 'visible' AND OLD.deleted_at IS NULL) THEN
        UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
      END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
      IF (OLD.status = 'visible' AND OLD.deleted_at IS NULL AND (NEW.status <> 'visible' OR NEW.deleted_at IS NOT NULL)) THEN
        UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
      ELSIF ((OLD.status <> 'visible' OR OLD.deleted_at IS NOT NULL) AND NEW.status = 'visible' AND NEW.deleted_at IS NULL) THEN
        UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 4. Re-attach triggers with clean slate
DROP TRIGGER IF EXISTS post_likes_sync_count ON public.post_likes;
CREATE TRIGGER post_likes_sync_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_metrics();

DROP TRIGGER IF EXISTS post_comments_sync_count ON public.post_comments;
CREATE TRIGGER post_comments_sync_count
AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_post_metrics();

-- 5. Recalculate all current counts to ensure consistency
UPDATE public.posts p
SET 
  likes_count = (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id),
  comments_count = (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id AND c.status = 'visible' AND c.deleted_at IS NULL);
