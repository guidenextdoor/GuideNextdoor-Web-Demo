create table if not exists public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  status text not null default 'new',
  source text not null default 'platform_homepage',
  email text not null,
  phone text,
  legal_name text not null,
  public_display_name text not null,
  languages text[] not null default '{}',
  language_ids uuid[] not null default '{}',
  bio text,
  profile_photo_url text,
  activity_type text not null,
  credential_name text,
  attainment_year integer,
  certificate_url text,
  proof_notes text,
  service_title text not null,
  service_location text not null,
  meeting_point text,
  service_description text,
  skill_levels text[] not null default '{}',
  duration text,
  max_group_size integer,
  price_text text,
  currency text not null default 'HKD',
  availability_notes text,
  consent_review boolean not null default false,
  internal_notes text
);

alter table public.coach_applications enable row level security;

drop policy if exists "Anyone can submit coach applications" on public.coach_applications;
create policy "Anyone can submit coach applications"
on public.coach_applications for insert
to anon, authenticated
with check (consent_review = true);

create index if not exists coach_applications_status_created_idx
on public.coach_applications (status, created_at desc);

create index if not exists coach_applications_email_idx
on public.coach_applications (email);

insert into storage.buckets (id, name, public)
values ('coach-applications', 'coach-applications', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload coach application photos" on storage.objects;
create policy "Anyone can upload coach application photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'coach-applications');

drop policy if exists "Anyone can read coach application photos" on storage.objects;
create policy "Anyone can read coach application photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'coach-applications');
