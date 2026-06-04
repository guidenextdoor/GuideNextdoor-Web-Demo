create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users(id) on delete set null,
  reported_user_id uuid references public.users(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'profile', 'service', 'message', 'booking', 'user', 'other')),
  target_id text,
  reason_category text not null,
  description text,
  evidence_url text,
  evidence_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'in_review', 'needs_more_info', 'resolved', 'dismissed', 'escalated', 'sent_to_suspension')),
  severity text not null default 'unassigned' check (severity in ('unassigned', 'low', 'medium', 'high', 'critical')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  assigned_team text,
  assigned_staff_member_id uuid references public.staff_members(id) on delete set null,
  sla_due_at timestamptz,
  staff_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_blocks
  add column if not exists complaint_id uuid references public.complaints(id) on delete set null;

create index if not exists complaints_status_created_at_idx on public.complaints (status, created_at desc);
create index if not exists complaints_reporter_idx on public.complaints (reporter_user_id);
create index if not exists complaints_reported_user_idx on public.complaints (reported_user_id);
create index if not exists complaints_target_idx on public.complaints (target_type, target_id);

alter table public.complaints
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_team text,
  add column if not exists assigned_staff_member_id uuid references public.staff_members(id) on delete set null,
  add column if not exists sla_due_at timestamptz;

alter table public.complaints enable row level security;

create or replace function public.is_active_staff_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members sm
    where sm.user_id = target_user_id
      and sm.status = 'active'
  );
$$;

create or replace function public.touch_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists complaints_touch_updated_at on public.complaints;
create trigger complaints_touch_updated_at
before update on public.complaints
for each row execute function public.touch_complaints_updated_at();

drop policy if exists "users can create own complaints" on public.complaints;
create policy "users can create own complaints"
on public.complaints
for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists "users can read own submitted complaints" on public.complaints;
create policy "users can read own submitted complaints"
on public.complaints
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "staff can read complaints" on public.complaints;
create policy "staff can read complaints"
on public.complaints
for select
to authenticated
using (public.is_active_staff_user(auth.uid()));

drop policy if exists "staff can update complaints" on public.complaints;
create policy "staff can update complaints"
on public.complaints
for update
to authenticated
using (public.is_active_staff_user(auth.uid()))
with check (public.is_active_staff_user(auth.uid()));
