create table if not exists public.instructor_credentials (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(id) on delete cascade,
  activity_id uuid references public.ref_activities(id) on delete set null,
  qualification_id uuid references public.ref_qualifications(id) on delete set null,
  custom_qualification_name text,
  attainment_year integer,
  raw_certificate_url text,
  masked_certificate_url text,
  approval_status text not null default 'Pending'
    check (approval_status in ('Pending', 'Approved', 'Rejected', 'Needs info')),
  staff_note text,
  reviewed_by_staff_member_id uuid references public.staff_members(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instructor_credentials_qualification_check
    check (qualification_id is not null or nullif(trim(custom_qualification_name), '') is not null)
);

create index if not exists instructor_credentials_instructor_idx
  on public.instructor_credentials(instructor_id, approval_status, created_at desc);

create index if not exists instructor_credentials_activity_idx
  on public.instructor_credentials(activity_id, approval_status);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_instructor_credentials_updated_at on public.instructor_credentials;
create trigger update_instructor_credentials_updated_at
  before update on public.instructor_credentials
  for each row execute function public.update_updated_at_column();

alter table public.instructor_credentials enable row level security;

drop policy if exists "public can read approved instructor credentials" on public.instructor_credentials;
create policy "public can read approved instructor credentials"
  on public.instructor_credentials
  for select
  using (approval_status = 'Approved');

drop policy if exists "instructors can read own credentials" on public.instructor_credentials;
create policy "instructors can read own credentials"
  on public.instructor_credentials
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.instructor_profiles ip
      where ip.id = instructor_credentials.instructor_id
        and ip.user_id = auth.uid()
    )
  );

drop policy if exists "instructors can submit own credentials" on public.instructor_credentials;
create policy "instructors can submit own credentials"
  on public.instructor_credentials
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.instructor_profiles ip
      where ip.id = instructor_credentials.instructor_id
        and ip.user_id = auth.uid()
    )
    and approval_status = 'Pending'
  );

drop policy if exists "instructors can update own pending credentials" on public.instructor_credentials;
create policy "instructors can update own pending credentials"
  on public.instructor_credentials
  for update
  to authenticated
  using (
    approval_status in ('Pending', 'Needs info')
    and exists (
      select 1
      from public.instructor_profiles ip
      where ip.id = instructor_credentials.instructor_id
        and ip.user_id = auth.uid()
    )
  )
  with check (
    approval_status = 'Pending'
    and exists (
      select 1
      from public.instructor_profiles ip
      where ip.id = instructor_credentials.instructor_id
        and ip.user_id = auth.uid()
    )
  );

drop policy if exists "service reviewers can read credentials" on public.instructor_credentials;
create policy "service reviewers can read credentials"
  on public.instructor_credentials
  for select
  to authenticated
  using (
    public.staff_has_permission('service.approve')
    or public.staff_has_permission('service.reject')
    or public.staff_has_permission('service.create')
  );

drop policy if exists "service reviewers can update credentials" on public.instructor_credentials;
create policy "service reviewers can update credentials"
  on public.instructor_credentials
  for update
  to authenticated
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
