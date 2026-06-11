import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'missing_server_config' }, 500);

  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return jsonResponse({ error: 'auth_required' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  const caller = callerData?.user;
  if (callerError || !caller?.id) return jsonResponse({ error: 'auth_required' }, 401);

  const isSuperAdmin = await callerHasRole(admin, caller.id, 'super_admin');
  if (!isSuperAdmin) return jsonResponse({ error: 'super_admin_required' }, 403);

  const body = await request.json().catch(() => ({}));
  const staffMemberId = String(body.staffMemberId || '').trim();
  const displayName = body.displayName === undefined ? undefined : String(body.displayName || '').trim();
  const department = body.department === undefined ? undefined : String(body.department || '').trim();
  const status = body.status === undefined ? undefined : String(body.status || '').trim();
  const roleIds = Array.isArray(body.roleIds) ? [...new Set(body.roleIds.filter(Boolean))] : null;

  if (!staffMemberId) return jsonResponse({ error: 'missing_staff_member_id' }, 400);
  if (status !== undefined && !['pending_first_login', 'active', 'suspended', 'offboarded'].includes(status)) {
    return jsonResponse({ error: 'invalid_staff_status' }, 400);
  }

  const { data: existing, error: existingError } = await admin
    .from('staff_members')
    .select('*')
    .eq('id', staffMemberId)
    .maybeSingle();
  if (existingError || !existing?.id) return jsonResponse({ error: existingError?.message || 'staff_member_not_found' }, 404);
  if (existing.user_id === caller.id && (status === 'suspended' || status === 'offboarded')) {
    return jsonResponse({ error: 'cannot_disable_own_staff_account' }, 400);
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (displayName !== undefined) payload.display_name = displayName || null;
  if (department !== undefined) payload.department = department || null;
  if (status !== undefined) payload.status = status;

  const { data: staffMember, error: updateError } = await admin
    .from('staff_members')
    .update(payload)
    .eq('id', staffMemberId)
    .select('*')
    .single();
  if (updateError || !staffMember?.id) return jsonResponse({ error: updateError?.message || 'staff_member_update_failed' }, 400);

  if (roleIds) {
    const { error: deleteRolesError } = await admin.from('staff_member_roles').delete().eq('staff_member_id', staffMember.id);
    if (deleteRolesError) return jsonResponse({ error: deleteRolesError.message }, 400);
    if (roleIds.length) {
      const { error: insertRolesError } = await admin.from('staff_member_roles').insert(roleIds.map((roleId) => ({
        staff_member_id: staffMember.id,
        role_id: roleId,
        assigned_by: caller.id,
      })));
      if (insertRolesError) return jsonResponse({ error: insertRolesError.message }, 400);
    }
  }

  if (status) {
    const authUpdate = ['pending_first_login', 'active'].includes(status)
      ? { ban_duration: 'none' }
      : { ban_duration: '876000h' };
    const { error: authError } = await admin.auth.admin.updateUserById(existing.user_id, authUpdate);
    if (authError) return jsonResponse({ error: authError.message }, 400);
  }

  await admin.from('staff_audit_logs').insert({
    staff_member_id: await currentStaffMemberId(admin, caller.id),
    actor_user_id: caller.id,
    action: status === 'suspended' ? 'staff.suspended' : status === 'offboarded' ? 'staff.offboarded' : 'staff.updated',
    target_type: 'staff_member',
    target_id: staffMember.id,
    metadata: { displayName, department, status, roleIds, authBanUpdated: Boolean(status) },
  });

  return jsonResponse({ data: { staffMember }, error: null });
});

async function callerHasRole(admin: ReturnType<typeof createClient>, userId: string, roleKey: string) {
  const { data, error } = await admin
    .from('staff_members')
    .select('id,staff_member_roles(staff_roles(key))')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data?.id) return false;
  return (data.staff_member_roles || []).some((assignment: { staff_roles?: { key?: string } }) => assignment.staff_roles?.key === roleKey);
}

async function currentStaffMemberId(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from('staff_members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return data?.id || null;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
