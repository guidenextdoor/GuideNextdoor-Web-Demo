-- Add attainment_year to instructor_services if not already present
alter table public.instructor_services
add column if not exists attainment_year integer;

-- Populate with sample data for testing (only where null)
update public.instructor_services
set attainment_year = 2026 - coalesce(years_of_experience, 5)
where attainment_year is null;
