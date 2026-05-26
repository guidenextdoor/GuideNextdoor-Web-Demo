-- Add currency column to bookings and instructor_pricing if they don't exist
alter table public.bookings
add column if not exists currency text default 'USD';

alter table public.instructor_pricing
add column if not exists currency text default 'USD';
