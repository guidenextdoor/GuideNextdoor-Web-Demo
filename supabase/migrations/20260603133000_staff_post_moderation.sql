alter table public.posts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists moderation_status text not null default 'published',
  add column if not exists moderation_reviewed_by_staff_member_id uuid references public.staff_members(id),
  add column if not exists moderation_reviewed_at timestamptz,
  add column if not exists removed_by_staff_member_id uuid references public.staff_members(id),
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text,
  add column if not exists moderation_note text;

create or replace function public.touch_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_posts_updated_at();

create index if not exists posts_staff_moderation_idx
on public.posts (moderation_status, updated_at desc, created_at desc);

drop policy if exists "staff moderators can read all posts" on public.posts;
create policy "staff moderators can read all posts"
on public.posts
for select
using (public.staff_has_permission('user.block') or public.staff_has_permission('audit.view'));

drop policy if exists "staff moderators can update posts" on public.posts;
create policy "staff moderators can update posts"
on public.posts
for update
using (public.staff_has_permission('user.block'))
with check (public.staff_has_permission('user.block'));

drop policy if exists "staff moderators can read post comments" on public.post_comments;
create policy "staff moderators can read post comments"
on public.post_comments
for select
using (public.staff_has_permission('user.block') or public.staff_has_permission('audit.view'));

drop policy if exists "Public can read approved posts" on public.posts;
create policy "Public can read approved posts"
on public.posts
for select
to anon, authenticated
using (
  lower(coalesce(approval_status, '')) = 'approved'
  and lower(coalesce(moderation_status, 'published')) <> 'removed'
  and removed_at is null
);
