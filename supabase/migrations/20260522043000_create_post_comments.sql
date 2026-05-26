create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint post_comments_body_not_blank check (length(btrim(body)) > 0),
  constraint post_comments_status_check check (status in ('visible', 'hidden', 'deleted'))
);

alter table public.post_comments enable row level security;

create index if not exists post_comments_post_id_created_at_idx
on public.post_comments(post_id, created_at);

create index if not exists post_comments_user_id_idx
on public.post_comments(user_id);

create index if not exists post_comments_parent_comment_id_idx
on public.post_comments(parent_comment_id);

alter table public.posts
add column if not exists comments_count integer not null default 0;

drop policy if exists "Public can read visible post comments" on public.post_comments;
drop policy if exists "Users can create own post comments" on public.post_comments;
drop policy if exists "Users can update own visible post comments" on public.post_comments;
drop policy if exists "Users can delete own post comments" on public.post_comments;

create policy "Public can read visible post comments"
on public.post_comments
for select
to anon, authenticated
using (
  status = 'visible'
  and deleted_at is null
  and exists (
    select 1
    from public.posts
    where posts.id = post_comments.post_id
      and lower(coalesce(posts.approval_status, '')) = 'approved'
  )
);

create policy "Users can create own post comments"
on public.post_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'visible'
  and deleted_at is null
  and exists (
    select 1
    from public.posts
    where posts.id = post_comments.post_id
      and lower(coalesce(posts.approval_status, '')) = 'approved'
  )
);

create policy "Users can update own visible post comments"
on public.post_comments
for update
to authenticated
using (user_id = auth.uid() and status = 'visible' and deleted_at is null)
with check (user_id = auth.uid() and status = 'visible' and deleted_at is null);

create policy "Users can delete own post comments"
on public.post_comments
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.touch_post_comments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists post_comments_touch_updated_at on public.post_comments;

create trigger post_comments_touch_updated_at
before update on public.post_comments
for each row execute function public.touch_post_comments_updated_at();

create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
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

drop trigger if exists post_comments_sync_count on public.post_comments;

create trigger post_comments_sync_count
after insert or update or delete on public.post_comments
for each row execute function public.sync_post_comments_count();
