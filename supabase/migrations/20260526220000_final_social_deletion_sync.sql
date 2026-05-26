-- Final synchronization for social interaction deletions
-- Ensures that unliking/unsaving is as resilient as liking/saving.

-- 1. post_likes
DROP POLICY IF EXISTS "Users can delete own post likes" ON public.post_likes;
CREATE POLICY "Users can delete own post likes"
ON public.post_likes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 2. saved_posts
DROP POLICY IF EXISTS "Users can delete own saved posts" ON public.saved_posts;
CREATE POLICY "Users can delete own saved posts"
ON public.saved_posts FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 3. Ensure all interaction counts are synced one last time
UPDATE public.posts p
SET 
  likes_count = (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id),
  comments_count = (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id AND c.status = 'visible' AND c.deleted_at IS NULL);
