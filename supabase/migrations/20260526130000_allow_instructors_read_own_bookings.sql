alter table public.bookings enable row level security;

drop policy if exists "Learners can read own bookings" on public.bookings;
drop policy if exists "Instructors can read bookings for own services" on public.bookings;

create policy "Learners can read own bookings"
on public.bookings
for select
using (learner_id = auth.uid());

create policy "Instructors can read bookings for own services"
on public.bookings
for select
using (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile
      on profile.id = service.instructor_id
    where service.id = bookings.service_id
      and profile.user_id = auth.uid()
  )
);
