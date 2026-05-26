alter table public.posts enable row level security;

drop policy if exists "Public can read approved posts" on public.posts;

create policy "Public can read approved posts"
on public.posts
for select
to anon, authenticated
using (
  lower(coalesce(approval_status, '')) = 'approved'
);
