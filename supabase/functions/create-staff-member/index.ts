import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'missing_server_config' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'auth_required' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  const caller = callerData?.user;
  if (callerError || !caller?.id) {
    return jsonResponse({ error: 'auth_required' }, 401);
  }

  const isSuperAdmin = await callerHasRole(admin, caller.id, 'super_admin');
  if (!isSuperAdmin) {
    return jsonResponse({ error: 'super_admin_required' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim();
  const temporaryPassword = String(body.temporaryPassword || '').trim();
  const department = String(body.department || '').trim();
  const employmentType = String(body.employmentType || '').trim();
  const roleIds = Array.isArray(body.roleIds) ? [...new Set(body.roleIds.filter(Boolean))] : [];

  if (!email) return jsonResponse({ error: 'missing_email' }, 400);
  if (temporaryPassword.length < 8) return jsonResponse({ error: 'temporary_password_too_short' }, 400);
  if (!roleIds.length) return jsonResponse({ error: 'missing_roles' }, 400);

  const authUser = await findOrCreateAuthUser(admin, email, displayName, temporaryPassword);
  if (authUser.error || !authUser.user?.id) {
    return jsonResponse({ error: authUser.error || 'auth_user_failed' }, 400);
  }

  const userId = authUser.user.id;
  const resolvedDisplayName = displayName
    || String(authUser.user.user_metadata?.nickname || authUser.user.user_metadata?.display_name || email);

  const { error: userUpsertError } = await admin.from('users').upsert({
    id: userId,
    email,
    display_name: resolvedDisplayName,
    nickname: resolvedDisplayName,
  }, { onConflict: 'id' });
  if (userUpsertError) {
    return jsonResponse({ error: userUpsertError.message }, 400);
  }

  const { data: staffMember, error: staffError } = await admin.from('staff_members').upsert({
    user_id: userId,
    email,
    display_name: resolvedDisplayName,
    department: department || null,
    status: 'pending_first_login',
    force_password_change: true,
    password_changed_at: null,
    created_by: caller.id,
  }, { onConflict: 'user_id' }).select('*').single();
  if (staffError || !staffMember?.id) {
    return jsonResponse({ error: staffError?.message || 'staff_member_failed' }, 400);
  }

  const { error: deleteRolesError } = await admin
    .from('staff_member_roles')
    .delete()
    .eq('staff_member_id', staffMember.id);
  if (deleteRolesError) {
    return jsonResponse({ error: deleteRolesError.message }, 400);
  }

  const { error: insertRolesError } = await admin.from('staff_member_roles').insert(roleIds.map((roleId) => ({
    staff_member_id: staffMember.id,
    role_id: roleId,
    assigned_by: caller.id,
  })));
  if (insertRolesError) {
    return jsonResponse({ error: insertRolesError.message }, 400);
  }

  await admin.from('staff_audit_logs').insert({
    staff_member_id: await currentStaffMemberId(admin, caller.id),
    actor_user_id: caller.id,
    action: authUser.created ? 'staff.created' : 'staff.updated',
    target_type: 'staff_member',
    target_id: staffMember.id,
    metadata: {
      email,
      department,
      employmentType,
      roleIds,
      authUserCreated: authUser.created,
      temporaryPasswordSet: true,
      forcePasswordChange: true,
    },
  });

  return jsonResponse({
    data: {
      staffMember,
      authUserId: userId,
      inviteSent: false,
      authUserCreated: authUser.created,
    },
    error: null,
  });
});

async function findOrCreateAuthUser(admin: ReturnType<typeof createClient>, email: string, displayName: string, temporaryPassword: string) {
  const listResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listResult.data?.users?.find((user) => String(user.email || '').toLowerCase() === email);
  if (existing?.id) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: temporaryPassword,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: { display_name: displayName || email, nickname: displayName || email },
    });
    if (updated.error || !updated.data?.user?.id) {
      return { user: null, error: updated.error?.message || 'auth_user_update_failed', created: false };
    }
    return { user: updated.data.user, error: null, created: false };
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    ban_duration: 'none',
    user_metadata: { display_name: displayName || email, nickname: displayName || email },
  });

  if (created.error || !created.data?.user?.id) {
    return { user: null, error: created.error?.message || 'auth_user_failed', created: false };
  }

  return { user: created.data.user, error: null, created: true };
}

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
