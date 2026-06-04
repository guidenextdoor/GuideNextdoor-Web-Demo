alter table public.coach_applications
  add column if not exists public_certificate_url text,
  add column if not exists masked_certificate_url text,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists instructor_profile_id uuid,
  add column if not exists instructor_service_id uuid;

drop policy if exists "application staff can read coach applications" on public.coach_applications;
create policy "application staff can read coach applications"
on public.coach_applications for select
using (public.staff_has_permission('application.view'));

drop policy if exists "application staff can update coach applications" on public.coach_applications;
create policy "application staff can update coach applications"
on public.coach_applications for update
using (
  public.staff_has_permission('application.request_info')
  or public.staff_has_permission('application.approve')
  or public.staff_has_permission('application.reject')
)
with check (
  public.staff_has_permission('application.request_info')
  or public.staff_has_permission('application.approve')
  or public.staff_has_permission('application.reject')
);

create index if not exists coach_applications_review_status_idx
on public.coach_applications (status, submitted_at desc);
