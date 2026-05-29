alter table public.bookings enable row level security;

drop policy if exists "Learners can create booking requests" on public.bookings;

create policy "Learners can create booking requests"
on public.bookings
for insert
to authenticated
with check (
  learner_id = auth.uid()
  and service_id is not null
  and exists (
    select 1
    from public.instructor_services service
    where service.id = bookings.service_id
  )
);
