create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table public.post_likes enable row level security;
alter table public.saved_posts enable row level security;

create unique index if not exists post_likes_user_id_post_id_idx
on public.post_likes(user_id, post_id);

create unique index if not exists saved_posts_user_id_post_id_idx
on public.saved_posts(user_id, post_id);

drop policy if exists "Users can read own post likes" on public.post_likes;
drop policy if exists "Users can insert own post likes" on public.post_likes;
drop policy if exists "Users can delete own post likes" on public.post_likes;

create policy "Users can read own post likes"
on public.post_likes
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own post likes"
on public.post_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can delete own post likes"
on public.post_likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own saved posts" on public.saved_posts;
drop policy if exists "Users can insert own saved posts" on public.saved_posts;
drop policy if exists "Users can delete own saved posts" on public.saved_posts;

create policy "Users can read own saved posts"
on public.saved_posts
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own saved posts"
on public.saved_posts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can delete own saved posts"
on public.saved_posts
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql
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

drop trigger if exists post_likes_sync_count on public.post_likes;

create trigger post_likes_sync_count
after insert or delete on public.post_likes
for each row execute function public.sync_post_likes_count();
