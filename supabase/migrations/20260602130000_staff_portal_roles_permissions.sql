-- Staff portal authorization, audit, and user-blocking foundation.

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  email text not null,
  display_name text,
  department text,
  status text not null default 'active' check (status in ('active', 'suspended', 'offboarded')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_member_roles (
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  assigned_by uuid references public.users(id),
  assigned_at timestamptz not null default now(),
  primary key (staff_member_id, role_id)
);

create table if not exists public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission_id uuid not null references public.staff_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.staff_audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid references public.staff_members(id),
  actor_user_id uuid references public.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'temporary' check (status in ('temporary', 'permanent')),
  reason text,
  blocked_until timestamptz,
  created_by_staff_member_id uuid references public.staff_members(id),
  created_by_user_id uuid references public.users(id),
  lifted_by_staff_member_id uuid references public.staff_members(id),
  lifted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_members_user_id_idx on public.staff_members(user_id);
create index if not exists staff_members_email_idx on public.staff_members(lower(email));
create index if not exists staff_audit_logs_actor_idx on public.staff_audit_logs(actor_user_id, created_at desc);
create index if not exists user_blocks_user_active_idx on public.user_blocks(user_id, lifted_at, blocked_until);

insert into public.staff_roles (key, name, description) values
  ('super_admin', 'Super admin', 'Full GuideNextdoor staff access.'),
  ('it_admin', 'IT admin', 'Manage staff access and audit controls.'),
  ('ops_manager', 'Operations manager', 'Approve applications, create services, and moderate users.'),
  ('cs_agent', 'Customer support agent', 'Handle applicant messages and normal support moderation.'),
  ('reviewer', 'Application reviewer', 'Review applications and request more information.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.staff_permissions (key, description) values
  ('staff.manage', 'Create, suspend, and assign staff roles.'),
  ('audit.view', 'View staff audit logs.'),
  ('application.view', 'View coach applications.'),
  ('application.request_info', 'Request further information from applicants.'),
  ('application.approve', 'Approve coach applications.'),
  ('application.reject', 'Reject coach applications.'),
  ('service.create', 'Create services for approved coaches.'),
  ('user.block', 'Temporarily or permanently block users.'),
  ('user.unblock', 'Lift user blocks.')
on conflict (key) do update set description = excluded.description;

with role_permissions(role_key, permission_key) as (
  values
    ('super_admin', 'staff.manage'),
    ('super_admin', 'audit.view'),
    ('super_admin', 'application.view'),
    ('super_admin', 'application.request_info'),
    ('super_admin', 'application.approve'),
    ('super_admin', 'application.reject'),
    ('super_admin', 'service.create'),
    ('super_admin', 'user.block'),
    ('super_admin', 'user.unblock'),
    ('it_admin', 'staff.manage'),
    ('it_admin', 'audit.view'),
    ('ops_manager', 'audit.view'),
    ('ops_manager', 'application.view'),
    ('ops_manager', 'application.request_info'),
    ('ops_manager', 'application.approve'),
    ('ops_manager', 'application.reject'),
    ('ops_manager', 'service.create'),
    ('ops_manager', 'user.block'),
    ('ops_manager', 'user.unblock'),
    ('cs_agent', 'application.view'),
    ('cs_agent', 'application.request_info'),
    ('cs_agent', 'user.block'),
    ('reviewer', 'application.view'),
    ('reviewer', 'application.request_info')
)
insert into public.staff_role_permissions (role_id, permission_id)
select r.id, p.id
from role_permissions rp
join public.staff_roles r on r.key = rp.role_key
join public.staff_permissions p on p.key = rp.permission_key
on conflict do nothing;

create or replace function public.current_staff_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.staff_members
  where user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.staff_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members sm
    join public.staff_member_roles smr on smr.staff_member_id = sm.id
    join public.staff_role_permissions srp on srp.role_id = smr.role_id
    join public.staff_permissions sp on sp.id = srp.permission_id
    where sm.user_id = auth.uid()
      and sm.status = 'active'
      and sp.key = permission_key
  )
$$;

create or replace function public.is_user_blocked(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where ub.user_id = target_user_id
      and ub.lifted_at is null
      and (
        ub.status = 'permanent'
        or ub.blocked_until is null
        or ub.blocked_until > now()
      )
  )
$$;

alter table public.staff_members enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_member_roles enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_audit_logs enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists "staff can read own staff member" on public.staff_members;
create policy "staff can read own staff member"
  on public.staff_members for select
  using (user_id = auth.uid() or public.staff_has_permission('staff.manage'));

drop policy if exists "staff managers can manage staff members" on public.staff_members;
create policy "staff managers can manage staff members"
  on public.staff_members for all
  using (public.staff_has_permission('staff.manage'))
  with check (public.staff_has_permission('staff.manage'));

drop policy if exists "active staff can read roles" on public.staff_roles;
create policy "active staff can read roles"
  on public.staff_roles for select
  using (public.current_staff_member_id() is not null);

drop policy if exists "active staff can read permissions" on public.staff_permissions;
create policy "active staff can read permissions"
  on public.staff_permissions for select
  using (public.current_staff_member_id() is not null);

drop policy if exists "active staff can read role assignments" on public.staff_member_roles;
create policy "active staff can read role assignments"
  on public.staff_member_roles for select
  using (public.current_staff_member_id() is not null);

drop policy if exists "staff managers can manage role assignments" on public.staff_member_roles;
create policy "staff managers can manage role assignments"
  on public.staff_member_roles for all
  using (public.staff_has_permission('staff.manage'))
  with check (public.staff_has_permission('staff.manage'));

drop policy if exists "active staff can read role permissions" on public.staff_role_permissions;
create policy "active staff can read role permissions"
  on public.staff_role_permissions for select
  using (public.current_staff_member_id() is not null);

drop policy if exists "audit viewers can read audit logs" on public.staff_audit_logs;
create policy "audit viewers can read audit logs"
  on public.staff_audit_logs for select
  using (public.staff_has_permission('audit.view'));

drop policy if exists "active staff can insert audit logs" on public.staff_audit_logs;
create policy "active staff can insert audit logs"
  on public.staff_audit_logs for insert
  with check (public.current_staff_member_id() is not null);

drop policy if exists "user block viewers can read blocks" on public.user_blocks;
create policy "user block viewers can read blocks"
  on public.user_blocks for select
  using (public.staff_has_permission('user.block') or public.staff_has_permission('user.unblock'));

drop policy if exists "user blockers can create blocks" on public.user_blocks;
create policy "user blockers can create blocks"
  on public.user_blocks for insert
  with check (public.staff_has_permission('user.block'));

drop policy if exists "user unblockers can update blocks" on public.user_blocks;
create policy "user unblockers can update blocks"
  on public.user_blocks for update
  using (public.staff_has_permission('user.unblock'))
  with check (public.staff_has_permission('user.unblock'));
