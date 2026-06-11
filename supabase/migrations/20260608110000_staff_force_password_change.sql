alter table public.staff_members
  add column if not exists force_password_change boolean not null default false,
  add column if not exists password_changed_at timestamptz;

alter table public.staff_members
  drop constraint if exists staff_members_status_check;

alter table public.staff_members
  add constraint staff_members_status_check
  check (status in ('pending_first_login', 'active', 'suspended', 'offboarded'));

alter table public.staff_members
  alter column status set default 'pending_first_login';

drop policy if exists "staff can update own password flag" on public.staff_members;
create policy "staff can update own password flag"
on public.staff_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
