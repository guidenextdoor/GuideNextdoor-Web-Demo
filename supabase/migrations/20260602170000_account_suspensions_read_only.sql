alter table public.user_blocks
  add column if not exists scope text not null default 'full_account_read_only',
  add column if not exists reason_category text,
  add column if not exists internal_note text,
  add column if not exists user_message text,
  add column if not exists support_conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists system_message_id uuid references public.messages(id) on delete set null;

create or replace function public.is_user_blocked(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where ub.user_id = target_user_id
      and ub.lifted_at is null
      and (
        ub.status = 'permanent'
        or ub.blocked_until is null
        or ub.blocked_until > now()
      )
  );
$$;

create or replace function public.is_instructor_user_blocked(target_instructor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instructor_profiles ip
    where ip.id = target_instructor_id
      and public.is_user_blocked(ip.user_id)
  );
$$;

drop policy if exists "users can read own suspension records" on public.user_blocks;
create policy "users can read own suspension records"
on public.user_blocks
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "suspended users cannot write likes" on public.post_likes;
drop policy if exists "suspended users cannot insert likes" on public.post_likes;
drop policy if exists "suspended users cannot delete likes" on public.post_likes;
create policy "suspended users cannot insert likes"
on public.post_likes as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete likes"
on public.post_likes as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write saves" on public.saved_posts;
drop policy if exists "suspended users cannot insert saves" on public.saved_posts;
drop policy if exists "suspended users cannot delete saves" on public.saved_posts;
create policy "suspended users cannot insert saves"
on public.saved_posts as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete saves"
on public.saved_posts as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write comments" on public.post_comments;
drop policy if exists "suspended users cannot insert comments" on public.post_comments;
drop policy if exists "suspended users cannot update comments" on public.post_comments;
drop policy if exists "suspended users cannot delete comments" on public.post_comments;
create policy "suspended users cannot insert comments"
on public.post_comments as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update comments"
on public.post_comments as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete comments"
on public.post_comments as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write bookings" on public.bookings;
drop policy if exists "suspended users cannot insert bookings" on public.bookings;
drop policy if exists "suspended users cannot update bookings" on public.bookings;
create policy "suspended users cannot insert bookings"
on public.bookings as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update bookings"
on public.bookings as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write posts" on public.posts;
drop policy if exists "suspended users cannot insert posts" on public.posts;
drop policy if exists "suspended users cannot update posts" on public.posts;
drop policy if exists "suspended users cannot delete posts" on public.posts;
create policy "suspended users cannot insert posts"
on public.posts as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update posts"
on public.posts as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete posts"
on public.posts as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write availability" on public.instructor_availability;
drop policy if exists "suspended users cannot insert availability" on public.instructor_availability;
drop policy if exists "suspended users cannot update availability" on public.instructor_availability;
drop policy if exists "suspended users cannot delete availability" on public.instructor_availability;
create policy "suspended users cannot insert availability"
on public.instructor_availability as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update availability"
on public.instructor_availability as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete availability"
on public.instructor_availability as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write availability overrides" on public.instructor_availability_overrides;
drop policy if exists "suspended users cannot insert availability overrides" on public.instructor_availability_overrides;
drop policy if exists "suspended users cannot update availability overrides" on public.instructor_availability_overrides;
drop policy if exists "suspended users cannot delete availability overrides" on public.instructor_availability_overrides;
create policy "suspended users cannot insert availability overrides"
on public.instructor_availability_overrides as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update availability overrides"
on public.instructor_availability_overrides as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete availability overrides"
on public.instructor_availability_overrides as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended users cannot write services" on public.instructor_services;
drop policy if exists "suspended users cannot insert services" on public.instructor_services;
drop policy if exists "suspended users cannot update services" on public.instructor_services;
drop policy if exists "suspended users cannot delete services" on public.instructor_services;
create policy "suspended users cannot insert services"
on public.instructor_services as restrictive for insert to authenticated
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot update services"
on public.instructor_services as restrictive for update to authenticated
using (not public.is_user_blocked(auth.uid()))
with check (not public.is_user_blocked(auth.uid()));
create policy "suspended users cannot delete services"
on public.instructor_services as restrictive for delete to authenticated
using (not public.is_user_blocked(auth.uid()));

drop policy if exists "suspended instructor profiles are hidden" on public.instructor_profiles;
create policy "suspended instructor profiles are hidden"
on public.instructor_profiles
as restrictive
for select
to anon, authenticated
using (not public.is_user_blocked(user_id));

drop policy if exists "suspended instructor services are hidden" on public.instructor_services;
create policy "suspended instructor services are hidden"
on public.instructor_services
as restrictive
for select
to anon, authenticated
using (not public.is_instructor_user_blocked(instructor_id));

drop policy if exists "suspended instructor posts are hidden" on public.posts;
create policy "suspended instructor posts are hidden"
on public.posts
as restrictive
for select
to anon, authenticated
using (not public.is_instructor_user_blocked(instructor_id));
