alter table public.bookings enable row level security;

drop policy if exists "Booking participants can update requests" on public.bookings;

create policy "Booking participants can update requests"
on public.bookings
for update
to authenticated
using (
  learner_id = auth.uid()
  or exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile
      on profile.id = service.instructor_id
    where service.id = bookings.service_id
      and profile.user_id = auth.uid()
  )
)
with check (
  learner_id = auth.uid()
  or exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile
      on profile.id = service.instructor_id
    where service.id = bookings.service_id
      and profile.user_id = auth.uid()
  )
);
