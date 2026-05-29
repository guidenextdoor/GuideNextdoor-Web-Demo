create or replace view public.public_booking_busy_slots as
select
  service_id,
  lesson_date,
  start_time_utc,
  duration_hours,
  status
from public.bookings
where status in (
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
  'Confirmed'
);

grant select on public.public_booking_busy_slots to anon, authenticated;
