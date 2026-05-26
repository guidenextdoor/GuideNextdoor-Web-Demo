-- Fix sync_post_likes_count to use SECURITY DEFINER
-- This allows any authenticated user to trigger a like-count update on a post they don't own
create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql
security definer -- Add this
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = coalesce(likes_count, 0) + 1
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

-- Fix sync_post_comments_count to use SECURITY DEFINER
create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
security definer -- Add this
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'visible' and new.deleted_at is null then
      update public.posts
      set comments_count = coalesce(comments_count, 0) + 1
      where id = new.post_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'visible' and old.deleted_at is null then
      update public.posts
      set comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
      where id = old.post_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'visible' and old.deleted_at is null
      and (new.status <> 'visible' or new.deleted_at is not null) then
      update public.posts
      set comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
      where id = old.post_id;
    elsif (old.status <> 'visible' or old.deleted_at is not null)
      and new.status = 'visible' and new.deleted_at is null then
      update public.posts
      set comments_count = coalesce(comments_count, 0) + 1
      where id = new.post_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;
