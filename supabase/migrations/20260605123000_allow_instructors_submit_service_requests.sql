-- Instructors submit service requests; staff approve/reject them later.
-- Existing restrictive suspension policies still block suspended users.

alter table public.instructor_services enable row level security;
alter table public.instructor_pricing enable row level security;
alter table public.service_coverage_areas enable row level security;

grant select, insert, update on public.instructor_services to authenticated;
grant select, insert, update, delete on public.instructor_pricing to authenticated;
grant select, insert, update, delete on public.service_coverage_areas to authenticated;

drop policy if exists "Instructors and service reviewers can read service coverage" on public.service_coverage_areas;
create policy "Instructors and service reviewers can read service coverage"
on public.service_coverage_areas
for select
to authenticated
using (
  public.staff_has_permission('service.approve')
  or public.staff_has_permission('service.reject')
  or public.staff_has_permission('service.create')
  or exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = service_coverage_areas.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can create own service requests" on public.instructor_services;
create policy "Instructors can create own service requests"
on public.instructor_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.instructor_profiles profile
    where profile.id = instructor_services.instructor_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can update own service requests" on public.instructor_services;
create policy "Instructors can update own service requests"
on public.instructor_services
for update
to authenticated
using (
  exists (
    select 1
    from public.instructor_profiles profile
    where profile.id = instructor_services.instructor_id
      and profile.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.instructor_profiles profile
    where profile.id = instructor_services.instructor_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can create pricing for own services" on public.instructor_pricing;
create policy "Instructors can create pricing for own services"
on public.instructor_pricing
for insert
to authenticated
with check (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = instructor_pricing.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can update pricing for own services" on public.instructor_pricing;
create policy "Instructors can update pricing for own services"
on public.instructor_pricing
for update
to authenticated
using (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = instructor_pricing.service_id
      and profile.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = instructor_pricing.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can delete pricing for own services" on public.instructor_pricing;
create policy "Instructors can delete pricing for own services"
on public.instructor_pricing
for delete
to authenticated
using (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = instructor_pricing.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can create coverage for own services" on public.service_coverage_areas;
create policy "Instructors can create coverage for own services"
on public.service_coverage_areas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = service_coverage_areas.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can update coverage for own services" on public.service_coverage_areas;
create policy "Instructors can update coverage for own services"
on public.service_coverage_areas
for update
to authenticated
using (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = service_coverage_areas.service_id
      and profile.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = service_coverage_areas.service_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can delete coverage for own services" on public.service_coverage_areas;
create policy "Instructors can delete coverage for own services"
on public.service_coverage_areas
for delete
to authenticated
using (
  exists (
    select 1
    from public.instructor_services service
    join public.instructor_profiles profile on profile.id = service.instructor_id
    where service.id = service_coverage_areas.service_id
      and profile.user_id = auth.uid()
  )
);
