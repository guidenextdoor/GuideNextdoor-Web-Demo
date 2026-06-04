-- Service requests are submitted by instructors and reviewed by staff.
-- Staff should approve/reject service rows, not create them from the portal.

insert into public.staff_permissions (key, description) values
  ('service.approve', 'Approve instructor-submitted service requests.'),
  ('service.reject', 'Reject instructor-submitted service requests.')
on conflict (key) do update set description = excluded.description;

with role_permissions(role_key, permission_key) as (
  values
    ('super_admin', 'service.approve'),
    ('super_admin', 'service.reject'),
    ('ops_manager', 'service.approve'),
    ('ops_manager', 'service.reject'),
    ('reviewer', 'service.approve'),
    ('reviewer', 'service.reject')
)
insert into public.staff_role_permissions (role_id, permission_id)
select r.id, p.id
from role_permissions rp
join public.staff_roles r on r.key = rp.role_key
join public.staff_permissions p on p.key = rp.permission_key
on conflict do nothing;

drop policy if exists "service reviewers can read service requests" on public.instructor_services;
create policy "service reviewers can read service requests"
  on public.instructor_services
  for select
  using (
    public.staff_has_permission('service.approve')
    or public.staff_has_permission('service.reject')
    or public.staff_has_permission('service.create')
  );

drop policy if exists "service reviewers can update service requests" on public.instructor_services;
create policy "service reviewers can update service requests"
  on public.instructor_services
  for update
  using (
    public.staff_has_permission('service.approve')
    or public.staff_has_permission('service.reject')
    or public.staff_has_permission('service.create')
  )
  with check (
    public.staff_has_permission('service.approve')
    or public.staff_has_permission('service.reject')
    or public.staff_has_permission('service.create')
  );
