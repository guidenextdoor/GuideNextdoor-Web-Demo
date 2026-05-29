alter table public.bookings
drop constraint if exists bookings_status_allowed;

alter table public.bookings
add constraint bookings_status_allowed
check (
  status in (
    'Pending',
    'Pending instructor confirmation',
    'Pending learner confirmation',
    'Confirmed',
    'Completed',
    'Cancelled',
    'Canceled'
  )
) not valid;
