-- Track staff portal activity without allowing broad self-updates to staff records.

create or replace function public.touch_current_staff_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.staff_members
  set last_active_at = now(),
      updated_at = now()
  where user_id = auth.uid()
    and status = 'active';
end;
$$;

grant execute on function public.touch_current_staff_last_active() to authenticated;

-- Staff account creation/role assignment is Super admin only.
delete from public.staff_role_permissions srp
using public.staff_roles r, public.staff_permissions p
where srp.role_id = r.id
  and srp.permission_id = p.id
  and r.key = 'it_admin'
  and p.key = 'staff.manage';
