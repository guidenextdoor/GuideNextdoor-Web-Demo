-- Staff accounts operate GuideNextdoor through the staff portal only.
-- They should not participate as learners or public social users.

alter table if exists public.post_likes enable row level security;
alter table if exists public.saved_posts enable row level security;
alter table if exists public.post_comments enable row level security;
alter table if exists public.bookings enable row level security;

drop policy if exists "staff_accounts_cannot_insert_post_likes" on public.post_likes;
create policy "staff_accounts_cannot_insert_post_likes"
  on public.post_likes
  as restrictive
  for insert
  to authenticated
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_update_post_likes" on public.post_likes;
create policy "staff_accounts_cannot_update_post_likes"
  on public.post_likes
  as restrictive
  for update
  to authenticated
  using (public.current_staff_member_id() is null)
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_delete_post_likes" on public.post_likes;
create policy "staff_accounts_cannot_delete_post_likes"
  on public.post_likes
  as restrictive
  for delete
  to authenticated
  using (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_insert_saved_posts" on public.saved_posts;
create policy "staff_accounts_cannot_insert_saved_posts"
  on public.saved_posts
  as restrictive
  for insert
  to authenticated
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_update_saved_posts" on public.saved_posts;
create policy "staff_accounts_cannot_update_saved_posts"
  on public.saved_posts
  as restrictive
  for update
  to authenticated
  using (public.current_staff_member_id() is null)
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_delete_saved_posts" on public.saved_posts;
create policy "staff_accounts_cannot_delete_saved_posts"
  on public.saved_posts
  as restrictive
  for delete
  to authenticated
  using (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_insert_post_comments" on public.post_comments;
create policy "staff_accounts_cannot_insert_post_comments"
  on public.post_comments
  as restrictive
  for insert
  to authenticated
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_update_post_comments" on public.post_comments;
create policy "staff_accounts_cannot_update_post_comments"
  on public.post_comments
  as restrictive
  for update
  to authenticated
  using (public.current_staff_member_id() is null)
  with check (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_delete_post_comments" on public.post_comments;
create policy "staff_accounts_cannot_delete_post_comments"
  on public.post_comments
  as restrictive
  for delete
  to authenticated
  using (public.current_staff_member_id() is null);

drop policy if exists "staff_accounts_cannot_insert_bookings" on public.bookings;
create policy "staff_accounts_cannot_insert_bookings"
  on public.bookings
  as restrictive
  for insert
  to authenticated
  with check (public.current_staff_member_id() is null);
