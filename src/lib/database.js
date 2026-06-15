const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tableCandidates = {
  coaches: ['instructor_profiles'],
  services: ['instructor_services'],
  locations: ['locations', 'service_locations', 'destinations'],
  applications: ['coach_applications'],
  posts: ['posts'],
};

const PENDING_BOOKING_STATUSES = new Set([
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
]);
const ACTIVE_BOOKING_STATUSES_FOR_VALIDATION = new Set([
  ...PENDING_BOOKING_STATUSES,
  'Confirmed',
]);

const COMPLETION_PROMPT_MESSAGE_TYPE = 'booking_completion_prompt';
const AUTO_COMPLETED_MESSAGE_TYPE = 'booking_auto_completed';
const PUBLIC_SUPPORT_NAME = 'GuideNextdoor Customer Service';
const PUBLIC_SUPPORT_AVATAR_URL = '/favicon.svg';
const STAFF_USER_IDS = splitEnvList(import.meta.env.VITE_STAFF_USER_IDS || import.meta.env.VITE_GUIDENEXTDOOR_STAFF_USER_ID);
const STAFF_EMAILS = splitEnvList(import.meta.env.VITE_STAFF_EMAILS);
const CENTRAL_STAFF_USER_ID = (import.meta.env.VITE_GUIDENEXTDOOR_STAFF_USER_ID || STAFF_USER_IDS[0] || '').trim();
const STAFF_FALLBACK_PERMISSIONS = [
  'staff.manage',
  'audit.view',
  'application.view',
  'application.request_info',
  'application.approve',
  'application.reject',
  'service.create',
  'service.approve',
  'service.reject',
  'user.block',
  'user.unblock',
];

let instructorScheduleCache = null;

export const databaseStatus = {
  hasConfig: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  projectUrl: SUPABASE_URL || '',
};

export function isCurrentUserStaff() {
  const session = getCurrentSession();
  if (!session?.user?.id) return false;
  const email = String(session.user.email || '').toLowerCase();
  if (STAFF_USER_IDS.includes(session.user.id)) return true;
  if (email && STAFF_EMAILS.includes(email)) return true;
  return Boolean(email && email.endsWith('@guidenextdoor.com'));
}

export function hasStaffPermission(staffContext, permission) {
  if (!staffContext?.isStaff) return false;
  if (staffContext.permissions?.includes(permission)) return true;
  if (['service.approve', 'service.reject'].includes(permission)) {
    return staffContext.permissions?.includes('service.create');
  }
  return false;
}

export function hasStaffRole(staffContext, roleKey) {
  return Boolean(staffContext?.isStaff && staffContext.roles?.some((role) => role.key === roleKey));
}

export function getCurrentSession() {
  if (typeof window === 'undefined') return null;

  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

    try {
      const stored = JSON.parse(window.localStorage.getItem(key));
      const session = Array.isArray(stored) ? stored[0] : stored;
      if (session?.access_token && session?.user?.id) return session;
    } catch {
      // Ignore unrelated localStorage values.
    }
  }

  return null;
}

export function getCachedInstructorSchedule() {
  const session = getCurrentSession();
  if (!session?.user?.id || instructorScheduleCache?.userId !== session.user.id) return null;
  return {
    data: instructorScheduleCache.data,
    error: instructorScheduleCache.error,
    tableName: instructorScheduleCache.tableName,
  };
}

async function getActiveSession() {
  const session = getCurrentSession();
  if (!session) return null;

  const expiresAt = Number(session.expires_at || 0);
  const shouldRefresh = Boolean(session.refresh_token && expiresAt && expiresAt * 1000 < Date.now() + 60_000);
  if (!shouldRefresh) return session;

  const refreshed = await withTimeout(refreshSession(session.refresh_token), 4000, null);
  return refreshed || session;
}

async function refreshSession(refreshToken) {
  if (!databaseStatus.hasConfig || !refreshToken) return null;

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) return null;

  const session = await response.json();
  persistSession(session);
  return session;
}

export async function consumeAuthRedirect() {
  if (typeof window === 'undefined' || !window.location.hash.includes('access_token=')) {
    return { session: getCurrentSession(), error: null };
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresAt = params.get('expires_at');
  const tokenType = params.get('token_type') || 'bearer';

  if (!accessToken) return { session: null, error: 'missing_token' };

  const userResult = await fetchAuthUser(accessToken);
  if (userResult.error) return { session: null, error: userResult.error };

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt ? Number(expiresAt) : null,
    token_type: tokenType,
    user: userResult.user,
  };

  persistSession(session);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

  return { session, error: null };
}

export async function signInWithPassword(email, password) {
  if (!databaseStatus.hasConfig) {
    return { error: 'missing_config' };
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  const session = await response.json();
  persistSession(session);
  return { data: session, error: null };
}

export async function signUpWithPassword(email, password, profile = {}) {
  if (!databaseStatus.hasConfig) {
    return { error: 'missing_config' };
  }

  const nickname = String(profile.nickname || profile.displayName || '').trim();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      data: nickname ? { nickname, display_name: nickname } : undefined,
    }),
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  const data = await response.json();
  if (data.access_token) {
    persistSession(data);
    await ensureUserProfile(data, { nickname, displayName: nickname });
  }
  return { data, error: null };
}

export async function updateCurrentUserPassword(newPassword) {
  if (!databaseStatus.hasConfig) return { data: null, error: 'missing_config' };
  const session = getCurrentSession();
  if (!session?.access_token) return { data: null, error: 'auth_required' };
  if (String(newPassword || '').length < 8) return { data: null, error: 'password_too_short' };

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      ...buildHeaders(session),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (!response.ok) return { data: null, error: await response.text() };
  return { data: await response.json(), error: null };
}

export async function sendPasswordResetEmail(email, redirectTo = '') {
  if (!databaseStatus.hasConfig) return { data: null, error: 'missing_config' };
  const payload = { email };
  if (redirectTo) payload.redirect_to = redirectTo;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return { data: null, error: await response.text() };
  return { data: await response.json().catch(() => ({})), error: null };
}

export async function completeStaffFirstPasswordChange(newPassword) {
  const passwordResult = await updateCurrentUserPassword(newPassword);
  if (passwordResult.error) return { data: null, error: passwordResult.error, tableName: 'auth.users' };

  const session = getCurrentSession();
  const staffResult = await queryTable('staff_members', {
    select: 'id',
    user_id: `eq.${session.user.id}`,
    limit: '1',
  }, session);
  const staffMemberId = staffResult.data?.[0]?.id;
  if (!staffMemberId) return { data: passwordResult.data, error: null, tableName: 'auth.users' };

  const updateResult = await updateTable('staff_members', staffMemberId, {
    status: 'active',
    force_password_change: false,
    password_changed_at: new Date().toISOString(),
  }, session);
  return updateResult.error
    ? { data: passwordResult.data, error: updateResult.error, tableName: 'staff_members' }
    : { data: passwordResult.data, error: null, tableName: 'staff_members' };
}

export function getOAuthLoginUrl(provider, redirectTo) {
  if (!databaseStatus.hasConfig) return '';

  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

export function signOut() {
  if (typeof window === 'undefined') return;

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
    .forEach((key) => window.localStorage.removeItem(key));
}

function persistSession(session) {
  if (typeof window === 'undefined' || !session?.access_token || !session?.user?.id) return;
  window.localStorage.setItem(getAuthStorageKey(), JSON.stringify(session));
}

async function queryTable(tableName, searchParams = {}, session = null) {
  if (!databaseStatus.hasConfig) {
    return { data: [], error: 'missing_config', tableName };
  }

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  let response;
  try {
    console.log(`queryTable: Fetching ${tableName} from ${url.toString()}`);
    response = await fetchWithTimeout(url.toString(), {
      headers: {
        ...buildHeaders(session),
        Accept: 'application/json',
      },
    });
    console.log(`queryTable: ${tableName} status: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`queryTable: ${tableName} fetch failed:`, error);
    return { data: [], error: error.message || String(error), tableName };
  }

  if (!response.ok) {
    const body = await response.text();
    return { data: [], error: body || response.statusText, tableName };
  }

  return { data: await response.json(), error: null, tableName };
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId));
}

function withTimeout(promise, timeoutMs, fallback) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => window.setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function queryFirstAvailable(resourceName, params, session = null) {
  const errors = [];

  for (const tableName of tableCandidates[resourceName]) {
    const result = await queryTable(tableName, params, session);
    if (!result.error) return result;
    errors.push(`${tableName}: ${result.error}`);
  }

  return {
    data: [],
    error: errors.join('\n'),
    tableName: tableCandidates[resourceName][0],
  };
}

export async function fetchCoaches() {
  const result = await queryTable('instructor_profiles', {
    select: '*,users(*)',
    limit: '48',
  });

  console.log('fetchCoaches direct result:', result);
  const normalized = (result.data || []).map((row) => normalizeCoach(row));
  return { ...result, data: normalized };
}

export async function fetchServices() {
  const result = await queryFirstAvailable('services', {
    select: '*,ref_activities(*)',
    limit: '12',
    order: 'years_of_experience.desc',
  });
  return { ...result, data: result.data.map((row) => normalizeService(row)) };
}

export async function fetchSessionSearchData() {
  const [servicesResult, locationsResult, activitiesResult] = await Promise.all([
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*),instructor_profiles!inner(id,user_id,is_on_break,users(id,display_name,nickname,avatar_url,username,email),locations(*))',
      is_active: 'eq.true',
      'instructor_profiles.is_on_break': 'eq.false',
      service_approval_status: 'in.(approved,Approved)',
      order: 'attainment_year.desc',
      limit: '240',
    }),
    fetchServiceLocations(),
    fetchRefActivities(),
  ]);

  if (servicesResult.error) {
    return {
      data: { results: [], locations: locationsResult.data || [], activities: activitiesResult.data || [] },
      error: servicesResult.error,
      tableName: servicesResult.tableName || 'instructor_services',
    };
  }

  const services = await attachServiceLocations((servicesResult.data || []).map((row) => {
    const service = normalizeInstructorService(row);
    const profile = row.instructor_profiles || {};
    const user = profile.users || {};
    return {
      ...service,
      instructorId: profile.id || row.instructor_id || '',
      instructorUserId: profile.user_id || '',
      coachName: displayUserName(user),
      coachUsername: user.username || '',
      avatarUrl: user.avatar_url || '',
      profileLocation: profile.locations ? normalizeLocation(profile.locations) : null,
    };
  }));

  const instructorIds = [...new Set(services.map((service) => service.instructorId).filter(Boolean))];
  const serviceIds = services.map((service) => service.id).filter(Boolean);

  const [availabilityResult, overridesResult, busySlotsResult] = await Promise.all([
    instructorIds.length
      ? queryTable('instructor_availability', {
          select: '*',
          instructor_id: `in.(${instructorIds.join(',')})`,
          is_active: 'eq.true',
          order: 'day_of_week.asc,start_time.asc',
          limit: '1000',
        })
      : { data: [], error: null },
    instructorIds.length
      ? queryTable('instructor_availability_overrides', {
          select: '*',
          instructor_id: `in.(${instructorIds.join(',')})`,
          order: 'override_date.asc,start_time.asc',
          limit: '1000',
        })
      : { data: [], error: null },
    serviceIds.length
      ? queryTable('public_booking_busy_slots', {
          select: '*',
          service_id: `in.(${serviceIds.join(',')})`,
          order: 'lesson_date.asc,start_time_utc.asc',
          limit: '1000',
        })
      : { data: [], error: null },
  ]);

  const availabilityByInstructor = groupBy(
    (availabilityResult.data || []).map((row) => normalizeAvailability({ ...row, id: row.id || `${row.instructor_id}-${row.day_of_week}-${row.start_time}` })),
    (row) => row.instructorId,
  );
  const overridesByInstructor = groupBy(
    (overridesResult.data || []).map((row) => normalizeAvailabilityOverride({ ...row, instructor_id: row.instructor_id })),
    (row) => row.instructorId,
  );
  const bookingsByService = groupBy((busySlotsResult.data || []).map((row) => normalizeSearchBooking(row)), (row) => row.serviceId);

  return {
    data: {
      results: services.map((service) => ({
        ...service,
        availability: availabilityByInstructor.get(service.instructorId) || [],
        availabilityOverrides: overridesByInstructor.get(service.instructorId) || [],
        bookedSlots: bookingsByService.get(service.id) || [],
      })),
      locations: locationsResult.data || [],
      activities: (activitiesResult.data || []).map((activity) => ({
        id: activity.id,
        label: humanizeKey(activity.translation_key || activity.category_key || 'Activity'),
      })),
    },
    error: availabilityResult.error || overridesResult.error || busySlotsResult.error || null,
    tableName: availabilityResult.tableName || overridesResult.tableName || busySlotsResult.tableName || 'instructor_services',
  };
}

export async function fetchLanguages() {
  const result = await queryTable('ref_languages', {
    select: '*',
    is_active: 'eq.true',
    order: 'name.asc',
  });
  return result;
}

export async function fetchCurrentInstructorProfile() {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_profiles' };

  const result = await queryTable('instructor_profiles', {
    select: 'id,user_id',
    user_id: `eq.${session.user.id}`,
    limit: '1',
  }, session);

  return {
    ...result,
    data: result.data?.[0] || null,
  };
}

export async function fetchInstructorSchedule() {
  const session = await getActiveSession();
  const instructorResult = session
    ? await queryTable('instructor_profiles', {
        select: '*,users(*,user_languages(*,ref_languages(*))),locations(*)',
        user_id: `eq.${session.user.id}`,
        limit: '1',
      }, session)
    : { data: [], error: null, tableName: 'instructor_profiles' };

  const fallbackResult = !instructorResult.data?.length
    ? await queryTable('instructor_profiles', {
        select: '*,users(*,user_languages(*,ref_languages(*))),locations(*)',
        limit: '1',
      }, session)
    : instructorResult;

  if (fallbackResult.error || !fallbackResult.data?.length) {
    return {
      data: null,
      error: fallbackResult.error || 'not_found',
      tableName: 'instructor_profiles',
    };
  }

  const coach = normalizeCoach(fallbackResult.data[0]);
  const [servicesResult, availabilityResult, overridesResult, postsResult, reviewsResult, credentialsResult] = await Promise.all([
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*)',
      instructor_id: `eq.${coach.id}`,
      order: 'years_of_experience.desc',
      limit: '48',
    }, session),
    queryTable('instructor_availability', {
      select: '*',
      instructor_id: `eq.${coach.id}`,
      is_active: 'eq.true',
      order: 'day_of_week.asc,start_time.asc',
    }, session),
    queryTable('instructor_availability_overrides', {
      select: '*',
      instructor_id: `eq.${coach.id}`,
      order: 'override_date.asc',
      limit: '120',
    }, session),
    queryTable('posts', {
      select: '*,locations(*),user_liked:post_likes(id),user_saved:saved_posts(id)',
      instructor_id: `eq.${coach.id}`,
      order: 'created_at.desc',
      limit: '48',
    }, session),
    queryTable('reviews', {
      select: '*,users(*),bookings(*)',
      instructor_id: `eq.${coach.id}`,
      order: 'created_at.desc',
      limit: '48',
    }, session),
    queryTable('instructor_credentials', {
      select: '*,ref_activities(*),ref_qualifications(*)',
      instructor_id: `eq.${coach.id}`,
      order: 'created_at.desc',
      limit: '120',
    }, session),
  ]);

  const servicesData = servicesResult.data || [];
  const services = await attachServiceLocations(servicesData.map((row) => normalizeInstructorService(row)));
  let bookingsResult = await fetchInstructorServiceBookings(services, session);
  if (!bookingsResult.error && session && instructorResult.data?.length) {
    const lifecycleResult = await reconcileInstructorBookingLifecycle(bookingsResult.data || [], session);
    if (lifecycleResult.changed) {
      bookingsResult = await fetchInstructorServiceBookings(services, session);
    }
  }
  const posts = (postsResult.data || []).map((row) => normalizePost(row));
  const reviews = (reviewsResult.data || []).map((row) => normalizeReview(row));
  const bookedSlots = bookingsResult.error ? [] : mapBookedSlotsToServices(bookingsResult.data || [], services);

  const result = {
    data: {
      coach: {
        ...coach,
        stats: buildInstructorStats(coach, services, posts, reviews, bookedSlots),
      },
      services,
      credentials: (credentialsResult.data || []).map((row) => normalizeInstructorCredential(row)),
      availability: availabilityResult.error ? [] : availabilityResult.data.map((row) => normalizeAvailability(row)),
      availabilityOverrides: overridesResult.error ? [] : overridesResult.data.map((row) => normalizeAvailabilityOverride(row)),
      bookedSlots,
      posts,
      reviews,
      canEdit: Boolean(session && instructorResult.data?.length),
    },
    error: servicesResult.error || availabilityResult.error || overridesResult.error || postsResult.error || reviewsResult.error || credentialsResult.error || bookingsResult.error || null,
    tableName: servicesResult.tableName || 'instructor_services',
  };

  if (session?.user?.id && instructorResult.data?.length) {
    instructorScheduleCache = {
      userId: session.user.id,
      data: result.data,
      error: result.error,
      tableName: result.tableName,
    };
  }

  return result;
}

export async function createInstructorAvailabilityWindow(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_availability' };
  const accountCheck = await requireInteractiveAccount('instructor_availability');
  if (accountCheck.error) return { data: null, ...accountCheck };

  return insertTable('instructor_availability', {
    instructor_id: payload.instructorId,
    day_of_week: Number(payload.dayOfWeek),
    start_time: payload.startTime,
    end_time: payload.endTime,
    is_active: true,
  }, session);
}

export async function deleteInstructorAvailabilityWindow(id) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required', tableName: 'instructor_availability' };
  const accountCheck = await requireInteractiveAccount('instructor_availability');
  if (accountCheck.error) return accountCheck;

  return deleteTable('instructor_availability', { id: `eq.${id}` }, session);
}

export async function updateInstructorAvailabilityWindow(id, payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_availability' };
  const accountCheck = await requireInteractiveAccount('instructor_availability');
  if (accountCheck.error) return { data: null, ...accountCheck };

  return updateTable('instructor_availability', id, {
    start_time: payload.startTime,
    end_time: payload.endTime,
  }, session);
}

export async function createInstructorAvailabilityOverride(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_availability_overrides' };
  const accountCheck = await requireInteractiveAccount('instructor_availability_overrides');
  if (accountCheck.error) return { data: null, ...accountCheck };

  return insertTable('instructor_availability_overrides', {
    instructor_id: payload.instructorId,
    override_date: payload.date,
    start_time: payload.startTime,
    end_time: payload.endTime,
    is_available: Boolean(payload.isAvailable),
  }, session);
}

export async function updateInstructorAvailabilityOverride(id, payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_availability_overrides' };
  const accountCheck = await requireInteractiveAccount('instructor_availability_overrides');
  if (accountCheck.error) return { data: null, ...accountCheck };

  return updateTable('instructor_availability_overrides', id, {
    start_time: payload.startTime,
    end_time: payload.endTime,
    is_available: Boolean(payload.isAvailable),
  }, session);
}

export async function deleteInstructorAvailabilityOverride(id) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required', tableName: 'instructor_availability_overrides' };
  const accountCheck = await requireInteractiveAccount('instructor_availability_overrides');
  if (accountCheck.error) return accountCheck;

  return deleteTable('instructor_availability_overrides', { id: `eq.${id}` }, session);
}

export async function fetchPosts() {
  const session = getCurrentSession();
  const result = await queryTable('posts', {
    select: '*,locations(*),instructor_profiles(users(*),locations(*)),user_liked:post_likes(id),user_saved:saved_posts(id)',
    approval_status: 'eq.approved',
    limit: '48',
    order: 'created_at.desc',
  }, session);

  return {
    ...result,
    data: (result.data || []).map((row) => normalizePost(row)),
  };
}

export async function togglePostLike(post) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };
  const accountCheck = await requireInteractiveAccount('post_likes');
  if (accountCheck.error) return accountCheck;

  return post.liked
    ? deleteInteraction('post_likes', post.id, session)
    : createInteraction('post_likes', post.id, session);
}

export async function toggleSavedPost(post) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };
  const accountCheck = await requireInteractiveAccount('saved_posts');
  if (accountCheck.error) return accountCheck;

  return post.saved
    ? deleteInteraction('saved_posts', post.id, session)
    : createInteraction('saved_posts', post.id, session);
}

export async function fetchPostComments(postId) {
  const result = await queryTable('post_comments', {
    select: '*,users(display_name,nickname,avatar_url)',
    post_id: `eq.${postId}`,
    status: 'eq.visible',
    order: 'created_at.asc',
    limit: '100',
  });

  return { ...result, data: result.data.map((row) => normalizeComment(row)) };
}

export async function createPostComment(postId, body) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required' };
  const accountCheck = await requireInteractiveAccount('post_comments');
  if (accountCheck.error) return { data: null, ...accountCheck };

  return insertTable('post_comments', {
    post_id: postId,
    user_id: session.user.id,
    body: body.trim(),
    status: 'visible',
  }, session);
}

export async function uploadFile(bucket, file, customPath = null) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required' };

  const fileName = customPath || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.jpg`;
  const path = `${session.user.id}/${fileName}`;

  const url = new URL(`/storage/v1/object/${bucket}/${path}`, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...buildHeaders(session),
      'Content-Type': file.type,
    },
    body: file,
  });

  if (response.ok) {
    return { data: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, error: null };
  }

  return { data: null, error: await response.text() };
}

export async function uploadApplicationPhoto(file, folder = 'profile-photos') {
  if (!databaseStatus.hasConfig) return { data: null, error: 'missing_config' };

  const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}.${extension}`;
  const path = `${folder}/${fileName}`;
  const url = new URL(`/storage/v1/object/coach-applications/${path}`, SUPABASE_URL);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type,
    },
    body: file,
  });

  if (response.ok) {
    return { data: `${SUPABASE_URL}/storage/v1/object/public/coach-applications/${path}`, error: null };
  }

  const error = await response.text();
  if (isRecoverableApplicationUploadError(error)) {
    return { data: await fileToDataUrl(file), error: null, fallback: 'data_url' };
  }

  return { data: null, error };
}

export async function uploadPostMedia(files) {
  const accountCheck = await requireInteractiveAccount('posts');
  if (accountCheck.error) return { data: [], ...accountCheck };
  const results = [];
  const errors = [];

  for (const file of files) {
    const result = await uploadFile('posts', file);
    if (result.data) {
      results.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  return { data: results, error: errors.length ? errors.join(', ') : null };
}

function isRecoverableApplicationUploadError(error) {
  const message = String(error || '').toLowerCase();
  return message.includes('bucket not found')
    || message.includes('row-level security')
    || message.includes('unauthorized');
}

async function fileToDataUrl(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${file.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

export async function createPost(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required' };
  const accountCheck = await requireInteractiveAccount('posts');
  if (accountCheck.error) return { data: null, ...accountCheck };

  // Get instructor profile ID first
  const profileResult = await queryTable('instructor_profiles', {
    user_id: `eq.${session.user.id}`,
    select: 'id',
    limit: '1',
  }, session);

  if (profileResult.error || !profileResult.data?.length) {
    return { data: null, error: 'instructor_profile_not_found' };
  }

  const instructorId = profileResult.data[0].id;

  const postPayload = {
    instructor_id: instructorId,
    service_id: payload.serviceId || null,
    location_id: payload.locationId || null,
    media_url: payload.imageUrls[0], // Primary image
    image_urls: payload.imageUrls,   // All images
    caption: payload.caption || '',
    title: payload.title || payload.caption?.slice(0, 50) || 'New Post',
    hashtags: payload.hashtags || [],
    approval_status: 'approved', // Real-time posting per user request
    aspect_ratio: payload.aspectRatio || 0.8,
  };

  return insertTable('posts', postPayload, session);
}

export async function fetchLocations() {
  const result = await queryFirstAvailable('locations', {
    select: '*',
    limit: '1000',
    order: 'created_at.desc',
  });
  return { ...result, data: result.data.map((row) => normalizeLocation(row)) };
}

export async function fetchServiceLocations() {
  const structuredResult = await queryTable('ref_service_locations', {
    select: '*',
    is_active: 'eq.true',
    limit: '1000',
    order: 'sort_order.asc,display_name.asc',
  });
  if (!structuredResult.error) {
    return {
      ...structuredResult,
      data: structuredResult.data.map((row) => normalizeLocation(row)),
    };
  }
  return fetchLocations();
}

export async function fetchCoachById(id) {
  if (!id) return { data: null, error: 'missing_id', tableName: 'coaches' };

  // Check if ID is likely a UUID or a username
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  for (const tableName of tableCandidates.coaches) {
    const params = {
      select: '*,users(*),locations(*)',
      limit: '1',
    };

    if (isUuid) {
      params.id = `eq.${id}`;
    } else {
      // Filter by username in the joined users table
      // Use !inner to ensure we only get rows that have a matching user
      params.select = '*,users!inner(*),locations(*)';
      params['users.username'] = `eq.${id}`;
    }

    const result = await queryTable(tableName, params);
    if (!result.error && result.data?.length > 0) {
      return { ...result, data: normalizeCoach(result.data[0]) };
    }
  }

  return { data: null, error: 'not_found', tableName: tableCandidates.coaches[0] };
}

/**
 * Checks if a username is already taken by another user.
 */
export async function checkUsernameAvailability(username) {
  const session = getCurrentSession();
  const params = {
    select: 'id',
    username: `eq.${username}`,
    limit: '1',
  };

  const result = await queryTable('users', params);
  
  if (result.error) return { available: false, error: result.error };
  
  // If no user found with this username, it's available
  if (!result.data || result.data.length === 0) return { available: true };
  
  // If user found, check if it's the current user
  const isMe = session?.user?.id && result.data[0].id === session.user.id;
  return { available: isMe };
}

export async function fetchCurrentUserProfile() {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'users' };

  const result = await queryTable('users', {
    select: 'id,email,display_name,nickname,username,avatar_url',
    id: `eq.${session.user.id}`,
    limit: '1',
  }, session);

  if (result.error) return { data: null, error: result.error, tableName: 'users' };
  if (result.data?.[0]) return { ...result, data: normalizeAccountProfile(result.data[0], session) };

  const ensured = await ensureUserProfile(session, {});
  if (ensured.error) return ensured;
  return { data: normalizeAccountProfile(ensured.data, session), error: null, tableName: 'users' };
}

export async function updateCurrentUserProfile(updates) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'users' };
  const accountCheck = await requireInteractiveAccount('users');
  if (accountCheck.error) return { data: null, ...accountCheck };

  const payload = {};
  if (updates.nickname !== undefined) payload.nickname = String(updates.nickname || '').trim();
  if (updates.displayName !== undefined) payload.display_name = String(updates.displayName || '').trim();
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl || null;

  const existing = await queryTable('users', {
    select: 'id',
    id: `eq.${session.user.id}`,
    limit: '1',
  }, session);
  if (existing.error) return { data: null, error: existing.error, tableName: 'users' };

  const result = existing.data?.[0]
    ? await updateTable('users', session.user.id, payload, session)
    : await insertTable('users', {
        id: session.user.id,
        email: session.user.email || '',
        display_name: payload.display_name || payload.nickname || session.user.email || '',
        nickname: payload.nickname || payload.display_name || session.user.email || '',
        avatar_url: payload.avatar_url || null,
      }, session);

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    ...result,
    data: row ? normalizeAccountProfile(row, session) : null,
  };
}

export async function uploadUserAvatar(file) {
  const result = await uploadFile('posts', file, `avatars/${Date.now()}.jpg`);
  if (result.error) return result;
  return updateCurrentUserProfile({ avatarUrl: result.data });
}

/**
 * Updates the instructor's profile (both user and instructor_profile tables).
 */
export async function updateInstructorProfile(updates) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };
  const accountCheck = await requireInteractiveAccount('instructor_profiles');
  if (accountCheck.error) return accountCheck;

  // 1. Update users table if needed
  if (updates.nickname !== undefined || updates.username !== undefined || updates.avatarUrl !== undefined) {
    const userUpdates = {};
    if (updates.nickname !== undefined) userUpdates.nickname = updates.nickname;
    if (updates.username !== undefined) userUpdates.username = updates.username;
    if (updates.avatarUrl !== undefined) userUpdates.avatar_url = updates.avatarUrl;

    const userResult = await updateTable('users', session.user.id, userUpdates, session);
    if (userResult.error) return userResult;
  }

  // 2. Sync user_languages if provided
  if (updates.languageIds !== undefined) {
    // Delete existing languages for this user
    await deleteTable('user_languages', { user_id: `eq.${session.user.id}` }, session);
    
    // Insert new languages
    if (updates.languageIds.length > 0) {
      const languagePayloads = updates.languageIds.map(langId => ({
        user_id: session.user.id,
        language_id: langId,
      }));
      
      // We can't use insertTable for multiple rows easily with the current generic function 
      // if it expects a single object, let's assume it can handle an array or loop.
      // Most Supabase REST endpoints handle arrays for bulk insert.
      const langResult = await insertTable('user_languages', languagePayloads, session, 'return=minimal');
      if (langResult.error) return langResult;
    }
  }

  // 3. Update instructor_profiles table if needed
  if (updates.bio !== undefined) {
    const profileUpdates = {
      bio_description: updates.bio,
    };
    
    // We need the instructor_profile ID, but we usually have the user ID.
    // We can filter by user_id for the update if we use a custom update function or updateTable supports it.
    // Our current updateTable uses id (primary key).
    // Let's find the instructor_profile first or assume we have it.
    const coachResult = await queryTable('instructor_profiles', {
      select: 'id',
      user_id: `eq.${session.user.id}`,
      limit: '1',
    }, session);

    if (coachResult.error || !coachResult.data?.[0]) {
      return { error: 'profile_not_found' };
    }

    const profileResult = await updateTable('instructor_profiles', coachResult.data[0].id, profileUpdates, session);
    if (profileResult.error) return profileResult;
  }

  return { error: null };
}

export async function fetchInstructorProfile(id) {
  const session = getCurrentSession();
  const coachResult = await fetchCoachById(id);
  if (coachResult.error || !coachResult.data) return coachResult;
  const instructorId = coachResult.data.id;

  const [postsResult, servicesResult, reviewsResult, availabilityResult, overridesResult, qualificationsResult, credentialRowsResult, languageResult] = await Promise.all([
    queryTable('posts', {
      select: '*,locations(*),user_liked:post_likes(id),user_saved:saved_posts(id)',
      instructor_id: `eq.${instructorId}`,
      approval_status: 'eq.approved',
      order: 'created_at.desc',
      limit: '24',
    }, session),
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*)',
      instructor_id: `eq.${instructorId}`,
      is_active: 'eq.true',
      order: 'attainment_year.asc',
      limit: '24',
    }, session),
    queryTable('reviews', {
      select: '*,users(*),bookings(*)',
      instructor_id: `eq.${instructorId}`,
      order: 'created_at.desc',
      limit: '20',
    }, session),
    queryTable('instructor_availability', {
      select: '*',
      instructor_id: `eq.${instructorId}`,
      is_active: 'eq.true',
      order: 'day_of_week.asc,start_time.asc',
    }, session),
    queryTable('instructor_availability_overrides', {
      select: '*',
      instructor_id: `eq.${instructorId}`,
      order: 'override_date.asc',
      limit: '20',
    }, session),
    queryTable('instructor_qualifications', {
      select: '*,ref_activities(*)',
      instructor_id: `eq.${instructorId}`,
      order: 'attainment_year.asc',
      limit: '48',
    }, session),
    queryTable('instructor_credentials', {
      select: '*,ref_activities(*),ref_qualifications(*)',
      instructor_id: `eq.${instructorId}`,
      approval_status: 'eq.Approved',
      order: 'attainment_year.desc',
      limit: '120',
    }, session),
    queryTable('user_languages', {
      select: '*,ref_languages(*)',
      user_id: `eq.${coachResult.data.userId}`,
    }, session),
  ]);

  const languages = (languageResult.data || []).map(ul => ({
    id: ul.ref_languages?.id,
    code: ul.ref_languages?.code,
    name: ul.ref_languages?.name,
    nativeName: ul.ref_languages?.native_name,
  })).filter(l => l.id);
  
  const coachWithLangs = { ...coachResult.data, languages };

  const services = servicesResult.data?.map((row) => normalizeInstructorService(row)) || [];
  const servicesWithLocations = await attachServiceLocations(services);
  const bookingsResult = await fetchInstructorServiceBookings(servicesWithLocations);
  const qualificationRows = qualificationsResult.data?.map((row) => normalizeQualification(row)) || [];
  const approvedCredentials = (credentialRowsResult.data || []).map((row) => normalizeInstructorCredential(row));
  const qualifications = mergePublicCredentials([...approvedCredentials, ...qualificationRows], servicesWithLocations);
  
  const posts = postsResult.data?.map((row) => normalizePost({
    ...row,
    instructor_profiles: {
      users: {
        nickname: coachResult.data.nickname,
        username: coachResult.data.username,
        avatar_url: coachResult.data.avatarUrl,
      },
      locations: null,
      cover_photo_url: coachResult.data.avatarUrl,
    },
  })) || [];

  const reviews = reviewsResult.data?.map((row) => normalizeReview(row)) || [];
  const availability = availabilityResult.data?.map((row) => normalizeAvailability(row)) || [];
  const availabilityOverrides = overridesResult.data?.map((row) => normalizeAvailabilityOverride(row)) || [];
  const bookedSlots = bookingsResult.data?.map((row) => normalizeBookedSlot(row)) || [];

  return {
    data: {
      ...coachWithLangs,
      posts,
      services: coachResult.data.isOnBreak ? [] : servicesWithLocations,
      reviews,
      availability: coachResult.data.isOnBreak ? [] : availability,
      availabilityOverrides: coachResult.data.isOnBreak ? [] : availabilityOverrides,
      bookedSlots,
      qualifications,
      stats: buildInstructorStats(coachWithLangs, servicesWithLocations, posts, reviews),
    },
    error: null,
    tableName: coachResult.tableName,
  };
}

function normalizeQualification(row) {
  const activity = row.ref_activities || {};
  return {
    id: row.id,
    activityId: row.activity_id,
    activityKey: activity.translation_key || activity.category_key || '',
    title: activityDisplayName(activity, 'Coaching'),
    iconName: activity.icon_name || '',
    qualification: cleanDisplayText(row.qualification_name || ''),
    attainmentYear: row.attainment_year || null,
    certificateUrl: row.certificate_url || null,
  };
}

function mergePublicCredentials(qualificationRows, services) {
  const credentials = [...qualificationRows];
  const seen = new Set(credentials.map((credential) => publicCredentialKey(credential)));

  services.forEach((service) => {
    const hasPublicCredential = service.qualification || service.maskedCertUrl;
    if (!hasPublicCredential) return;
    const credential = {
      id: `service-${service.id}`,
      activityId: service.activityId,
      activityKey: service.activityKey,
      title: service.title,
      iconName: service.iconName,
      qualification: cleanDisplayText(service.qualification || `${service.title} Certification`),
      attainmentYear: service.attainmentYear || null,
      certificateUrl: service.maskedCertUrl || '',
      source: 'service',
    };
    const key = publicCredentialKey(credential);
    if (seen.has(key)) return;
    seen.add(key);
    credentials.push(credential);
  });

  return credentials;
}

function normalizeInstructorCredential(row) {
  const activity = row.ref_activities || {};
  const qualification = row.ref_qualifications || {};
  return {
    id: row.id,
    instructorId: row.instructor_id || '',
    activityId: row.activity_id || '',
    activityKey: activity.translation_key || activity.category_key || '',
    title: activityDisplayName(activity, 'Coaching'),
    iconName: activity.icon_name || '',
    qualificationId: row.qualification_id || '',
    qualification: cleanDisplayText(qualification.qualification_name || row.custom_qualification_name || ''),
    attainmentYear: row.attainment_year || null,
    certificateUrl: row.masked_certificate_url || '',
    rawCertificateUrl: row.raw_certificate_url || '',
    maskedCertificateUrl: row.masked_certificate_url || '',
    status: row.approval_status || 'Pending',
    staffNote: row.staff_note || '',
    reviewedAt: row.reviewed_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    source: 'credential',
  };
}

function publicCredentialKey(credential) {
  return [
    credential.activityId || credential.activityKey || '',
    cleanDisplayText(credential.qualification || '').toLowerCase(),
    credential.attainmentYear || '',
    credential.certificateUrl || '',
  ].join('|');
}

async function fetchInstructorServiceBookings(services, session = null) {
  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (!serviceIds.length) return { data: [], error: null, tableName: 'bookings' };

  return queryTable('bookings', {
    select: '*,users(id,display_name,nickname,avatar_url,username,email),messages(*)',
    service_id: `in.(${serviceIds.join(',')})`,
    order: 'lesson_date.desc,start_time_utc.desc',
    limit: '240',
  }, session);
}

async function reconcileInstructorBookingLifecycle(bookings, session) {
  const today = toDateInputValue(new Date());
  const twoDaysAgo = addDaysToDateInput(today, -2);
  let changed = false;

  for (const booking of bookings) {
    const lessonDate = booking.lesson_date || '';
    const status = String(booking.status || 'Pending');
    if (!lessonDate || lessonDate >= today) continue;

    if (PENDING_BOOKING_STATUSES.has(status)) {
      const cancelResult = await updateTable('bookings', booking.id, {
        status: 'Cancelled',
        cancelled_at: new Date().toISOString(),
      }, session);
      if (!cancelResult.error) {
        await insertBookingLifecycleMessage({
          booking,
          session,
          type: 'booking_cancelled',
          text: [
            'Booking request cancelled automatically',
            `Service date: ${formatDateForMessage(lessonDate)}`,
            'Reason: Request was not confirmed before the activity date.',
          ].join('\n'),
        });
        changed = true;
      }
      continue;
    }

    if (status !== 'Confirmed') continue;

    const completionPrompt = findLifecycleMessage(booking, COMPLETION_PROMPT_MESSAGE_TYPE);
    if (!completionPrompt) {
      const learnerName = displayUserName(booking.users);
      await insertBookingLifecycleMessage({
        booking,
        session,
        type: COMPLETION_PROMPT_MESSAGE_TYPE,
        text: [
          'Session completion check',
          `Service date: ${formatDateForMessage(lessonDate)}`,
          `Hi ${learnerName}, please confirm whether this session was completed.`,
          'If there is no response within 2 days after the activity date, GuideNextdoor will mark this session as completed automatically.',
        ].join('\n'),
        metadata: {
          learner_name: learnerName,
          action_required: 'completion_confirmation',
        },
      });
    }

    if (lessonDate > twoDaysAgo) {
      changed = !completionPrompt || changed;
      continue;
    }

    const latestPrompt = completionPrompt || { created_at: `${lessonDate}T23:59:59.999Z` };
    const learnerResponded = hasLearnerResponseAfterPrompt(booking, latestPrompt);
    if (learnerResponded || findLifecycleMessage(booking, AUTO_COMPLETED_MESSAGE_TYPE)) {
      changed = !completionPrompt || changed;
      continue;
    }

    const completeResult = await updateTable('bookings', booking.id, { status: 'Completed' }, session);
    if (!completeResult.error) {
      await insertBookingLifecycleMessage({
        booking,
        session,
        type: AUTO_COMPLETED_MESSAGE_TYPE,
        text: [
          'Session marked as completed automatically',
          `Service date: ${formatDateForMessage(lessonDate)}`,
          'Reason: No learner response was received within 2 days after the activity date.',
        ].join('\n'),
      });
      changed = true;
    }
  }

  return { changed };
}

function findLifecycleMessage(booking, messageType) {
  const messages = Array.isArray(booking.messages) ? booking.messages : [];
  const fallbackPrefix = lifecycleMessagePrefix(messageType);
  return messages
    .filter((message) => (
      (
        message.message_type === messageType
        || (fallbackPrefix && String(message.text_content || '').startsWith(fallbackPrefix))
      )
      && (!message.metadata?.booking_id || message.metadata.booking_id === booking.id)
    ))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function lifecycleMessagePrefix(messageType) {
  if (messageType === COMPLETION_PROMPT_MESSAGE_TYPE) return 'Session completion check';
  if (messageType === AUTO_COMPLETED_MESSAGE_TYPE) return 'Session marked as completed automatically';
  return '';
}

function hasLearnerResponseAfterPrompt(booking, promptMessage) {
  if (!booking.learner_id || !promptMessage?.created_at) return false;
  const promptTime = new Date(promptMessage.created_at).getTime();
  if (Number.isNaN(promptTime)) return false;

  return (booking.messages || []).some((message) => (
    message.sender_id === booking.learner_id
    && new Date(message.created_at).getTime() > promptTime
  ));
}

async function insertBookingLifecycleMessage({ booking, session, type, text, metadata = {} }) {
  const basePayload = {
    booking_id: booking.id,
    sender_id: session.user.id,
    text_content: text,
  };
  const richPayload = {
    ...basePayload,
    message_type: type,
    metadata: {
      booking_id: booking.id,
      lesson_date: booking.lesson_date || '',
      lifecycle_event: type,
      system_generated: true,
      ...metadata,
    },
  };
  const attempts = [];
  if (booking.conversation_id) {
    attempts.push({ ...richPayload, conversation_id: booking.conversation_id });
    attempts.push({ ...basePayload, conversation_id: booking.conversation_id });
  }
  attempts.push(richPayload);
  attempts.push(basePayload);

  for (const attempt of attempts) {
    const result = await insertTable('messages', attempt, session, 'return=minimal');
    if (!result.error) {
      if (booking.conversation_id) await updateTable('conversations', booking.conversation_id, { last_message_at: new Date().toISOString() }, session);
      return result;
    }
  }

  return { error: 'message_insert_failed', tableName: 'messages' };
}

export async function submitGuideApplication(payload) {
  if (!databaseStatus.hasConfig) {
    return { data: null, error: 'missing_config', tableName: tableCandidates.applications[0] };
  }

  const errors = [];
  for (const tableName of tableCandidates.applications) {
    const insertPayload = tableName === 'coach_applications' ? normalizeCoachApplicationPayload(payload) : payload;
    const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(insertPayload),
    });

    if (response.ok) {
      const data = await response.json();
      return { data, error: null, tableName };
    }

    errors.push(`${tableName}: ${await response.text()}`);
  }

  return { data: null, error: errors.join('\n'), tableName: tableCandidates.applications[0] };
}

export async function fetchStaffApplications() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'coach_applications' };
  const permission = await requireStaffPermission('application.view', session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const result = await queryTable('coach_applications', {
    select: '*',
    order: 'submitted_at.desc,created_at.desc',
    limit: '240',
  }, session);

  return {
    ...result,
    data: (result.data || []).map((row) => normalizeCoachApplication(row)),
  };
}

export async function fetchStaffApplication(applicationId) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'coach_applications' };
  const permission = await requireStaffPermission('application.view', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const result = await queryTable('coach_applications', {
    select: '*',
    id: `eq.${applicationId}`,
    limit: '1',
  }, session);

  return {
    ...result,
    data: result.data?.[0] ? normalizeCoachApplication(result.data[0]) : null,
  };
}

export async function updateCoachApplicationReview({ applicationId, status, staffNote = '', applicantMessage = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'coach_applications' };
  const requiredPermission = status === 'rejected' ? 'application.reject' : 'application.request_info';
  const permission = await requireStaffPermission(requiredPermission, session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const applicationResult = await fetchStaffApplication(applicationId);
  if (applicationResult.error || !applicationResult.data) return applicationResult;

  const updateResult = await updateApplicationReviewFields(applicationId, {
    status,
    review_notes: staffNote || null,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
  }, session);
  if (updateResult.error) return updateResult;
  await insertStaffAuditLog({
    action: `application.${status}`,
    targetType: 'coach_application',
    targetId: applicationId,
    metadata: { status, staffNote },
    session,
  });

  const messageResult = await sendStaffApplicationMessage({
    application: applicationResult.data,
    status,
    body: applicantMessage || defaultApplicationDecisionMessage(status, applicationResult.data),
    session,
  });

  return {
    data: {
      application: normalizeCoachApplication(updateResult.data || { ...applicationResult.data.raw, status }),
      message: messageResult.data,
    },
    error: messageResult.error,
    tableName: messageResult.error ? messageResult.tableName : 'coach_applications',
  };
}

export async function updateCoachApplicationPublicCertificate({ applicationId, file, publicCertificateUrl = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'coach_applications' };
  const permission = await requireStaffPermission('application.approve', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  let nextUrl = publicCertificateUrl;
  if (file) {
    const uploadResult = await uploadApplicationPhoto(file, 'public-certificates');
    if (uploadResult.error) return { data: null, error: uploadResult.error, tableName: 'coach-applications' };
    nextUrl = uploadResult.data;
  }
  if (!nextUrl) return { data: null, error: 'missing_public_certificate_url', tableName: 'coach_applications' };

  const attempts = [
    { public_certificate_url: nextUrl, masked_certificate_url: nextUrl },
    { public_certificate_url: nextUrl },
    { masked_certificate_url: nextUrl },
  ];
  let lastResult = { data: null, error: 'application_public_certificate_update_failed', tableName: 'coach_applications' };
  for (const attempt of attempts) {
    lastResult = await updateTable('coach_applications', applicationId, attempt, session);
    if (!lastResult.error) {
      await insertStaffAuditLog({
        action: 'application.public_certificate_updated',
        targetType: 'coach_application',
        targetId: applicationId,
        metadata: { publicCertificateUrl: nextUrl },
        session,
      });
      return {
        ...lastResult,
        data: normalizeCoachApplication(lastResult.data),
      };
    }
    if (!String(lastResult.error).includes('column')) break;
  }
  return lastResult;
}

export async function approveCoachApplication({ applicationId, staffNote = '', applicantMessage = '', serviceOverride = {} }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'coach_applications' };
  const permission = await requireStaffPermission('application.approve', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const applicationResult = await fetchStaffApplication(applicationId);
  if (applicationResult.error || !applicationResult.data) return applicationResult;

  const application = applicationResult.data;
  const applicantUserResult = await resolveApplicationUser(application, session);
  if (applicantUserResult.error || !applicantUserResult.data?.id) {
    return { data: null, error: applicantUserResult.error || 'applicant_user_not_found', tableName: 'users' };
  }

  const profileResult = await ensureInstructorProfileForApplication(application, applicantUserResult.data.id, session);
  if (profileResult.error || !profileResult.data?.id) return profileResult;

  const serviceResult = await createStaffServiceForInstructor({
    instructorId: profileResult.data.id,
    application,
    serviceOverride,
    session,
  });
  if (serviceResult.error) return serviceResult;

  const updateResult = await updateApplicationReviewFields(applicationId, {
    status: 'approved',
    review_notes: staffNote || null,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
    instructor_profile_id: profileResult.data.id,
    instructor_service_id: serviceResult.data?.id || null,
  }, session);
  if (updateResult.error) return updateResult;
  await insertStaffAuditLog({
    action: 'application.approved',
    targetType: 'coach_application',
    targetId: applicationId,
    metadata: {
      staffNote,
      instructorProfileId: profileResult.data.id,
      instructorServiceId: serviceResult.data?.id || null,
    },
    session,
  });

  const messageResult = await sendStaffApplicationMessage({
    application: { ...application, applicantUserId: applicantUserResult.data.id },
    status: 'approved',
    body: applicantMessage || defaultApplicationDecisionMessage('approved', application),
    session,
  });

  return {
    data: {
      application: normalizeCoachApplication(updateResult.data || { ...application.raw, status: 'approved' }),
      profile: profileResult.data,
      service: serviceResult.data,
      message: messageResult.data,
    },
    error: messageResult.error,
    tableName: messageResult.error ? messageResult.tableName : 'coach_applications',
  };
}

export async function createStaffInstructorService(payload) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_services' };
  const permission = await requireStaffPermission('service.create', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const application = payload.applicationId ? (await fetchStaffApplication(payload.applicationId)).data : null;
  const result = await createStaffServiceForInstructor({
    instructorId: payload.instructorId,
    application,
    serviceOverride: payload,
    session,
  });
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'service.created',
      targetType: 'instructor_service',
      targetId: result.data?.id || '',
      metadata: { applicationId: payload.applicationId || '', instructorId: payload.instructorId },
      session,
    });
  }
  return result;
}

export async function fetchStaffServiceRequests() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'instructor_services' };
  const permission = await requireStaffAnyPermission(['service.approve', 'service.create'], session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const [serviceResult, credentialResult] = await Promise.all([
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*),instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
      limit: '200',
    }, session),
    queryTable('instructor_credentials', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
      limit: '200',
    }, session),
  ]);

  const services = await attachServiceLocations((serviceResult.data || []).map((row) => normalizeStaffServiceRequest(row)), session);
  const credentials = (credentialResult.data || []).map((row) => normalizeStaffCredentialRequest(row));

  return {
    data: [...services, ...credentials].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))),
    error: serviceResult.error || credentialResult.error || null,
    tableName: serviceResult.error ? serviceResult.tableName : credentialResult.tableName || 'instructor_services',
  };
}

export async function updateStaffServiceRequestReview({ serviceId, status, staffNote = '', instructorMessage = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_services' };
  const normalizedStatus = normalizeServiceReviewStatus(status);
  const permissionKey = normalizedStatus === 'Approved' ? 'service.approve' : 'service.reject';
  const permission = await requireStaffAnyPermission([permissionKey, 'service.create'], session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const serviceResult = await queryTable('instructor_services', {
    select: '*,ref_activities(*),instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
    id: `eq.${serviceId}`,
    limit: '1',
  }, session);
  if (serviceResult.error || !serviceResult.data?.[0]) {
    return { data: null, error: serviceResult.error || 'service_not_found', tableName: 'instructor_services' };
  }
  const service = normalizeStaffServiceRequest(serviceResult.data[0]);

  const result = await updateTable('instructor_services', serviceId, {
    service_approval_status: normalizedStatus,
    is_active: normalizedStatus === 'Approved',
  }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: `service.${normalizedStatus.toLowerCase()}`,
      targetType: 'instructor_service',
      targetId: serviceId,
      metadata: { staffNote },
      session,
    });
  }

  const shouldMessageInstructor = normalizedStatus !== 'Approved' || instructorMessage.trim();
  const messageResult = shouldMessageInstructor
    ? await sendStaffServiceReviewMessage({
        service,
        status: normalizedStatus,
        body: instructorMessage || defaultServiceDecisionMessage(normalizedStatus, service),
        session,
      })
    : { data: null, error: null };

  return {
    ...result,
    error: messageResult.error || result.error,
    tableName: messageResult.error ? messageResult.tableName : result.tableName,
  };
}

export async function updateStaffCredentialRequestReview({ credentialId, status, staffNote = '', instructorMessage = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_credentials' };
  const normalizedStatus = normalizeServiceReviewStatus(status);
  const permissionKey = normalizedStatus === 'Approved' ? 'service.approve' : 'service.reject';
  const permission = await requireStaffAnyPermission([permissionKey, 'service.create'], session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const credentialResult = await queryTable('instructor_credentials', {
    select: '*,ref_activities(*),ref_qualifications(*),instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
    id: `eq.${credentialId}`,
    limit: '1',
  }, session);
  if (credentialResult.error || !credentialResult.data?.[0]) {
    return { data: null, error: credentialResult.error || 'credential_not_found', tableName: 'instructor_credentials' };
  }
  const credential = normalizeStaffCredentialRequest(credentialResult.data[0]);

  const result = await updateTable('instructor_credentials', credentialId, {
    approval_status: normalizedStatus,
    staff_note: staffNote || null,
    reviewed_by_staff_member_id: (await fetchCurrentStaffContext()).data?.member?.id || null,
    reviewed_at: new Date().toISOString(),
  }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: `credential.${normalizedStatus.toLowerCase()}`,
      targetType: 'instructor_credential',
      targetId: credentialId,
      metadata: { staffNote },
      session,
    });
  }

  const shouldMessageInstructor = normalizedStatus !== 'Approved' || instructorMessage.trim();
  const messageResult = shouldMessageInstructor
    ? await sendStaffCredentialReviewMessage({
        credential,
        status: normalizedStatus,
        body: instructorMessage || defaultCredentialDecisionMessage(normalizedStatus, credential),
        session,
      })
    : { data: null, error: null };

  return {
    ...result,
    error: messageResult.error || result.error,
    tableName: messageResult.error ? messageResult.tableName : result.tableName,
  };
}

export async function updateStaffServicePublicCertificate({ serviceId, file, publicCertificateUrl = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_services' };
  const permission = await requireStaffPermission('service.approve', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  let nextUrl = publicCertificateUrl;
  if (file) {
    const uploadResult = await uploadApplicationPhoto(file, 'public-certificates');
    if (uploadResult.error) return { data: null, error: uploadResult.error, tableName: 'coach-applications' };
    nextUrl = uploadResult.data;
  }
  if (!nextUrl) return { data: null, error: 'missing_public_certificate_url', tableName: 'instructor_services' };

  const result = await updateTable('instructor_services', serviceId, { masked_cert_url: nextUrl }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'service.public_certificate_updated',
      targetType: 'instructor_service',
      targetId: serviceId,
      metadata: { publicCertificateUrl: nextUrl },
      session,
    });
  }
  return result;
}

export async function updateStaffCredentialPublicCertificate({ credentialId, file, publicCertificateUrl = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_credentials' };
  const permission = await requireStaffPermission('service.approve', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  let nextUrl = publicCertificateUrl;
  if (file) {
    const uploadResult = await uploadApplicationPhoto(file, 'public-certificates');
    if (uploadResult.error) return { data: null, error: uploadResult.error, tableName: 'instructor_credentials' };
    nextUrl = uploadResult.data;
  }
  if (!nextUrl) return { data: null, error: 'missing_public_certificate_url', tableName: 'instructor_credentials' };

  const result = await updateTable('instructor_credentials', credentialId, { masked_certificate_url: nextUrl }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'credential.public_certificate_updated',
      targetType: 'instructor_credential',
      targetId: credentialId,
      metadata: { publicCertificateUrl: nextUrl },
      session,
    });
  }
  return result;
}

export async function fetchStaffPostModerationQueue() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'posts' };
  const permission = await requireStaffAnyPermission(['user.block', 'audit.view'], session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  let postsResult = await queryTable('posts', {
    select: '*,locations(*),instructor_profiles(id,user_id,cover_photo_url,users(id,email,display_name,nickname,username,avatar_url),locations(*))',
    limit: '200',
    order: 'updated_at.desc,created_at.desc',
  }, session);
  if (postsResult.error && String(postsResult.error).includes('updated_at')) {
    postsResult = await queryTable('posts', {
      select: '*,locations(*),instructor_profiles(id,user_id,cover_photo_url,users(id,email,display_name,nickname,username,avatar_url),locations(*))',
      limit: '200',
      order: 'created_at.desc',
    }, session);
  }
  if (postsResult.error) return { ...postsResult, data: [] };

  const postIds = (postsResult.data || []).map((post) => post.id).filter(Boolean);
  const authorUserIds = (postsResult.data || []).map((post) => post.instructor_profiles?.user_id || post.instructor_profiles?.users?.id).filter(Boolean);
  const [complaintsResult, blocksResult, commentsResult] = await Promise.all([
    postIds.length ? queryTable('complaints', {
      select: '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
      target_type: 'eq.post',
      target_id: `in.(${postIds.join(',')})`,
      order: 'created_at.desc',
      limit: '200',
    }, session) : { data: [], error: null },
    authorUserIds.length ? queryTable('user_blocks', {
      select: '*',
      user_id: `in.(${authorUserIds.join(',')})`,
      limit: '200',
    }, session) : { data: [], error: null },
    postIds.length ? queryTable('post_comments', {
      select: '*,users(id,email,display_name,nickname,username,avatar_url)',
      post_id: `in.(${postIds.join(',')})`,
      order: 'created_at.desc',
      limit: '200',
    }, session) : { data: [], error: null },
  ]);

  const complaintsByPost = groupBy(complaintsResult.data || [], (complaint) => complaint.target_id);
  const blocksByUser = groupBy(blocksResult.data || [], (block) => block.user_id);
  const commentsByPost = groupBy(commentsResult.data || [], (comment) => comment.post_id);
  return {
    data: (postsResult.data || []).map((row) => normalizeStaffModerationPost(row, {
      complaints: complaintsByPost.get(row.id) || [],
      authorBlocks: blocksByUser.get(row.instructor_profiles?.user_id || row.instructor_profiles?.users?.id) || [],
      comments: commentsByPost.get(row.id) || [],
    })),
    error: complaintsResult.error || blocksResult.error || commentsResult.error || null,
    tableName: 'posts',
  };
}

export async function updateStaffPostModeration({ postId, action, reasonCategory = '', staffNote = '', authorMessage = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'posts' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const postResult = await queryTable('posts', {
    select: '*,instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
    id: `eq.${postId}`,
    limit: '1',
  }, session);
  if (postResult.error || !postResult.data?.[0]) return { data: null, error: postResult.error || 'post_not_found', tableName: 'posts' };
  const post = normalizeStaffModerationPost(postResult.data[0]);
  const removing = action === 'remove';
  const approving = action === 'approve';
  const staffMemberId = (await fetchCurrentStaffContext()).data?.member?.id || null;
  const reviewedAt = new Date().toISOString();
  const payload = removing
    ? {
        approval_status: 'removed',
        moderation_status: 'removed',
        moderation_reviewed_by_staff_member_id: staffMemberId,
        moderation_reviewed_at: reviewedAt,
        removed_by_staff_member_id: staffMemberId,
        removed_at: reviewedAt,
        removal_reason: reasonCategory || null,
        moderation_note: staffNote || null,
      }
    : {
        approval_status: 'approved',
        moderation_status: approving ? 'reviewed' : 'approved',
        moderation_reviewed_by_staff_member_id: staffMemberId,
        moderation_reviewed_at: reviewedAt,
        removed_by_staff_member_id: null,
        removed_at: null,
        removal_reason: null,
        moderation_note: staffNote || null,
      };

  const updateResult = await updatePostModerationFields(postId, payload, session);
  if (updateResult.error) return updateResult;

  await insertStaffAuditLog({
    action: removing ? 'post.removed' : approving ? 'post.reviewed' : 'post.restored',
    targetType: 'post',
    targetId: postId,
    metadata: { reasonCategory, staffNote },
    session,
  });

  let message = null;
  if (post.authorUserId && (authorMessage || removing)) {
    const body = authorMessage || defaultPostModerationMessage(removing ? 'remove' : 'restore', post, reasonCategory);
    const messageResult = await sendCentralSupportMessage({
      recipientUserId: post.authorUserId,
      body,
      messageType: removing ? 'post_removed_notice' : 'post_restored_notice',
      metadata: { post_id: postId, moderation_action: action, reason_category: reasonCategory },
      session,
    });
    message = messageResult.data;
    if (messageResult.error) return { data: { post: updateResult.data, message: null }, error: messageResult.error, tableName: messageResult.tableName };
  }

  return { data: { post: normalizeStaffModerationPost(updateResult.data), message }, error: null, tableName: 'posts' };
}

export async function moderateComplaintTarget({ complaintId, action, reasonCategory = '', staffNote = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'complaints' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const result = await queryTable('complaints', {
    select: '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
    id: `eq.${complaintId}`,
    limit: '1',
  }, session);
  if (result.error || !result.data?.[0]) return { data: null, error: result.error || 'complaint_not_found', tableName: 'complaints' };

  const complaint = normalizeComplaint(result.data[0]);
  const target = getComplaintModerationTarget(complaint);
  if (!target.id || !['post', 'comment'].includes(target.type)) {
    return { data: null, error: 'unsupported_complaint_target', tableName: 'complaints' };
  }
  if ((target.type === 'post' && action !== 'remove_post') || (target.type === 'comment' && action !== 'remove_comment')) {
    return { data: null, error: 'complaint_target_action_mismatch', tableName: 'complaints' };
  }

  let actionResult;
  if (target.type === 'post') {
    actionResult = await updateStaffPostModeration({
      postId: target.id,
      action: 'remove',
      reasonCategory,
      staffNote: staffNote || `Removed from complaint ${complaint.id.slice(0, 8)}.`,
    });
  } else {
    actionResult = await removeReportedComment({
      commentId: target.id,
      complaint,
      reasonCategory,
      staffNote,
      session,
    });
  }
  if (actionResult.error) return actionResult;

  await updateComplaintReview({
    complaintId,
    status: 'in_review',
    severity: complaint.severity === 'unassigned' ? 'medium' : complaint.severity,
    priority: complaint.priority || 'normal',
    staffNote: [complaint.staffNote, `${target.type === 'post' ? 'Post' : 'Comment'} removed from complaint review.`].filter(Boolean).join('\n'),
  });

  return { data: { complaint, target, moderation: actionResult.data }, error: null, tableName: target.type === 'post' ? 'posts' : 'post_comments' };
}

async function removeReportedComment({ commentId, complaint, reasonCategory = '', staffNote = '', session }) {
  const commentResult = await queryTable('post_comments', {
    select: '*,users(id,email,display_name,nickname,username,avatar_url)',
    id: `eq.${commentId}`,
    limit: '1',
  }, session);
  if (commentResult.error || !commentResult.data?.[0]) return { data: null, error: commentResult.error || 'comment_not_found', tableName: 'post_comments' };

  const comment = normalizeModerationComment(commentResult.data[0]);
  const staffMemberId = (await fetchCurrentStaffContext()).data?.member?.id || null;
  const reviewedAt = new Date().toISOString();
  let updateResult = await callStaffRemovePostComment({
    commentId,
    reasonCategory,
    staffNote: staffNote || `Removed from complaint ${complaint.id.slice(0, 8)}.`,
    session,
  });
  if (updateResult.error && isMissingRpcError(updateResult.error)) {
    updateResult = await updateCommentModerationFields(commentId, {
      status: 'deleted',
      deleted_at: reviewedAt,
      moderation_reviewed_by_staff_member_id: staffMemberId,
      moderation_reviewed_at: reviewedAt,
      removed_by_staff_member_id: staffMemberId,
      removal_reason: reasonCategory || null,
      moderation_note: staffNote || `Removed from complaint ${complaint.id.slice(0, 8)}.`,
    }, session);
  }
  if (updateResult.error) return updateResult;

  await insertStaffAuditLog({
    action: 'comment.removed',
    targetType: 'post_comment',
    targetId: commentId,
    metadata: { complaintId: complaint.id, reasonCategory, staffNote, postId: comment.postId },
    session,
  });

  let message = null;
  if (comment.userId) {
    const messageResult = await sendCentralSupportMessage({
      recipientUserId: comment.userId,
      body: defaultCommentModerationMessage(comment, reasonCategory),
      messageType: 'comment_removed_notice',
      metadata: { comment_id: commentId, post_id: comment.postId, complaint_id: complaint.id, reason_category: reasonCategory },
      session,
    });
    message = messageResult.data;
    if (messageResult.error) return { data: { comment: updateResult.data, message: null }, error: messageResult.error, tableName: messageResult.tableName };
  }

  return { data: { comment: updateResult.data, message }, error: null, tableName: 'post_comments' };
}

function normalizeServiceReviewStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'Approved';
  if (value === 'rejected') return 'Rejected';
  if (value === 'needs_info' || value === 'needs info' || value === 'needs_information') return 'Needs info';
  return 'Pending';
}

export async function fetchCurrentStaffContext() {
  const session = await getActiveSession();
  if (!session) return { data: buildEmptyStaffContext(), error: 'auth_required', tableName: 'staff_members' };

  const fallback = buildFallbackStaffContext(session);
  const memberResult = await queryTable('staff_members', {
    select: '*',
    user_id: `eq.${session.user.id}`,
    status: 'in.(pending_first_login,active)',
    limit: '1',
  }, session);

  if (memberResult.error) {
    return fallback.isStaff
      ? { data: fallback, error: null, tableName: 'staff_members' }
      : { data: buildEmptyStaffContext(), error: memberResult.error, tableName: 'staff_members' };
  }

  const member = memberResult.data?.[0] || null;
  if (!member) {
    return { data: fallback, error: null, tableName: 'staff_members' };
  }
  await touchCurrentStaffLastActive(session);

  const roleAssignments = await queryTable('staff_member_roles', {
    select: 'role_id,staff_roles(id,key,name)',
    staff_member_id: `eq.${member.id}`,
    limit: '100',
  }, session);
  if (roleAssignments.error) {
    return { data: { ...fallback, isStaff: true, member: normalizeStaffMember(member) }, error: null, tableName: 'staff_member_roles' };
  }

  const roles = (roleAssignments.data || []).map((row) => ({
    id: row.role_id || row.staff_roles?.id || '',
    key: row.staff_roles?.key || '',
    name: row.staff_roles?.name || '',
  })).filter((role) => role.id);
  const roleIds = roles.map((role) => role.id);

  const permissionRows = roleIds.length
    ? await queryTable('staff_role_permissions', {
        select: 'role_id,staff_permissions(key,description)',
        role_id: `in.(${roleIds.join(',')})`,
        limit: '300',
      }, session)
    : { data: [], error: null };
  const permissions = [...new Set((permissionRows.data || []).map((row) => row.staff_permissions?.key).filter(Boolean))];

  return {
    data: {
      isStaff: true,
      source: 'database',
      member: normalizeStaffMember(member),
      roles,
      permissions,
    },
    error: null,
    tableName: 'staff_members',
  };
}

export async function fetchStaffAuditLogs() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'staff_audit_logs' };
  const permission = await requireStaffPermission('audit.view', session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const result = await queryTable('staff_audit_logs', {
    select: '*',
    order: 'created_at.desc',
    limit: '100',
  }, session);
  return { ...result, data: await enrichStaffAuditLogs(result.data || [], session) };
}

async function enrichStaffAuditLogs(rows, session) {
  if (!rows.length) return [];
  const actorUserIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))];
  const staffMemberIds = [...new Set(rows.flatMap((row) => [
    row.staff_member_id,
    row.target_type === 'staff_member' ? row.target_id : '',
  ]).filter(Boolean))];
  const targetUserIds = [...new Set(rows.filter((row) => row.target_type === 'user').map((row) => row.target_id).filter(Boolean))];

  const [actorUsersResult, staffMembersResult, targetUsersResult] = await Promise.all([
    actorUserIds.length ? queryTable('users', {
      select: 'id,email,display_name,nickname,username,avatar_url',
      id: `in.(${actorUserIds.join(',')})`,
      limit: '200',
    }, session) : { data: [], error: null },
    staffMemberIds.length ? queryTable('staff_members', {
      select: 'id,user_id,email,display_name,department,status',
      id: `in.(${staffMemberIds.join(',')})`,
      limit: '200',
    }, session) : { data: [], error: null },
    targetUserIds.length ? queryTable('users', {
      select: 'id,email,display_name,nickname,username,avatar_url',
      id: `in.(${targetUserIds.join(',')})`,
      limit: '200',
    }, session) : { data: [], error: null },
  ]);

  const actorUsersById = new Map((actorUsersResult.data || []).map((user) => [user.id, user]));
  const staffMembersById = new Map((staffMembersResult.data || []).map((member) => [member.id, member]));
  const targetUsersById = new Map((targetUsersResult.data || []).map((user) => [user.id, user]));
  return rows.map((row) => normalizeStaffAuditLog(row, {
    actorUser: actorUsersById.get(row.actor_user_id),
    staffMember: staffMembersById.get(row.staff_member_id),
    targetStaffMember: row.target_type === 'staff_member' ? staffMembersById.get(row.target_id) : null,
    targetUser: row.target_type === 'user' ? targetUsersById.get(row.target_id) : null,
  }));
}

export async function fetchStaffDirectory() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'staff_members' };
  const permission = await requireSuperAdminStaff();
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const [membersResult, assignmentsResult] = await Promise.all([
    queryTable('staff_members', {
      select: '*',
      order: 'created_at.desc',
      limit: '300',
    }, session),
    queryTable('staff_member_roles', {
      select: 'staff_member_id,staff_roles(id,key,name,description)',
      limit: '1000',
    }, session),
  ]);

  const rolesByMember = groupBy(assignmentsResult.data || [], (row) => row.staff_member_id);
  return {
    data: (membersResult.data || []).map((member) => normalizeStaffDirectoryMember(member, rolesByMember.get(member.id) || [])),
    error: membersResult.error || assignmentsResult.error || null,
    tableName: membersResult.tableName || assignmentsResult.tableName || 'staff_members',
  };
}

export async function fetchStaffRoleCatalog() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'staff_roles' };
  const permission = await requireSuperAdminStaff();
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const [rolesResult, permissionResult] = await Promise.all([
    queryTable('staff_roles', {
      select: '*',
      order: 'name.asc',
      limit: '100',
    }, session),
    queryTable('staff_role_permissions', {
      select: 'role_id,staff_permissions(key,description)',
      limit: '500',
    }, session),
  ]);

  const permissionsByRole = groupBy(permissionResult.data || [], (row) => row.role_id);
  return {
    data: (rolesResult.data || []).map((role) => normalizeStaffRole(role, permissionsByRole.get(role.id) || [])),
    error: rolesResult.error || permissionResult.error || null,
    tableName: rolesResult.tableName || permissionResult.tableName || 'staff_roles',
  };
}

export async function createStaffMemberAccount({ email, displayName = '', department = '', employmentType = '', temporaryPassword = '', roleIds = [] }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'staff_members' };
  const permission = await requireSuperAdminStaff();
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  return createStaffMemberOnServer({ email, displayName, department, employmentType, temporaryPassword, roleIds }, session);
}

export async function updateStaffMemberAccount({ staffMemberId, displayName, department, status, roleIds = null }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'staff_members' };
  const permission = await requireSuperAdminStaff();
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  return updateStaffMemberOnServer({ staffMemberId, displayName, department, status, roleIds }, session);
}

export async function fetchUserBlocks() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'user_blocks' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const result = await queryTable('user_blocks', {
    select: '*,users!user_blocks_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
    order: 'created_at.desc',
    limit: '100',
  }, session);
  return { ...result, data: (result.data || []).map(normalizeUserBlock) };
}

export async function createComplaintReport({
  targetType,
  targetId = '',
  reportedUserId = '',
  reasonCategory,
  description = '',
  evidenceUrl = '',
  evidenceMetadata = {},
}) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'complaints' };
  const accountCheck = await requireInteractiveAccount('complaints');
  if (accountCheck.error) return { data: null, ...accountCheck };
  const normalizedTargetType = normalizeComplaintTargetType(targetType);
  const normalizedReportedUserId = isUuid(reportedUserId) ? reportedUserId : null;

  return insertTable('complaints', {
    reporter_user_id: session.user.id,
    reported_user_id: normalizedReportedUserId,
    target_type: normalizedTargetType,
    target_id: targetId ? String(targetId) : null,
    reason_category: reasonCategory,
    description: description || null,
    evidence_url: evidenceUrl || null,
    evidence_metadata: {
      ...(evidenceMetadata || {}),
      raw_target_type: targetType || '',
      raw_reported_user_id: reportedUserId || '',
    },
    status: 'new',
    severity: 'unassigned',
  }, session);
}

export async function fetchStaffComplaints() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'complaints' };
  const permission = await requireStaffAnyPermission(['user.block', 'audit.view'], session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const selectWithAssignee = '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url),assignedStaff:staff_members!complaints_assigned_staff_member_id_fkey(id,email,display_name,department)';
  const baseSelect = '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url)';
  let result = await queryTable('complaints', {
    select: selectWithAssignee,
    order: 'created_at.desc',
    limit: '200',
  }, session);
  if (result.error) {
    result = await queryTable('complaints', {
      select: baseSelect,
      order: 'created_at.desc',
      limit: '200',
    }, session);
  }

  return { ...result, data: (result.data || []).map(normalizeComplaint) };
}

export async function claimComplaint({ complaintId }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'complaints' };
  const permission = await requireStaffAnyPermission(['user.block', 'audit.view'], session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const staffMemberId = permission.data?.member?.id || null;
  const payload = {
    assigned_staff_member_id: staffMemberId,
    assigned_team: 'Customer Support',
    status: 'in_review',
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
  };

  const result = await updateTable('complaints', complaintId, payload, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'complaint.claimed',
      targetType: 'complaint',
      targetId: complaintId,
      metadata: { assignedStaffMemberId: staffMemberId, assignedTeam: 'Customer Support' },
      session,
    });
  }
  return result;
}

export async function updateComplaintReview({ complaintId, status, severity = '', staffNote = '', priority = '', assignedTeam = undefined, slaDueAt = undefined }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'complaints' };
  const permission = await requireStaffAnyPermission(['user.block', 'audit.view'], session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const payload = {
    status,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
  };
  if (severity) payload.severity = severity;
  if (priority) payload.priority = priority;
  if (assignedTeam !== undefined) payload.assigned_team = assignedTeam || null;
  if (slaDueAt !== undefined) payload.sla_due_at = slaDueAt || null;
  if (staffNote !== undefined) payload.staff_note = staffNote || null;

  const result = await updateTable('complaints', complaintId, payload, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: `complaint.${status}`,
      targetType: 'complaint',
      targetId: complaintId,
      metadata: { severity, staffNote, priority, assignedTeam, slaDueAt },
      session,
    });
  }
  return result;
}

export async function escalateComplaintToSuspension(complaintId) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'complaints' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const result = await queryTable('complaints', {
    select: '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
    id: `eq.${complaintId}`,
    limit: '1',
  }, session);
  if (result.error || !result.data?.[0]) return { data: null, error: result.error || 'complaint_not_found', tableName: 'complaints' };

  const complaint = normalizeComplaint(result.data[0]);
  const updateResult = await updateComplaintReview({
    complaintId,
    status: 'sent_to_suspension',
    severity: complaint.severity === 'unassigned' ? 'high' : complaint.severity,
    staffNote: complaint.staffNote || 'Sent to suspension review.',
  });
  if (updateResult.error) return updateResult;

  return {
    data: {
      ...complaint,
      suspensionDraft: {
        userId: complaint.reportedUserId,
        reasonCategory: mapComplaintReasonToSuspensionReason(complaint.reasonCategory),
        reason: `Complaint ${complaint.id}: ${complaint.reasonLabel}. ${complaint.description || ''}`.trim(),
        internalNote: `Evidence: ${complaint.targetType}${complaint.targetId ? ` ${complaint.targetId}` : ''}`,
        complaintId: complaint.id,
      },
    },
    error: null,
    tableName: 'complaints',
  };
}

export async function sendComplaintSupportMessage({ complaintId, recipientRole, body }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'messages' };
  const permission = await requireStaffAnyPermission(['user.block', 'audit.view'], session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };

  const result = await queryTable('complaints', {
    select: '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
    id: `eq.${complaintId}`,
    limit: '1',
  }, session);
  if (result.error || !result.data?.[0]) return { data: null, error: result.error || 'complaint_not_found', tableName: 'complaints' };

  const complaint = normalizeComplaint(result.data[0]);
  const recipientUserId = recipientRole === 'reported' ? complaint.reportedUserId : complaint.reporterUserId;
  if (!recipientUserId) return { data: null, error: 'recipient_not_linked', tableName: 'complaints' };

  const messageResult = await sendCentralSupportMessage({
    recipientUserId,
    body,
    messageType: 'complaint_support_message',
    metadata: {
      complaint_id: complaint.id,
      recipient_role: recipientRole,
      complaint_status: complaint.status,
      actual_staff_user_id: session.user.id,
      system_generated: false,
    },
    session,
  });
  if (!messageResult.error) {
    await updateComplaintReview({
      complaintId,
      status: 'needs_more_info',
      severity: complaint.severity === 'unassigned' ? 'medium' : complaint.severity,
      staffNote: complaint.staffNote,
      priority: complaint.priority || 'normal',
      assignedTeam: complaint.assignedTeam || '',
      slaDueAt: complaint.slaDueAt || '',
    });
    await insertStaffAuditLog({
      action: `complaint.message_${recipientRole}`,
      targetType: 'complaint',
      targetId: complaintId,
      metadata: { recipientUserId, body },
      session,
    });
  }
  return messageResult;
}

export async function fetchSuspensionReviewQueue() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'users' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };

  const [blocksResult, complaintsResult, servicesResult, commentsResult, bookingsResult] = await Promise.all([
    queryTable('user_blocks', {
      select: '*,users!user_blocks_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
      order: 'created_at.desc',
      limit: '50',
    }, session),
    queryTable('complaints', {
      select: '*,reporter:users!complaints_reporter_user_id_fkey(id,email,display_name,nickname,username,avatar_url),reported:users!complaints_reported_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
      status: 'in.(in_review,escalated,sent_to_suspension)',
      order: 'created_at.desc',
      limit: '100',
    }, session),
    queryTable('instructor_services', {
      select: 'id,service_approval_status,instructor_profiles(id,user_id,users(id,email,display_name,nickname,username,avatar_url))',
      service_approval_status: 'in.(Pending,Rejected,pending,rejected)',
      limit: '80',
    }, session),
    queryTable('post_comments', {
      select: 'id,user_id,created_at,users(id,email,display_name,nickname,username,avatar_url)',
      order: 'created_at.desc',
      limit: '120',
    }, session),
    queryTable('bookings', {
      select: 'id,learner_id,status,created_at,users(id,email,display_name,nickname,username,avatar_url)',
      status: 'in.(Cancelled,Rejected,cancelled,rejected)',
      order: 'created_at.desc',
      limit: '120',
    }, session),
  ]);

  const candidates = new Map();
  const upsertCandidate = (user, signal) => {
    const account = normalizeSuspensionAccount(user);
    if (!account.id) return;
    const current = candidates.get(account.id) || { ...account, signals: [], riskScore: 0 };
    current.signals.push(signal);
    current.riskScore += signal.weight || 1;
    candidates.set(account.id, current);
  };

  (blocksResult.data || []).forEach((row) => {
    const block = normalizeUserBlock(row);
    upsertCandidate(row.users || row.user_blocks_user_id_fkey || row.users_user_blocks_user_id_fkey, {
      type: block.active ? 'active_suspension' : 'previous_suspension',
      label: block.active ? 'Active suspension' : 'Previous suspension',
      detail: block.reasonCategory ? humanizeKey(block.reasonCategory) : block.reason || block.status,
      createdAt: block.createdAt,
      weight: block.active ? 5 : 3,
      blockId: block.id,
    });
  });

  (complaintsResult.data || []).forEach((row) => {
    const complaint = normalizeComplaint(row);
    upsertCandidate(row.reported, {
      type: 'complaint',
      label: `Complaint: ${complaint.reasonLabel}`,
      detail: complaint.description || complaint.targetType,
      createdAt: complaint.createdAt,
      weight: complaint.severity === 'critical' ? 6 : complaint.severity === 'high' ? 5 : 4,
      complaintId: complaint.id,
    });
  });

  (servicesResult.data || []).forEach((row) => {
    const profile = row.instructor_profiles || {};
    upsertCandidate(profile.users, {
      type: 'service_review',
      label: String(row.service_approval_status || '').toLowerCase() === 'rejected' ? 'Rejected service' : 'Pending service review',
      detail: 'Credential or service approval requires staff attention',
      createdAt: '',
      weight: String(row.service_approval_status || '').toLowerCase() === 'rejected' ? 3 : 1,
      serviceId: row.id,
    });
  });

  groupBy(commentsResult.data || [], (row) => row.user_id).forEach((rows) => {
    if (rows.length < 3) return;
    upsertCandidate(rows[0].users, {
      type: 'comment_volume',
      label: 'High comment activity',
      detail: `${rows.length} recent comments`,
      createdAt: rows[0].created_at,
      weight: rows.length >= 8 ? 3 : 1,
      commentIds: rows.map((row) => row.id).filter(Boolean),
    });
  });

  groupBy(bookingsResult.data || [], (row) => row.learner_id).forEach((rows) => {
    upsertCandidate(rows[0].users, {
      type: 'booking_dispute',
      label: 'Cancelled/rejected bookings',
      detail: `${rows.length} cancelled or rejected booking records`,
      createdAt: rows[0].created_at,
      weight: rows.length >= 3 ? 4 : 2,
      bookingIds: rows.map((row) => row.id).filter(Boolean),
    });
  });

  const enriched = await enrichSuspensionAccounts([...candidates.values()], session);
  const enrichedUserIds = enriched.map((account) => account.id).filter(Boolean);
  const reviewResult = enrichedUserIds.length ? await queryTable('user_risk_reviews', {
    select: '*',
    user_id: `in.(${enrichedUserIds.join(',')})`,
    order: 'reviewed_at.desc',
    limit: '500',
  }, session) : { data: [], error: null };
  const reviewsByUser = groupBy(reviewResult.data || [], (row) => row.user_id);
  const visibleAccounts = enriched.filter((account) => {
    if (account.activeSuspension) return true;
    const latestSignalAt = account.lastSignalAt ? new Date(account.lastSignalAt).getTime() : 0;
    const latestReview = (reviewsByUser.get(account.id) || [])[0];
    const reviewedAt = latestReview?.reviewed_at ? new Date(latestReview.reviewed_at).getTime() : 0;
    return !reviewedAt || latestSignalAt > reviewedAt + 1000;
  });
  return {
    data: visibleAccounts.sort((a, b) => b.riskScore - a.riskScore || new Date(b.lastSignalAt || 0) - new Date(a.lastSignalAt || 0)),
    error: blocksResult.error || complaintsResult.error || servicesResult.error || commentsResult.error || bookingsResult.error || reviewResult.error || null,
    tableName: blocksResult.tableName || 'users',
  };
}

export async function markSuspensionRiskReviewed({ userId, note = '' }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'user_risk_reviews' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };
  const staffContext = await fetchCurrentStaffContext();
  const result = await insertTable('user_risk_reviews', {
    user_id: userId,
    reviewed_by_staff_member_id: staffContext.data?.member?.id || null,
    reviewed_at: new Date().toISOString(),
    note: note || null,
  }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'user_risk.reviewed',
      targetType: 'user',
      targetId: userId,
      metadata: { note },
      session,
    });
  }
  return result;
}

export async function searchSuspensionAccounts(query) {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'users' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: [], error: permission.error, tableName: permission.tableName };
  const value = String(query || '').trim();
  if (value.length < 2) return { data: [], error: null, tableName: 'users' };

  const filters = [
    `email.ilike.*${escapePostgrestPattern(value)}*`,
    `display_name.ilike.*${escapePostgrestPattern(value)}*`,
    `nickname.ilike.*${escapePostgrestPattern(value)}*`,
    `username.ilike.*${escapePostgrestPattern(value)}*`,
  ];
  if (isUuid(value)) filters.push(`id.eq.${value}`);

  const result = await queryTable('users', {
    select: 'id,email,display_name,nickname,username,avatar_url,created_at',
    or: `(${filters.join(',')})`,
    order: 'created_at.desc',
    limit: '20',
  }, session);
  if (result.error) return result;

  return {
    ...result,
    data: await enrichSuspensionAccounts((result.data || []).map((row) => ({
      ...normalizeSuspensionAccount(row),
      signals: [{ type: 'manual_search', label: 'Manual account search', detail: value, createdAt: '', weight: 0 }],
      riskScore: 0,
    })), session),
  };
}

export async function createUserBlock({
  userId,
  status = 'temporary',
  reason = '',
  blockedUntil = '',
  reasonCategory = '',
  internalNote = '',
  userMessage = '',
  complaintId = '',
}) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'user_blocks' };
  const permission = await requireStaffPermission('user.block', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };
  const staffContext = await fetchCurrentStaffContext();

  const basePayload = {
    user_id: userId,
    status,
    reason: reason || null,
    blocked_until: status === 'temporary' && blockedUntil ? blockedUntil : null,
    created_by_staff_member_id: staffContext.data?.member?.id || null,
    created_by_user_id: session.user.id,
  };
  const result = await insertTable('user_blocks', {
    ...basePayload,
    complaint_id: complaintId || null,
    scope: 'full_account_read_only',
    reason_category: reasonCategory || null,
    internal_note: internalNote || null,
    user_message: userMessage || null,
  }, session).then((insertResult) => (
    insertResult.error && insertResult.error.includes('column')
      ? insertTable('user_blocks', basePayload, session)
      : insertResult
  ));
  if (!result.error) {
    const block = Array.isArray(result.data) ? result.data[0] : result.data;
    await sendSuspensionNotice({
      block,
      userId,
      status,
      blockedUntil,
      reasonCategory,
      userMessage,
      session,
    });
    await insertStaffAuditLog({
      action: `user.${status === 'permanent' ? 'suspended_permanently' : 'suspended_temporarily'}`,
      targetType: 'user',
      targetId: userId,
      metadata: { reason, blockedUntil, reasonCategory, scope: 'full_account_read_only' },
      session,
    });
  }
  return result;
}

export async function liftUserBlock(blockId) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'user_blocks' };
  const permission = await requireStaffPermission('user.unblock', session);
  if (permission.error) return { data: null, error: permission.error, tableName: permission.tableName };
  const staffContext = await fetchCurrentStaffContext();

  const result = await updateTable('user_blocks', blockId, {
    lifted_by_staff_member_id: staffContext.data?.member?.id || null,
    lifted_at: new Date().toISOString(),
  }, session);
  if (!result.error) {
    await insertStaffAuditLog({
      action: 'user.unblocked',
      targetType: 'user_block',
      targetId: blockId,
      metadata: {},
      session,
    });
  }
  return result;
}

async function sendSuspensionNotice({ block, userId, status, blockedUntil, reasonCategory, userMessage, session }) {
  if (!userId || !session) return { data: null, error: null, tableName: 'messages' };
  const supportUserId = CENTRAL_STAFF_USER_ID || session.user.id;
  const recipientName = await fetchUserDisplayNameById(userId, session);
  const text = normalizePublicSupportBody(
    buildSuspensionNoticeText({ status, blockedUntil, reasonCategory, userMessage }),
    true,
    recipientName,
  );

  let conversation = null;
  if (supportUserId === session.user.id) {
    const conversationResult = await ensureDirectConversationWithUser(userId);
    if (!conversationResult.error) conversation = conversationResult.data;
  } else {
    const existingPair = await fetchPairConversation(supportUserId, userId, session);
    if (existingPair.data) conversation = existingPair.data;
  }
  if (!conversation) {
    const fallbackConversation = await ensureDirectConversationWithUser(userId);
    if (!fallbackConversation.error) conversation = fallbackConversation.data;
  }

  const conversationId = conversation?.primaryConversationId || conversation?.conversationIds?.[0] || null;
  const payload = {
    sender_id: supportUserId,
    text_content: text,
    message_type: 'account_suspension_notice',
    metadata: {
      user_block_id: block?.id || null,
      suspension_status: status,
      reason_category: reasonCategory || null,
      actual_staff_user_id: session.user.id,
      centralized_staff_user_id: supportUserId,
      public_sender_name: PUBLIC_SUPPORT_NAME,
      support_notice: true,
    },
  };
  if (conversationId) payload.conversation_id = conversationId;

  let actualConversationId = conversationId;
  let messageResult = await insertTable('messages', payload, session);
  if (messageResult.error && supportUserId !== session.user.id) {
    const fallbackConversation = await ensureDirectConversationWithUser(userId);
    const fallbackConversationId = fallbackConversation.data?.primaryConversationId || fallbackConversation.data?.conversationIds?.[0] || null;
    actualConversationId = fallbackConversationId;
    messageResult = await insertTable('messages', {
      ...payload,
      conversation_id: fallbackConversationId,
      sender_id: session.user.id,
    }, session);
  }

  const message = Array.isArray(messageResult.data) ? messageResult.data[0] : messageResult.data;
  if (!messageResult.error && block?.id && (actualConversationId || message?.id)) {
    await updateTable('user_blocks', block.id, {
      support_conversation_id: actualConversationId,
      system_message_id: message?.id || null,
    }, session);
  }
  if (!messageResult.error && actualConversationId) {
    await updateTable('conversations', actualConversationId, { last_message_at: new Date().toISOString() }, session);
  }

  return messageResult;
}

function buildSuspensionNoticeText({ status, blockedUntil, reasonCategory, userMessage }) {
  const category = reasonCategory ? ` Reason: ${humanizeKey(reasonCategory)}.` : '';
  const endText = status === 'permanent'
    ? 'This suspension does not have an automatic end date.'
    : `This suspension is scheduled to end on ${formatDisplayDate(blockedUntil)} if no further action is required.`;
  const custom = String(userMessage || '').trim();
  if (custom) return `${custom}\n\n${endText}`;
  return `GuideNextdoor has temporarily set your account to read-only while we review a policy or safety concern.${category} You can still sign in and browse public pages, but booking, posting, reactions, comments, and regular chat are paused. You can continue to contact GuideNextdoor support in this chat. ${endText}`;
}

export async function submitBookingRequest(payload) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'bookings' };
  const accountCheck = await requireInteractiveAccount('bookings');
  if (accountCheck.error) return { data: null, ...accountCheck };

  const availabilityResult = await validateBookingAvailability(payload, session);
  if (availabilityResult.error) return availabilityResult;

  const instructorUserId = await fetchServiceInstructorUserId(payload.serviceId, session);
  const conversationResult = instructorUserId
    ? await ensureDirectConversationWithUser(instructorUserId)
    : { data: null, error: null };
  const conversationId = conversationResult.data?.primaryConversationId || '';
  const messageTarget = conversationResult.data?.otherPartyUsername || instructorUserId || '';

  const bookingPayload = {
    learner_id: session.user.id,
    service_id: payload.serviceId,
    lesson_date: payload.lessonDate,
    start_time_utc: payload.startTime,
    duration_hours: Number(payload.durationHours) || 1,
    group_size: Number(payload.groupSize) || 1,
    skill_level_booked: payload.skillLevel,
    location_details: payload.locationDetails || null,
    total_price: Number(payload.totalPrice) || 0,
    status: 'Pending',
  };
  if (conversationId) bookingPayload.conversation_id = conversationId;

  let bookingResult = await insertTable('bookings', bookingPayload, session);
  if (bookingResult.error && bookingPayload.conversation_id && bookingResult.error.includes('conversation_id')) {
    delete bookingPayload.conversation_id;
    bookingResult = await insertTable('bookings', bookingPayload, session);
  }
  if (bookingResult.error && bookingPayload.location_details && bookingResult.error.includes('location_details')) {
    delete bookingPayload.location_details;
    bookingResult = await insertTable('bookings', bookingPayload, session);
  }
  if (bookingResult.error) return bookingResult;

  const booking = Array.isArray(bookingResult.data) ? bookingResult.data[0] : bookingResult.data;
  if (booking?.id && conversationId && !bookingPayload.conversation_id) {
    await updateTable('bookings', booking.id, { conversation_id: conversationId }, session);
  }
  const requestMessage = buildBookingRequestMessage(payload);

  if (booking?.id && requestMessage) {
    const messageResult = await insertBookingRequestMessage({
      booking,
      conversationId,
      payload,
      requestMessage,
      session,
    });

    if (messageResult.error) {
      return {
        data: booking,
        error: messageResult.error,
        tableName: 'messages',
      };
    }

    if (conversationId) {
      await updateTable('conversations', conversationId, { last_message_at: new Date().toISOString() }, session);
    }
  }

  return {
    data: {
      ...booking,
      conversationId,
      messageTarget,
    },
    error: null,
    tableName: 'bookings',
  };
}

async function validateBookingAvailability(payload, session) {
  const serviceResult = await queryTable('instructor_services', {
    select: 'id,instructor_id',
    id: `eq.${payload.serviceId}`,
    limit: '1',
  }, session);
  const service = serviceResult.data?.[0];
  if (serviceResult.error || !service?.instructor_id) {
    return { data: null, error: serviceResult.error || 'service_not_found', tableName: 'instructor_services' };
  }

  const lessonDate = payload.lessonDate || '';
  const startTime = formatTime(payload.startTime);
  const endTime = addHoursToTime(startTime, Math.max(Number(payload.durationHours) || 1, 1));
  if (!lessonDate || !startTime || !endTime) return { data: null, error: 'invalid_booking_time', tableName: 'bookings' };

  const [availabilityResult, overridesResult, busyResult] = await Promise.all([
    queryTable('instructor_availability', {
      select: '*',
      instructor_id: `eq.${service.instructor_id}`,
      is_active: 'eq.true',
      order: 'day_of_week.asc,start_time.asc',
    }, session),
    queryTable('instructor_availability_overrides', {
      select: '*',
      instructor_id: `eq.${service.instructor_id}`,
      override_date: `eq.${lessonDate}`,
      order: 'start_time.asc',
    }, session),
    queryTable('public_booking_busy_slots', {
      select: '*',
      service_id: `eq.${payload.serviceId}`,
      lesson_date: `eq.${lessonDate}`,
      order: 'start_time_utc.asc',
    }, session),
  ]);

  if (availabilityResult.error || overridesResult.error || busyResult.error) {
    return {
      data: null,
      error: availabilityResult.error || overridesResult.error || busyResult.error,
      tableName: availabilityResult.tableName || overridesResult.tableName || busyResult.tableName || 'bookings',
    };
  }

  const effectiveWindows = getEffectiveAvailabilityForDate(
    (availabilityResult.data || []).map((row) => normalizeAvailability(row)),
    (overridesResult.data || []).map((row) => normalizeAvailabilityOverride(row)),
    lessonDate,
  );
  const containingWindow = effectiveWindows.some((window) => startTime >= window.startTime && endTime <= window.endTime);
  if (!containingWindow) return { data: null, error: 'slot_unavailable', tableName: 'bookings' };

  const busySlots = (busyResult.data || []).map((row) => normalizeSearchBooking(row));
  const hasConflict = busySlots.some((slot) => ACTIVE_BOOKING_STATUSES_FOR_VALIDATION.has(String(slot.status || '')) && timeRangesOverlap(startTime, endTime, slot.startTime, slot.endTime));
  if (hasConflict) return { data: null, error: 'slot_unavailable', tableName: 'bookings' };

  return { data: null, error: null, tableName: 'bookings' };
}

async function insertBookingRequestMessage({ booking, conversationId, payload, requestMessage, session }) {
  const basePayload = {
    booking_id: booking.id,
    sender_id: session.user.id,
    text_content: requestMessage,
  };
  const richPayload = {
    ...basePayload,
    message_type: 'booking_request',
    metadata: {
      booking_id: booking.id,
      service_id: payload.serviceId,
      service_title: payload.serviceTitle || '',
      lesson_date: payload.lessonDate,
      start_time: payload.startTime,
      duration_hours: Number(payload.durationHours) || 1,
      group_size: Number(payload.groupSize) || 1,
      skill_level: payload.skillLevel,
      location_details: payload.locationDetails || '-',
      total_price: Number(payload.totalPrice) || 0,
      currency: payload.currency || 'USD',
      note: String(payload.note || '').trim() || '-',
    },
  };
  const attempts = [];

  if (conversationId) {
    attempts.push({ ...richPayload, conversation_id: conversationId });
    attempts.push({ ...basePayload, conversation_id: conversationId });
  }
  attempts.push(richPayload);
  attempts.push(basePayload);

  let lastResult = { error: 'message_insert_failed', tableName: 'messages' };
  for (const attempt of attempts) {
    lastResult = await insertTable('messages', attempt, session, 'return=minimal');
    if (!lastResult.error) return lastResult;
  }

  return lastResult;
}

function buildBookingRequestMessage(payload) {
  const note = String(payload.note || '').trim();
  const lines = [
    'Booking request',
    `Service: ${payload.serviceTitle || 'Session'}`,
    `Date: ${formatDateForMessage(payload.lessonDate)}`,
    `Start time: ${payload.startTime || ''}`,
    `Duration: ${Number(payload.durationHours) || 1} ${Number(payload.durationHours) === 1 ? 'hour' : 'hours'}`,
    `Group size: ${Number(payload.groupSize) || 1} pax`,
    `Skill level: ${payload.skillLevel || ''}`,
    `Location: ${payload.locationDetails || '-'}`,
    `Message: ${note || '-'}`,
  ];

  lines.push(`Estimated total: ${formatAmountForMessage(payload.totalPrice, payload.currency)}`);

  return lines.filter(Boolean).join('\n');
}

function formatDateForMessage(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}-${month}-${year}` : String(value);
}

function formatAmountForMessage(value, currency = 'USD') {
  const amount = Number(value) || 0;
  return `${currency || 'USD'} ${amount.toLocaleString('en', { maximumFractionDigits: 0 })}`;
}

async function fetchServiceInstructorUserId(serviceId, session) {
  if (!serviceId) return '';

  const result = await queryTable('instructor_services', {
    select: 'instructor_profiles(user_id)',
    id: `eq.${serviceId}`,
    limit: '1',
  }, session);

  return result.data?.[0]?.instructor_profiles?.user_id || '';
}

function normalizeCoach(row) {
  const metadata = row.metadata || {};
  const user = row.users || {};
  const location = row.locations || {};
  
  // Naming logic:
  // - nickname: preferred display name (shown on wall/profile)
  // - username: unique slug (used for URLs)
  // - Fallbacks for legacy/mock data
  const nickname = user.nickname || user.display_name || row.display_name || row.full_name || row.name || user.username || 'GuideNextdoor coach';
  const username = user.username || '';

  // Extract languages if joined
  const languages = (user.user_languages || []).map(ul => ({
    id: ul.ref_languages?.id,
    code: ul.ref_languages?.code,
    name: ul.ref_languages?.name,
    nativeName: ul.ref_languages?.native_name,
  })).filter(l => l.id);

  return {
    id: row.id || row.user_id || row.render_id,
    userId: row.user_id || user.id,
    name: nickname,
    nickname,
    username,
    languages,
    role: row.role || row.plan_name || metadata.role || 'Coach',
    roleKey: row.role_key || metadata.role_key || 'coach',
    location: location.formatted_address || location.city || row.location || row.city || metadata.location || 'Location to confirm',
    locationKey: location.id || row.primary_location_id || row.location_key || metadata.location_key || '',
    bio: row.bio_description || row.bio || row.description || row.error || metadata.bio || '',
    rating: row.average_rating || row.rating || metadata.rating || null,
    reviewsCount: row.reviews_count || metadata.reviews_count || 0,
    providedSessionsCount: row.provided_sessions_count || metadata.provided_sessions_count || 0,
    timezone: row.timezone || metadata.timezone || '',
    verified: row.id_verification_status === 'Verified' || Boolean(row.verified || row.is_verified || metadata.verified),
    avatarUrl: user.avatar_url || row.avatar_url || row.image_url || metadata.avatar_url || row.cover_photo_url || '',
    isOnBreak: Boolean(row.is_on_break),
    coverPhotoUrl: row.cover_photo_url || user.avatar_url || row.avatar_url || row.image_url || metadata.avatar_url || '',
    tags: row.tags || metadata.tags || [],
  };
}

function normalizeInstructorService(row) {
  const activity = row.ref_activities || {};
  const qualification = row.ref_qualifications || {};
  const pricingRows = Array.isArray(row.instructor_pricing) ? row.instructor_pricing : [];
  const prices = pricingRows.flatMap((pricing) => [
    pricing.price_1_pax,
    pricing.price_2_pax,
    pricing.price_3_pax,
    pricing.price_4_pax,
  ]).filter((price) => price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price)));
  const minPrice = prices.length ? Math.min(...prices.map(Number)) : null;
  const currency = pricingRows.find((pricing) => pricing.currency)?.currency || 'USD';

  return {
    id: row.id,
    activityId: row.activity_id,
    qualificationId: row.qualification_id || '',
    title: activityDisplayName(activity, 'Coaching session'),
    activityKey: activity.translation_key || activity.category_key || '',
    iconName: activity.icon_name || '',
    qualification: cleanDisplayText(qualification.qualification_name || ''),
    years: row.years_of_experience || 0,
    attainmentYear: row.attainment_year || null,
    tags: row.tags || [],
    description: row.description || row.service_description || '',
    minDurationHours: row.min_duration_hours || 1,
    status: row.service_approval_status || 'Pending',
    rawCertUrl: row.raw_cert_url || '',
    maskedCertUrl: row.masked_cert_url || '',
    activityImageUrls: Array.isArray(row.activity_image_urls) ? row.activity_image_urls.filter(Boolean) : [],
    pricing: pricingRows.map((pricing) => ({
      id: pricing.id,
      skillLevel: pricing.skill_level,
      currency: pricing.currency || currency,
      price1: pricing.price_1_pax,
      price2: pricing.price_2_pax,
      price3: pricing.price_3_pax,
      price4: pricing.price_4_pax,
    })),
    minPrice,
    currency,
    locations: [],
  };
}

function normalizeService(row) {
  const metadata = row.metadata || {};
  const activity = row.ref_activities || {};
  return {
    id: row.id || row.render_id,
    title: cleanDisplayText(row.title || row.name || metadata.title || activityDisplayName(activity, 'Untitled service')),
    coachName: row.coach_name || metadata.coach_name || 'GuideNextdoor coach',
    status: row.service_approval_status || row.status || metadata.status || 'draft',
    location: row.location || metadata.location || 'Location to confirm',
    price: row.price || metadata.price || null,
  };
}

async function attachServiceLocations(services, session = null) {
  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (!serviceIds.length) return services;

  const structuredCoverageResult = await queryTable('service_location_areas', {
    select: '*',
    service_id: `in.(${serviceIds.join(',')})`,
  }, session);
  const structuredRows = !structuredCoverageResult.error ? (structuredCoverageResult.data || []) : [];
  const structuredLocationIds = [...new Set(structuredRows.map((row) => row.location_id).filter(Boolean))];
  const structuredLocationResult = structuredLocationIds.length
    ? await queryTable('ref_service_locations', {
        select: '*',
        id: `in.(${structuredLocationIds.join(',')})`,
      }, session)
    : { data: [] };
  const structuredLocationById = new Map((structuredLocationResult.data || []).map((location) => [location.id, normalizeLocation(location)]));

  const coverageResult = await queryTable('service_coverage_areas', {
    select: '*',
    service_id: `in.(${serviceIds.join(',')})`,
  }, session);
  const legacyRows = !coverageResult.error ? (coverageResult.data || []) : [];

  const locationIds = [...new Set(legacyRows.map((row) => row.location_id).filter(Boolean))];
  const locationResult = locationIds.length
    ? await queryTable('locations', {
        select: '*',
        id: `in.(${locationIds.join(',')})`,
      }, session)
    : { data: [] };
  const locationById = new Map((locationResult.data || []).map((location) => [location.id, normalizeLocation(location)]));

  return services.map((service) => ({
    ...service,
    locations: structuredRows
      .filter((row) => row.service_id === service.id)
      .map((row) => structuredLocationById.get(row.location_id))
      .filter(Boolean)
      .concat(legacyRows
        .filter((row) => row.service_id === service.id && !structuredRows.some((structuredRow) => structuredRow.service_id === service.id))
        .map((row) => locationById.get(row.location_id))
        .filter(Boolean))
      .filter(Boolean),
  }));
}

async function insertServiceLocationAreas(serviceId, locationIds = [], session = null) {
  const ids = [...new Set((locationIds || []).filter(Boolean))];
  if (!serviceId || !ids.length) return { error: null, tableName: 'service_location_areas' };

  const structuredResult = await insertTable('service_location_areas', ids.map((locationId) => ({
    service_id: serviceId,
    location_id: locationId,
  })), session, 'return=minimal');
  if (!structuredResult.error) return structuredResult;

  const legacyResult = await insertTable('service_coverage_areas', ids.map((locationId) => ({
    service_id: serviceId,
    location_id: locationId,
  })), session, 'return=minimal');
  return legacyResult.error ? structuredResult : legacyResult;
}

async function replaceServiceLocationAreas(serviceId, locationIds = [], session = null) {
  if (!serviceId) return { error: 'missing_service_id', tableName: 'service_location_areas' };

  const structuredDelete = await deleteTable('service_location_areas', { service_id: `eq.${serviceId}` }, session);
  if (!structuredDelete.error) {
    return insertServiceLocationAreas(serviceId, locationIds, session);
  }

  const legacyDelete = await deleteTable('service_coverage_areas', { service_id: `eq.${serviceId}` }, session);
  if (legacyDelete.error) return legacyDelete;

  const ids = [...new Set((locationIds || []).filter(Boolean))];
  if (!ids.length) return { error: null, tableName: 'service_coverage_areas' };
  return insertTable('service_coverage_areas', ids.map((locationId) => ({
    service_id: serviceId,
    location_id: locationId,
  })), session, 'return=minimal');
}

function normalizeReview(row) {
  const user = row.users || {};
  const booking = row.bookings || {};
  return {
    id: row.id,
    rating: row.rating || 0,
    comment: row.comment || '',
    createdAt: row.created_at || '',
    displayDate: formatPostDate(row.created_at),
    reviewerName: displayUserName(user),
    lessonDate: booking.lesson_date || '',
    skillLevel: booking.skill_level_booked || '',
    groupSize: booking.group_size || null,
  };
}

function normalizeAvailability(row) {
  return {
    id: row.id,
    instructorId: row.instructor_id || '',
    dayOfWeek: row.day_of_week,
    dayLabel: formatWeekday(row.day_of_week),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
  };
}

function normalizeAvailabilityOverride(row) {
  return {
    id: row.id,
    instructorId: row.instructor_id || '',
    date: row.date || row.override_date || '',
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    isAvailable: row.is_available ?? row.is_active ?? true,
    reason: row.reason || '',
  };
}

function normalizeBookedSlot(row) {
  const durationHours = Number(row.duration_hours) || 1;
  const startTime = formatTime(row.start_time_utc);
  const totalPrice = Number(row.total_price) || 0;
  const user = row.users || {};
  const messages = Array.isArray(row.messages) ? row.messages : [];
  // The first message is typically the learner's note from the booking form
  const firstMessage = messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

  return {
    id: row.id,
    conversationId: row.conversation_id || '',
    serviceId: row.service_id,
    serviceTitle: '',
    lessonDate: row.lesson_date || '',
    startTime,
    endTime: addHoursToTime(startTime, durationHours),
    durationHours,
    groupSize: Number(row.group_size) || 1,
    skillLevel: row.skill_level_booked || '',
    totalPrice,
    currency: row.currency || 'USD',
    status: row.status || 'Pending',
    displayLessonDate: formatLessonDate(row.lesson_date),
    locationDetails: row.location_details || '',
    learnerId: row.learner_id || user.id || '',
    learnerUsername: user.username || '',
    learnerName: displayUserName(user),
    learnerAvatar: user.avatar_url || '',
    learnerNote: firstMessage?.text_content || '',
    createdAt: row.created_at || '',
    cancelledAt: row.cancelled_at || null,
  };
}

function normalizeSearchBooking(row) {
  const durationHours = Number(row.duration_hours) || 1;
  const startTime = formatTime(row.start_time_utc);
  return {
    id: row.id,
    serviceId: row.service_id,
    lessonDate: row.lesson_date || '',
    startTime,
    endTime: addHoursToTime(startTime, durationHours),
    durationHours,
    status: row.status || 'Pending',
  };
}

function mapBookedSlotsToServices(rows, services) {
  const serviceTitleById = new Map(services.map((service) => [service.id, service.title]));

  return rows.map((row) => ({
    ...normalizeBookedSlot(row),
    serviceTitle: serviceTitleById.get(row.service_id) || '',
  }));
}

function buildInstructorStats(coach, services, posts, reviews, bookedSlots = []) {
  const years = services.map((service) => Number(service.years) || 0);
  const totalLikes = posts.reduce((sum, post) => sum + (Number(post.likes) || 0), 0);
  const reviewCount = coach.reviewsCount || reviews.length;
  const completedBookings = bookedSlots.filter((booking) => booking.status === 'Completed');
  const currentMonth = toDateInputMonth(new Date());
  
  const earningsThisMonth = completedBookings
    .filter((booking) => booking.lessonDate?.startsWith(currentMonth))
    .reduce((acc, booking) => {
      const curr = booking.currency || 'USD';
      acc[curr] = (acc[curr] || 0) + booking.totalPrice;
      return acc;
    }, {});

  const totalEarnings = completedBookings.reduce((acc, booking) => {
    const curr = booking.currency || 'USD';
    acc[curr] = (acc[curr] || 0) + booking.totalPrice;
    return acc;
  }, {});
  
  // Calculate average rating from reviews if coach.rating is missing or 0
  let averageRating = Number(coach.rating) || 0;
  if ((!averageRating || averageRating === 0) && reviews.length > 0) {
    const totalRating = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    averageRating = totalRating / reviews.length;
  }

  return {
    maxYears: years.length ? Math.max(...years) : 0,
    serviceCount: services.length,
    postCount: posts.length,
    totalLikes,
    reviewCount,
    averageRating,
    sessionCount: coach.providedSessionsCount || 0,
    completedSessionCount: completedBookings.length,
    pendingSessionCount: bookedSlots.filter((booking) => String(booking.status || '').startsWith('Pending')).length,
    confirmedSessionCount: bookedSlots.filter((booking) => booking.status === 'Confirmed').length,
    earningsThisMonth,
    totalEarnings,
  };
}

function toDateInputMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function humanizeKey(value) {
  const cleaned = String(value || '').replace(/^activity[._-]+/i, '');
  return cleaned
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function activityDisplayName(activity, fallback = 'Activity') {
  return cleanDisplayText(activity?.name || activity?.title || activity?.translation_key || activity?.category_key || fallback);
}

function cleanDisplayText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/activity[._-]+([a-z0-9_-]+)/gi, (_, key) => humanizeKey(key))
    .replace(/\s+/g, ' ')
    .trim();
}

function inferLocationFromText(...parts) {
  const text = parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const knownLocations = [
    ['Hong Kong', ['hong kong', 'hongkong', 'hk', 'victoria park', 'mong kok', 'sham shui po', 'sai kung', 'tsim sha tsui']],
    ['Niseko', ['niseko', 'hirafu', 'hokkaido', 'yotei', 'furano']],
    ['Hakuba', ['hakuba', 'happo-one', 'goryu']],
    ['Bali', ['bali', 'canggu', 'seminyak', 'echo beach']],
    ['Kyoto', ['kyoto', 'gion', 'arashiyama', 'fushimi inari']],
    ['Tokyo', ['tokyo', 'shinjuku', 'shibuya']],
    ['Osaka', ['osaka']],
    ['Macau', ['macau']],
    ['Bangkok', ['bangkok']],
    ['Seoul', ['seoul', 'itaewon', 'hongdae']],
    ['Taipei', ['taipei', 'elephant mountain']],
    ['Melbourne', ['melbourne']],
  ];

  return knownLocations.find(([, aliases]) => aliases.some((alias) => text.includes(alias)))?.[0] || '';
}

export async function fetchConversations() {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'bookings' };
  const suspension = await fetchActiveUserSuspension(session.user.id, session);
  const isSuspended = Boolean(suspension.data);

  const [learnerResult, instructorProfileResult] = await Promise.all([
    queryTable('bookings', {
      select: '*,messages(*),instructor_services(instructor_profiles(user_id,users(id,display_name,nickname,avatar_url,username,email)),ref_activities(translation_key)),users(id,display_name,nickname,avatar_url,username,email)',
      learner_id: `eq.${session.user.id}`,
      order: 'lesson_date.desc,created_at.desc',
    }, session),
    queryTable('instructor_profiles', {
      user_id: `eq.${session.user.id}`,
      select: 'id',
      limit: '1',
    }, session),
  ]);

  let bookingRows = learnerResult.data || [];

  if (instructorProfileResult.data?.[0]?.id) {
    const instructorId = instructorProfileResult.data[0].id;
    const servicesResult = await queryTable('instructor_services', {
      select: 'id',
      instructor_id: `eq.${instructorId}`,
      limit: '240',
    }, session);
    const serviceIds = (servicesResult.data || []).map((service) => service.id).filter(Boolean);
    const instructorBookings = serviceIds.length
      ? await queryTable('bookings', {
          select: '*,messages(*),instructor_services(instructor_profiles(user_id,users(id,display_name,nickname,avatar_url,username,email)),ref_activities(translation_key)),users(id,display_name,nickname,avatar_url,username,email)',
          service_id: `in.(${serviceIds.join(',')})`,
          order: 'lesson_date.desc,created_at.desc',
        }, session)
      : { data: [] };

    if (instructorBookings.data?.length) {
      bookingRows = [...bookingRows, ...instructorBookings.data];
      const seen = new Set();
      bookingRows = bookingRows.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      bookingRows.sort((a, b) => new Date(b.lesson_date) - new Date(a.lesson_date));
    }
  }

  const participantResult = await queryTable('conversation_participants', {
    select: 'conversation_id',
    user_id: `eq.${session.user.id}`,
    limit: '240',
  }, session);

  if (!participantResult.error && participantResult.data?.length) {
    const conversationIds = [...new Set(participantResult.data.map((row) => row.conversation_id).filter(Boolean))];
    const [allParticipantsResult, messagesResult, conversationsResult] = await Promise.all([
      queryTable('conversation_participants', {
        select: 'conversation_id,user_id,users(id,display_name,nickname,avatar_url,username,email)',
        conversation_id: `in.(${conversationIds.join(',')})`,
        limit: '480',
      }, session),
      queryTable('messages', {
        select: '*,users(id,display_name,nickname,avatar_url,username,email)',
        conversation_id: `in.(${conversationIds.join(',')})`,
        order: 'created_at.asc',
        limit: '1000',
      }, session),
      queryTable('conversations', {
        select: '*',
        id: `in.(${conversationIds.join(',')})`,
        limit: '240',
      }, session),
    ]);

    if (!allParticipantsResult.error && !messagesResult.error) {
      const currentUserName = await fetchUserDisplayNameById(session.user.id, session);
      const supportUserIds = await fetchStaffUserIds([
        ...(allParticipantsResult.data || []).map((row) => row.user_id),
        ...(messagesResult.data || []).map((row) => row.sender_id),
      ], session);
      const participantConversations = buildPersonConversations({
        conversationIds,
        participantRows: allParticipantsResult.data || [],
        messageRows: messagesResult.data || [],
        conversationRows: conversationsResult.data || [],
        bookingRows,
        currentUserId: session.user.id,
        currentUserName,
        supportUserIds,
      });

      if (participantConversations.length) {
        const visibleConversations = isSuspended
          ? await filterSupportConversations(participantConversations, session)
          : participantConversations;
        return {
          ...participantResult,
          data: visibleConversations,
        };
      }
    }
  }

  const bookingSupportUserIds = await fetchStaffUserIds(bookingRows.flatMap((row) => [
    row.learner_id,
    row.instructor_services?.instructor_profiles?.user_id,
    ...(Array.isArray(row.messages) ? row.messages.map((message) => message.sender_id) : []),
  ]), session);
  const currentUserName = await fetchUserDisplayNameById(session.user.id, session);
  const groupedConversations = groupBookingConversations(bookingRows, session.user.id, bookingSupportUserIds, currentUserName);
  return {
    ...learnerResult,
    data: isSuspended ? await filterSupportConversations(groupedConversations, session) : groupedConversations,
  };
}

export async function fetchUserMessages() {
  return fetchConversations();
}

async function filterSupportConversations(conversations, session) {
  if (!conversations.length) return [];
  const otherUserIds = [...new Set(conversations.map((conversation) => conversation.otherPartyId).filter(Boolean))];
  if (!otherUserIds.length) return [];
  const staffResult = await queryTable('staff_members', {
    select: 'user_id,status',
    user_id: `in.(${otherUserIds.join(',')})`,
    status: 'eq.active',
    limit: '240',
  }, session);
  const supportIds = new Set([
    ...STAFF_USER_IDS,
    CENTRAL_STAFF_USER_ID,
    ...(staffResult.data || []).map((row) => row.user_id),
  ].filter(Boolean));
  return conversations.filter((conversation) => supportIds.has(conversation.otherPartyId));
}

export async function ensureDirectConversationWithUser(userIdentifier) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'conversations' };
  const resolvedUser = await resolveMessageRecipient(userIdentifier, session);
  if (resolvedUser.error || !resolvedUser.data?.id) {
    return { data: null, error: resolvedUser.error || 'recipient_not_found', tableName: 'users' };
  }
  const otherUserId = resolvedUser.data.id;
  if (!otherUserId || otherUserId === session.user.id) return { data: null, error: 'invalid_recipient', tableName: 'conversations' };
  const suspension = await fetchActiveUserSuspension(session.user.id, session);
  if (suspension.data && !(await isSupportUserId(otherUserId, session))) {
    return { data: null, error: 'account_suspended', tableName: 'conversations' };
  }

  const existingPair = await fetchPairConversation(session.user.id, otherUserId, session);
  if (existingPair.data) return existingPair;

  const participantResult = await queryTable('conversation_participants', {
    select: 'conversation_id,user_id,users(id,display_name,nickname,avatar_url,username,email)',
    user_id: `in.(${session.user.id},${otherUserId})`,
    limit: '500',
  }, session);

  if (!participantResult.error && participantResult.data?.length) {
    const grouped = groupBy(participantResult.data, (row) => row.conversation_id);
    const existingConversationId = [...grouped.entries()]
      .find(([, participants]) => {
        const ids = participants.map((participant) => participant.user_id);
        return ids.includes(session.user.id) && ids.includes(otherUserId);
      })?.[0];

    if (existingConversationId) {
      const conversations = await fetchConversations();
      const existing = (conversations.data || []).find((conversation) => conversation.conversationIds?.includes(existingConversationId));
      if (existing) return { ...conversations, data: existing };
    }
  }

  const otherUser = resolvedUser.data;
  const supportUserIds = await fetchStaffUserIds([otherUserId], session);
  const otherPartyName = supportUserIds.has(otherUserId) ? PUBLIC_SUPPORT_NAME : displayUserName(otherUser);
  const otherPartyAvatarUrl = supportUserIds.has(otherUserId) ? PUBLIC_SUPPORT_AVATAR_URL : (otherUser.avatar_url || '');

  const buildPendingConversation = (error = null) => ({
    data: finalizePersonConversation({
      id: `person:${otherUserId}`,
      conversationIds: [],
      bookingIds: [],
      primaryConversationId: '',
      pendingDirectUserId: otherUserId,
      messages: [],
      bookings: [],
      otherPartyId: otherUserId,
      otherPartyUsername: otherUser.username || '',
      otherPartyName,
      coachName: otherPartyName,
      avatarUrl: otherPartyAvatarUrl,
      title: 'Direct messages',
      location: '',
      displayDate: formatDisplayDate(new Date().toISOString()),
      status: 'Active',
      lessonDate: '',
      startTime: '',
      endTime: '',
      durationHours: 0,
      groupSize: 1,
      skillLevel: '',
      totalPrice: 0,
      currency: 'USD',
      isLearner: false,
      lastMessage: 'No messages yet',
      lastMessageAt: new Date().toISOString(),
      messageCount: 0,
    }, session.user.id, supportUserIds),
    error,
    tableName: 'conversations',
  });

  const conversationId = crypto.randomUUID();
  const pairIds = orderedPairIds(session.user.id, otherUserId);
  const conversationPayload = {
    id: conversationId,
    participant_one_id: pairIds[0],
    participant_two_id: pairIds[1],
    last_message_at: new Date().toISOString(),
  };
  let conversationResult = await insertTable('conversations', conversationPayload, session, 'return=minimal');
  if (conversationResult.error && conversationResult.error.includes('participant_')) {
    delete conversationPayload.participant_one_id;
    delete conversationPayload.participant_two_id;
    conversationResult = await insertTable('conversations', conversationPayload, session, 'return=minimal');
  }
  if (
    conversationResult.error
    && (
      conversationResult.error.includes('duplicate key')
      || conversationResult.error.includes('23505')
      || conversationResult.error.includes('conversations_unique_person_pair')
    )
  ) {
    const duplicatePair = await fetchPairConversation(session.user.id, otherUserId, session);
    if (duplicatePair.data) return duplicatePair;
  }
  if (conversationResult.error) return buildPendingConversation(conversationResult.error);

  const ownParticipantResult = await insertTable('conversation_participants', {
    conversation_id: conversationId,
    user_id: session.user.id,
  }, session, 'return=minimal');
  if (ownParticipantResult.error) return buildPendingConversation(ownParticipantResult.error);

  const otherParticipantResult = await insertTable('conversation_participants', {
    conversation_id: conversationId,
    user_id: otherUserId,
  }, session, 'return=minimal');
  if (otherParticipantResult.error) return buildPendingConversation(otherParticipantResult.error);

  return {
    data: finalizePersonConversation({
      id: `person:${otherUserId}`,
      conversationIds: [conversationId],
      bookingIds: [],
      primaryConversationId: conversationId,
      messages: [],
      bookings: [],
      otherPartyId: otherUserId,
      otherPartyUsername: otherUser.username || '',
      otherPartyName,
      coachName: otherPartyName,
      avatarUrl: otherPartyAvatarUrl,
      title: 'Direct messages',
      location: '',
      displayDate: formatDisplayDate(new Date().toISOString()),
      status: 'Active',
      lessonDate: '',
      startTime: '',
      endTime: '',
      durationHours: 0,
      groupSize: 1,
      skillLevel: '',
      totalPrice: 0,
      currency: 'USD',
      isLearner: false,
      lastMessage: 'No messages yet',
      lastMessageAt: new Date().toISOString(),
      messageCount: 0,
    }, session.user.id, supportUserIds),
    error: null,
    tableName: 'conversations',
  };
}

async function resolveMessageRecipient(identifier, session) {
  const value = String(identifier || '').trim();
  if (!value) return { data: null, error: 'invalid_recipient', tableName: 'users' };

  const filterKey = isUuid(value) ? 'id' : 'username';
  const result = await queryTable('users', {
    select: 'id,display_name,avatar_url,username,email',
    [filterKey]: `eq.${value}`,
    limit: '1',
  }, session);

  return {
    ...result,
    data: result.data?.[0] || null,
  };
}

async function isSupportUserId(userId, session) {
  if (!userId) return false;
  if (STAFF_USER_IDS.includes(userId) || userId === CENTRAL_STAFF_USER_ID) return true;
  const staffResult = await queryTable('staff_members', {
    select: 'id',
    user_id: `eq.${userId}`,
    status: 'eq.active',
    limit: '1',
  }, session);
  return Boolean(staffResult.data?.[0]?.id);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fetchPairConversation(currentUserId, otherUserId, session) {
  const [participantOneId, participantTwoId] = orderedPairIds(currentUserId, otherUserId);
  const pairResult = await queryTable('conversations', {
    select: '*',
    participant_one_id: `eq.${participantOneId}`,
    participant_two_id: `eq.${participantTwoId}`,
    merged_into_conversation_id: 'is.null',
    limit: '1',
  }, session);

  if (pairResult.error || !pairResult.data?.[0]?.id) {
    return { data: null, error: pairResult.error, tableName: 'conversations' };
  }

  const conversations = await fetchConversations();
  const existing = (conversations.data || []).find((conversation) => (
    conversation.conversationIds?.includes(pairResult.data[0].id)
    || conversation.primaryConversationId === pairResult.data[0].id
    || conversation.otherPartyId === otherUserId
  ));

  return {
    ...pairResult,
    data: existing || null,
  };
}

function orderedPairIds(userId, otherUserId) {
  return [userId, otherUserId].sort();
}

export async function fetchConversationMessages(conversation) {
  const session = await getActiveSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'messages' };
  if (conversation?.pendingDirectUserId && !conversation?.primaryConversationId) {
    return { data: [], error: null, tableName: 'messages' };
  }
  const conversationIds = Array.isArray(conversation?.conversationIds) ? conversation.conversationIds : [];
  const bookingIds = Array.isArray(conversation?.bookingIds) ? conversation.bookingIds : [];

  if (!conversationIds.length && !bookingIds.length) return { data: [], error: 'missing_conversation', tableName: 'messages' };

  const results = await Promise.all([
    conversationIds.length
      ? queryTable('messages', {
          select: '*,users(id,display_name,nickname,avatar_url,username,email)',
          conversation_id: `in.(${conversationIds.join(',')})`,
          order: 'created_at.asc',
          limit: '1000',
        }, session)
      : { data: [], error: null },
    bookingIds.length
      ? queryTable('messages', {
          select: '*,users(id,display_name,nickname,avatar_url,username,email)',
          booking_id: `in.(${bookingIds.join(',')})`,
          order: 'created_at.asc',
          limit: '1000',
        }, session)
      : { data: [], error: null },
  ]);

  const error = results.find((result) => result.error)?.error || null;
  const seen = new Set();
  const data = collapseDuplicateLifecycleMessages(results
    .flatMap((result) => result.data || [])
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  const supportUserIds = await fetchStaffUserIds(data.map((row) => row.sender_id), session);
  const currentUserName = await fetchUserDisplayNameById(session.user.id, session);

  return {
    tableName: 'messages',
    error,
    data: data.map((row) => normalizeMessage(row, session.user.id, supportUserIds, currentUserName)),
  };
}

function collapseDuplicateLifecycleMessages(messages) {
  const seenLifecycle = new Set();

  return messages.filter((message) => {
    const key = lifecycleMessageDedupeKey(message);
    if (!key) return true;
    if (seenLifecycle.has(key)) return false;
    seenLifecycle.add(key);
    return true;
  });
}

function lifecycleMessageDedupeKey(message) {
  const type = normalizeLifecycleMessageType(message);
  if (!type) return '';
  const bookingId = message.booking_id || message.metadata?.booking_id || '';
  return `${bookingId}:${type}`;
}

function normalizeLifecycleMessageType(message) {
  const type = message.message_type || message.metadata?.lifecycle_event || '';
  if (type === COMPLETION_PROMPT_MESSAGE_TYPE || type === AUTO_COMPLETED_MESSAGE_TYPE) return type;

  const body = String(message.text_content || '');
  if (body.startsWith('Session completion check')) return COMPLETION_PROMPT_MESSAGE_TYPE;
  if (body.startsWith('Session marked as completed automatically')) return AUTO_COMPLETED_MESSAGE_TYPE;
  return '';
}

export async function sendConversationMessage({ conversationId, bookingId, text }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'messages' };

  const body = String(text || '').trim();
  if ((!conversationId && !bookingId) || !body) return { data: null, error: 'missing_message', tableName: 'messages' };
  const suspension = await fetchActiveUserSuspension(session.user.id, session);
  if (suspension.data) {
    const supportConversation = conversationId ? await isSupportConversation(conversationId, session) : false;
    if (!supportConversation) return { data: null, error: 'account_suspended', tableName: 'messages' };
  }

  const payload = {
    sender_id: session.user.id,
    text_content: body,
    message_type: 'text',
  };

  if (conversationId) payload.conversation_id = conversationId;
  if (bookingId) payload.booking_id = bookingId;

  const result = await insertTable('messages', payload, session);
  if (!result.error && conversationId) {
    await updateTable('conversations', conversationId, { last_message_at: new Date().toISOString() }, session);
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    ...result,
    data: row ? normalizeMessage(row, session.user.id) : null,
  };
}

async function isSupportConversation(conversationId, session) {
  if (!conversationId) return false;
  const participantResult = await queryTable('conversation_participants', {
    select: 'user_id',
    conversation_id: `eq.${conversationId}`,
    limit: '20',
  }, session);
  if (participantResult.error) return false;
  const otherParticipantIds = (participantResult.data || [])
    .map((row) => row.user_id)
    .filter((userId) => userId && userId !== session.user.id);
  if (!otherParticipantIds.length) return false;
  const checks = await Promise.all(otherParticipantIds.map((userId) => isSupportUserId(userId, session)));
  return checks.some(Boolean);
}

export async function updateBookingRequest({ bookingId, conversationId, updates, summary }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'bookings' };
  if (!bookingId) return { data: null, error: 'missing_booking', tableName: 'bookings' };
  const accountCheck = await requireInteractiveAccount('bookings');
  if (accountCheck.error) return { data: null, ...accountCheck };

  const bookingPayload = normalizeBookingUpdatePayload(updates);
  let bookingResult = Object.keys(bookingPayload).length
    ? await updateTable('bookings', bookingId, bookingPayload, session)
    : { data: null, error: null, tableName: 'bookings' };

  if (bookingResult.error && bookingPayload.location_details && bookingResult.error.includes('location_details')) {
    delete bookingPayload.location_details;
    bookingResult = await updateTable('bookings', bookingId, bookingPayload, session);
  }
  if (bookingResult.error) return bookingResult;

  const messageText = String(summary || '').trim();
  if (messageText) {
    const messageResult = await insertBookingUpdateMessage({
      bookingId,
      conversationId,
      text: messageText,
      session,
      updates,
    });
    if (messageResult.error) return { data: bookingResult.data, error: messageResult.error, tableName: 'messages' };
  }

  return { data: bookingResult.data, error: null, tableName: 'bookings' };
}

function normalizeBookingUpdatePayload(updates = {}) {
  const payload = {};
  if (updates.lessonDate !== undefined) payload.lesson_date = updates.lessonDate;
  if (updates.startTime !== undefined) payload.start_time_utc = updates.startTime;
  if (updates.durationHours !== undefined) payload.duration_hours = Number(updates.durationHours) || 1;
  if (updates.groupSize !== undefined) payload.group_size = Number(updates.groupSize) || 1;
  if (updates.skillLevel !== undefined) payload.skill_level_booked = updates.skillLevel;
  if (updates.locationDetails !== undefined) payload.location_details = updates.locationDetails || null;
  if (updates.totalPrice !== undefined) payload.total_price = Number(updates.totalPrice) || 0;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.cancelledAt !== undefined) payload.cancelled_at = updates.cancelledAt;
  return payload;
}

async function insertBookingUpdateMessage({ bookingId, conversationId, text, session, updates }) {
  const basePayload = {
    booking_id: bookingId,
    sender_id: session.user.id,
    text_content: text,
  };
  const richPayload = {
    ...basePayload,
    message_type: updates?.status === 'Cancelled' ? 'booking_cancelled' : 'booking_update',
    metadata: {
      booking_id: bookingId,
      updates: updates || {},
    },
  };
  const attempts = [];
  if (conversationId) {
    attempts.push({ ...richPayload, conversation_id: conversationId });
    attempts.push({ ...basePayload, conversation_id: conversationId });
  }
  attempts.push(richPayload);
  attempts.push(basePayload);

  let lastResult = { error: 'message_insert_failed', tableName: 'messages' };
  for (const attempt of attempts) {
    lastResult = await insertTable('messages', attempt, session, 'return=minimal');
    if (!lastResult.error) {
      if (conversationId) await updateTable('conversations', conversationId, { last_message_at: new Date().toISOString() }, session);
      return lastResult;
    }
  }
  return lastResult;
}

function buildPersonConversations({ conversationIds, participantRows, messageRows, conversationRows, bookingRows, currentUserId, currentUserName = '', supportUserIds = new Set() }) {
  const participantsByConversation = groupBy(participantRows, (row) => row.conversation_id);
  const messagesByConversation = groupBy(messageRows, (row) => row.conversation_id);
  const conversationsById = new Map(conversationRows.map((row) => [row.id, row]));
  const bookingsByOtherParty = groupBy(bookingRows.map((row) => normalizeConversation(row, currentUserId)), (booking) => booking.otherPartyId);
  const byPerson = new Map();

  conversationIds.forEach((conversationId) => {
    const participants = participantsByConversation.get(conversationId) || [];
    const otherParticipant = participants.find((row) => row.user_id !== currentUserId);
    if (!otherParticipant?.user_id) return;

    const existing = byPerson.get(otherParticipant.user_id) || {
      id: `person:${otherParticipant.user_id}`,
      conversationIds: [],
      bookingIds: [],
      primaryConversationId: conversationId,
      messages: [],
      bookings: bookingsByOtherParty.get(otherParticipant.user_id) || [],
      otherPartyId: otherParticipant.user_id,
      otherPartyUsername: otherParticipant.users?.username || '',
      otherPartyName: publicConversationName(otherParticipant.user_id, otherParticipant.users, supportUserIds),
      coachName: publicConversationName(otherParticipant.user_id, otherParticipant.users, supportUserIds),
      avatarUrl: publicConversationAvatar(otherParticipant.user_id, otherParticipant.users, supportUserIds),
      title: 'Direct messages',
      location: '',
      displayDate: '',
      status: 'Active',
      lessonDate: '',
      startTime: '',
      endTime: '',
      durationHours: 0,
      groupSize: 1,
      skillLevel: '',
      totalPrice: 0,
      currency: 'USD',
      isLearner: false,
      lastMessage: 'No messages yet',
      lastMessageAt: conversationsById.get(conversationId)?.last_message_at || conversationsById.get(conversationId)?.created_at || '',
      messageCount: 0,
    };

    existing.conversationIds.push(conversationId);
    existing.messages.push(...(messagesByConversation.get(conversationId) || []));
    const conversationRow = conversationsById.get(conversationId);
    if (conversationRow?.booking_id && !existing.bookingIds.includes(conversationRow.booking_id)) {
      existing.bookingIds.push(conversationRow.booking_id);
    }
    byPerson.set(otherParticipant.user_id, existing);
  });

  bookingRows.map((row) => normalizeConversation(row, currentUserId)).forEach((booking) => {
    if (!booking.otherPartyId) return;
    const existing = byPerson.get(booking.otherPartyId);
    if (existing) {
      if (!existing.bookingIds.includes(booking.bookingId)) existing.bookingIds.push(booking.bookingId);
      existing.bookings.push(booking);
    } else {
      byPerson.set(booking.otherPartyId, {
        ...booking,
        ...publicConversationFields(booking.otherPartyId, {
          otherPartyName: booking.otherPartyName,
          coachName: booking.coachName,
          avatarUrl: booking.avatarUrl,
        }, supportUserIds),
        id: `person:${booking.otherPartyId}`,
        conversationIds: [],
        bookingIds: [booking.bookingId],
        primaryConversationId: '',
        bookings: [booking],
      });
    }
  });

  return [...byPerson.values()]
    .map((conversation) => finalizePersonConversation(conversation, currentUserId, supportUserIds, currentUserName))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function finalizePersonConversation(conversation, currentUserId, supportUserIds = new Set(), currentUserName = '') {
  const messages = [...(conversation.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lastMessage = messages[messages.length - 1];
  const latestBooking = [...(conversation.bookings || [])].sort((a, b) => new Date(b.lessonDate || 0) - new Date(a.lessonDate || 0))[0];
  const publicFields = publicConversationFields(conversation.otherPartyId, conversation, supportUserIds);
  const lastMessageBody = lastMessage
    ? normalizePublicSupportBody(
      lastMessage.text_content,
      isPublicSupportSender(lastMessage.sender_id, currentUserId, supportUserIds, lastMessage.metadata, lastMessage.users),
      currentUserName,
    )
    : '';

  return {
    ...conversation,
    ...publicFields,
    bookingIds: [...new Set([...(conversation.bookingIds || []), ...((conversation.bookings || []).map((booking) => booking.bookingId))].filter(Boolean))],
    primaryConversationId: conversation.primaryConversationId || conversation.conversationIds?.[0] || '',
    bookingId: latestBooking?.bookingId || conversation.bookingIds?.[0] || '',
    title: latestBooking?.title || conversation.title || 'Direct messages',
    location: latestBooking?.location || conversation.location || '',
    displayDate: formatDisplayDate(lastMessage?.created_at || conversation.lastMessageAt || latestBooking?.lessonDate),
    status: latestBooking?.status || conversation.status || 'Active',
    lessonDate: latestBooking?.lessonDate || conversation.lessonDate || '',
    startTime: latestBooking?.startTime || conversation.startTime || '',
    endTime: latestBooking?.endTime || conversation.endTime || '',
    durationHours: latestBooking?.durationHours || conversation.durationHours || 0,
    groupSize: latestBooking?.groupSize || conversation.groupSize || 1,
    skillLevel: latestBooking?.skillLevel || conversation.skillLevel || '',
    totalPrice: latestBooking?.totalPrice || conversation.totalPrice || 0,
    currency: latestBooking?.currency || conversation.currency || 'USD',
    isLearner: latestBooking?.isLearner || conversation.isLearner || false,
    lastMessage: lastMessageBody || latestBooking?.lastMessage || 'No messages yet',
    lastMessageAt: lastMessage?.created_at || latestBooking?.lastMessageAt || conversation.lastMessageAt || '',
    messageCount: messages.length,
    previewSenderName: lastMessage ? publicSenderName(lastMessage.sender_id, lastMessage.users, lastMessage.metadata, currentUserId, supportUserIds) : '',
    lastMessageIsMine: lastMessage?.sender_id === currentUserId,
  };
}

function groupBookingConversations(bookingRows, currentUserId, supportUserIds = new Set(), currentUserName = '') {
  const byPerson = new Map();
  bookingRows.map((row) => normalizeConversation(row, currentUserId)).forEach((booking) => {
    const key = booking.otherPartyId || booking.bookingId;
    const publicFields = publicConversationFields(booking.otherPartyId, booking, supportUserIds);
    const existing = byPerson.get(key);
    if (existing) {
      existing.bookings.push(booking);
      existing.bookingIds.push(booking.bookingId);
      existing.messages.push(...booking.messages);
      byPerson.set(key, finalizePersonConversation({ ...existing, ...publicFields }, currentUserId, supportUserIds, currentUserName));
    } else {
      byPerson.set(key, finalizePersonConversation({
        ...booking,
        ...publicFields,
        id: `person:${key}`,
        conversationIds: [],
        bookingIds: [booking.bookingId],
        primaryConversationId: '',
        bookings: [booking],
        messages: booking.messages,
      }, currentUserId, supportUserIds, currentUserName));
    }
  });

  return [...byPerson.values()].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function normalizeConversation(row, currentUserId) {
  const service = row.instructor_services || {};
  const instructorProfile = service.instructor_profiles || {};
  const instructorUser = instructorProfile.users || {};
  const activity = service.ref_activities || {};
  const learnerUser = row.users || {};
  const messages = [...(Array.isArray(row.messages) ? row.messages : [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lastMessage = messages[messages.length - 1];

  const isLearner = row.learner_id === currentUserId;
  const otherParty = isLearner ? instructorUser : learnerUser;
  const durationHours = Number(row.duration_hours) || 1;
  const startTime = formatTime(row.start_time_utc);

  return {
    id: row.id,
    bookingId: row.id,
    bookingIds: [row.id].filter(Boolean),
    conversationIds: [],
    primaryConversationId: '',
    title: humanizeKey(activity.translation_key || 'Chat'),
    otherPartyId: otherParty.id || (isLearner ? instructorProfile.user_id : row.learner_id) || '',
    otherPartyUsername: otherParty.username || '',
    otherPartyName: displayUserName(otherParty),
    coachName: displayUserName(otherParty),
    avatarUrl: otherParty.avatar_url || '',
    location: row.lesson_date ? formatDisplayDate(row.lesson_date) : 'Pending',
    displayDate: row.lesson_date ? formatDisplayDate(row.lesson_date) : formatDisplayDate(row.created_at),
    status: row.status || 'Active',
    lessonDate: row.lesson_date || '',
    startTime,
    endTime: addHoursToTime(startTime, durationHours),
    durationHours,
    groupSize: Number(row.group_size) || 1,
    skillLevel: row.skill_level_booked || '',
    locationDetails: row.location_details || '',
    totalPrice: Number(row.total_price) || 0,
    currency: row.currency || 'USD',
    isLearner,
    learnerName: displayUserName(learnerUser),
    messages,
    lastMessage: lastMessage?.text_content || 'No messages yet',
    lastMessageAt: lastMessage?.created_at || row.created_at || '',
    messageCount: messages.length,
  };
}

function normalizeMessage(row, currentUserId, supportUserIds = new Set(), currentUserName = '') {
  const user = row.users || {};
  const metadata = row.metadata || {};
  const isPublicSupport = isPublicSupportSender(row.sender_id, currentUserId, supportUserIds, metadata, user);
  return {
    id: row.id,
    bookingId: row.booking_id,
    senderId: row.sender_id,
    body: normalizePublicSupportBody(row.text_content, isPublicSupport, currentUserName),
    imageUrl: row.image_url || '',
    messageType: row.message_type || 'text',
    metadata,
    createdAt: row.created_at || '',
    displayTime: formatMessageTime(row.created_at),
    isMine: row.sender_id === currentUserId,
    senderName: isPublicSupport ? PUBLIC_SUPPORT_NAME : displayUserName(user),
    avatarUrl: isPublicSupport ? PUBLIC_SUPPORT_AVATAR_URL : (user.avatar_url || ''),
  };
}

async function fetchStaffUserIds(userIds, session) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const staffIds = new Set(ids.filter((id) => STAFF_USER_IDS.includes(id) || id === CENTRAL_STAFF_USER_ID));
  const lookupIds = ids.filter((id) => !staffIds.has(id));
  if (!lookupIds.length) return staffIds;

  const result = await queryTable('staff_members', {
    select: 'user_id',
    user_id: `in.(${lookupIds.join(',')})`,
    limit: '500',
  }, session);

  (result.data || []).forEach((row) => {
    if (row.user_id) staffIds.add(row.user_id);
  });
  return staffIds;
}

function isPublicSupportSender(senderId, currentUserId, supportUserIds, metadata = {}, user = {}) {
  return senderId !== currentUserId && (
    supportUserIds.has(senderId)
    || isStaffUserRecord(user)
    || Boolean(metadata.actual_staff_user_id)
    || Boolean(metadata.centralized_staff_user_id)
    || String(metadata.public_sender_name || '').toLowerCase().includes('guidenextdoor')
  );
}

function publicSenderName(senderId, user, metadata, currentUserId, supportUserIds) {
  return isPublicSupportSender(senderId, currentUserId, supportUserIds, metadata, user)
    ? PUBLIC_SUPPORT_NAME
    : displayUserName(user);
}

function publicConversationFields(userId, conversation, supportUserIds) {
  if (!supportUserIds.has(userId) && !isStaffUserRecord(conversation)) return {};
  return {
    otherPartyName: PUBLIC_SUPPORT_NAME,
    coachName: PUBLIC_SUPPORT_NAME,
    avatarUrl: PUBLIC_SUPPORT_AVATAR_URL,
  };
}

function publicConversationName(userId, user, supportUserIds) {
  return supportUserIds.has(userId) || isStaffUserRecord(user) ? PUBLIC_SUPPORT_NAME : displayUserName(user);
}

function publicConversationAvatar(userId, user, supportUserIds) {
  return supportUserIds.has(userId) || isStaffUserRecord(user) ? PUBLIC_SUPPORT_AVATAR_URL : (user?.avatar_url || '');
}

function isStaffUserRecord(user = {}) {
  const email = String(user.email || '').toLowerCase();
  if (!email) return false;
  return STAFF_EMAILS.includes(email)
    || email.endsWith('@guidenextdoor.com')
    || email.endsWith('@insurvault.com.hk');
}

function normalizePublicSupportBody(body, isPublicSupport, currentUserName = '') {
  const original = String(body || '').trim();
  if (!original || !isPublicSupport) return original;

  let text = original.replaceAll('GuideNextdoor Support', PUBLIC_SUPPORT_NAME);
  const name = String(currentUserName || '').trim() || 'there';

  if (/^hi\s+[^,\n]+,/i.test(text)) {
    return text.replace(/^hi\s+[^,\n]+,/i, `Hi ${name},`);
  }
  if (/^hi,/i.test(text)) {
    return text.replace(/^hi,/i, `Hi ${name},`);
  }
  return `Hi ${name}, ${text}`;
}

function displayUserName(user = {}) {
  return user.nickname || user.display_name || user.username || user.email || 'GuideNextdoor user';
}

async function fetchUserDisplayNameById(userId, session) {
  if (!userId) return '';
  const result = await queryTable('users', {
    select: 'id,email,display_name,nickname,username',
    id: `eq.${userId}`,
    limit: '1',
  }, session);
  return displayUserName(result.data?.[0] || {});
}

async function ensureUserProfile(session, profile = {}) {
  if (!session?.user?.id) return { data: null, error: 'auth_required', tableName: 'users' };
  const existing = await queryTable('users', {
    select: 'id,email,display_name,nickname,username,avatar_url',
    id: `eq.${session.user.id}`,
    limit: '1',
  }, session);
  if (existing.error) return { data: null, error: existing.error, tableName: 'users' };

  const nickname = String(profile.nickname || profile.displayName || session.user.user_metadata?.nickname || session.user.user_metadata?.display_name || session.user.email || '').trim();
  const payload = {
    email: session.user.email || '',
    display_name: profile.displayName || nickname,
    nickname,
  };

  if (existing.data?.[0]) {
    const updatePayload = {};
    if (profile.displayName || !existing.data[0].display_name) updatePayload.display_name = payload.display_name;
    if (nickname && !existing.data[0].nickname) updatePayload.nickname = nickname;
    if (Object.keys(updatePayload).length) {
      const updated = await updateTable('users', session.user.id, updatePayload, session);
      if (!updated.error) return updated;
    }
    return { data: existing.data[0], error: null, tableName: 'users' };
  }

  return insertTable('users', {
    id: session.user.id,
    email: payload.email,
    display_name: payload.display_name,
    nickname: payload.nickname,
    avatar_url: null,
  }, session);
}

function normalizeAccountProfile(row, session) {
  const user = row || {};
  return {
    id: user.id || session?.user?.id || '',
    email: user.email || session?.user?.email || '',
    displayName: user.display_name || user.nickname || user.username || session?.user?.email || '',
    nickname: user.nickname || user.display_name || user.username || '',
    username: user.username || '',
    avatarUrl: user.avatar_url || '',
  };
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!key) return map;
    const values = map.get(key) || [];
    values.push(item);
    map.set(key, values);
    return map;
  }, new Map());
}

function normalizeComment(row) {
  const user = row.users || {};
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    displayDate: formatPostDate(row.created_at),
    userName: displayUserName(user),
    avatarUrl: user.avatar_url || '',
  };
}

function normalizePost(row) {
  const profile = row.instructor_profiles || {};
  const user = profile.users || {};
  const explicitLocation = row.locations || {};
  const profileLocation = profile.locations || {};
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const caption = row.caption || row.title || '';
  const inferredLocation = inferLocationFromText(row.title, row.caption, row.hashtags);
  const locationName = inferredLocation
    || explicitLocation.name
    || explicitLocation.formatted_address
    || explicitLocation.city
    || explicitLocation.city_or_region
    || profileLocation.name
    || profileLocation.formatted_address
    || profileLocation.city
    || profileLocation.city_or_region
    || '';
  
  // If the row contains joined interaction data (from user_liked/user_saved), use it.
  // Otherwise default to the explicit liked/saved flags if provided in the row.
  const liked = row.user_liked ? row.user_liked.length > 0 : (row.liked || false);
  const saved = row.user_saved ? row.user_saved.length > 0 : (row.saved || false);

  return {
    id: row.id,
    instructorId: row.instructor_id,
    serviceId: row.service_id,
    title: row.title || row.caption || 'GuideNextdoor story',
    caption,
    imageUrl: row.media_url || imageUrls[0] || '',
    aspectRatio: row.aspect_ratio || '4 / 5',
    likes: row.likes_count || 0,
    comments: row.comments_count || row.comment_count || 0,
    approvalStatus: row.approval_status || 'Pending',
    createdAt: row.created_at || '',
    displayDate: formatPostDate(row.created_at),
    coachName: user.nickname || user.display_name || user.username || 'GuideNextdoor coach',
    authorUserId: user.id || profile.user_id || '',
    authorUsername: user.username || '',
    avatarUrl: user.avatar_url || profile.cover_photo_url || '',
    hashtags: row.hashtags || [],
    location: locationName,
    liked,
    saved,
  };
}

function normalizeStaffModerationPost(row, context = {}) {
  const post = normalizePost(row || {});
  const profile = row?.instructor_profiles || {};
  const user = profile.users || {};
  const imageUrls = Array.isArray(row?.image_urls) ? row.image_urls : [];
  const complaints = (context.complaints || []).map(normalizeComplaint);
  const comments = (context.comments || []).map(normalizeModerationComment);
  const activeAuthorSuspension = (context.authorBlocks || []).map(normalizeUserBlock).find(isActiveUserBlock) || null;
  const updatedAt = row?.updated_at || row?.created_at || '';
  const moderationStatus = row?.moderation_status || (String(row?.approval_status || '').toLowerCase() === 'removed' ? 'removed' : 'published');
  const riskSignals = buildPostRiskSignals({ row, post, complaints, comments, activeAuthorSuspension });
  return {
    ...post,
    authorEmail: user.email || '',
    authorUserId: user.id || profile.user_id || post.authorUserId || '',
    mediaUrls: imageUrls.length ? imageUrls : [post.imageUrl].filter(Boolean),
    approvalStatus: row?.approval_status || post.approvalStatus,
    moderationStatus,
    removedAt: row?.removed_at || '',
    removalReason: row?.removal_reason || '',
    moderationNote: row?.moderation_note || '',
    moderationReviewedAt: row?.moderation_reviewed_at || '',
    moderationReviewedByStaffMemberId: row?.moderation_reviewed_by_staff_member_id || '',
    updatedAt,
    displayUpdatedAt: formatDisplayDate(updatedAt),
    complaints,
    comments,
    reportCount: complaints.length,
    activeAuthorSuspension,
    riskSignals,
    riskScore: riskSignals.reduce((score, signal) => score + signal.weight, 0),
  };
}

function normalizeModerationComment(row) {
  const user = row.users || {};
  return {
    id: row.id,
    postId: row.post_id || '',
    body: row.body || '',
    status: row.status || 'visible',
    userId: row.user_id || user.id || '',
    userName: displayUserName(user),
    userEmail: user.email || '',
    createdAt: row.created_at || '',
    displayDate: formatDisplayDate(row.created_at),
  };
}

function buildPostRiskSignals({ row, post, complaints, comments, activeAuthorSuspension }) {
  const content = `${row?.title || ''} ${row?.caption || ''} ${(row?.hashtags || []).join(' ')} ${comments.map((comment) => comment.body).join(' ')}`.toLowerCase();
  const signals = [];
  if (complaints.length) signals.push({ key: 'reported', label: 'Reported', detail: `${complaints.length} complaint${complaints.length === 1 ? '' : 's'}`, weight: 4 });
  if (activeAuthorSuspension) signals.push({ key: 'author_suspended', label: 'Author suspended', detail: 'Author has an active suspension', weight: 4 });
  if (/(whatsapp|telegram|wechat|signal|line app|dm me|text me|call me|\+852|\+\d{2,}|[0-9]{4}\s?[0-9]{4})/i.test(content)) {
    signals.push({ key: 'contact', label: 'External contact', detail: 'May contain direct contact details', weight: 2 });
  }
  if (/(payme|fps|bank transfer|outside platform|deposit|wire transfer|crypto|usdt|paypal)/i.test(content)) {
    signals.push({ key: 'payment', label: 'Payment keyword', detail: 'May mention off-platform payment', weight: 3 });
  }
  if (/(scam|fake|fraud|harass|threat|unsafe|abuse|violent|nude|sexual)/i.test(content)) {
    signals.push({ key: 'safety', label: 'Safety keyword', detail: 'May contain unsafe or inappropriate content', weight: 3 });
  }
  if (!post.imageUrl && !post.caption) signals.push({ key: 'empty', label: 'Low content', detail: 'Missing image and caption', weight: 1 });
  return signals;
}

async function updatePostModerationFields(postId, payload, session) {
  const attempts = [
    payload,
    {
      approval_status: payload.approval_status,
      moderation_status: payload.moderation_status,
      moderation_reviewed_by_staff_member_id: payload.moderation_reviewed_by_staff_member_id,
      moderation_reviewed_at: payload.moderation_reviewed_at,
      removed_at: payload.removed_at,
      removal_reason: payload.removal_reason,
      moderation_note: payload.moderation_note,
    },
    {
      approval_status: payload.approval_status,
    },
  ];
  let lastResult = { data: null, error: 'post_moderation_update_failed', tableName: 'posts' };
  for (const attempt of attempts) {
    const filtered = Object.fromEntries(Object.entries(attempt).filter(([, value]) => value !== undefined));
    lastResult = await updateTable('posts', postId, filtered, session);
    if (!lastResult.error) return lastResult;
    if (!String(lastResult.error).includes('column')) break;
  }
  return lastResult;
}

async function updateCommentModerationFields(commentId, payload, session) {
  const attempts = [
    payload,
    {
      status: payload.status,
      deleted_at: payload.deleted_at,
      moderation_reviewed_by_staff_member_id: payload.moderation_reviewed_by_staff_member_id,
      moderation_reviewed_at: payload.moderation_reviewed_at,
      removal_reason: payload.removal_reason,
      moderation_note: payload.moderation_note,
    },
    {
      status: payload.status,
      deleted_at: payload.deleted_at,
    },
  ];
  let lastResult = { data: null, error: 'comment_moderation_update_failed', tableName: 'post_comments' };
  for (const attempt of attempts) {
    const filtered = Object.fromEntries(Object.entries(attempt).filter(([, value]) => value !== undefined));
    lastResult = await updateTable('post_comments', commentId, filtered, session);
    if (!lastResult.error) return lastResult;
    if (!String(lastResult.error).includes('column')) break;
  }
  return lastResult;
}

async function callStaffRemovePostComment({ commentId, reasonCategory = '', staffNote = '', session }) {
  if (!databaseStatus.hasConfig) return { data: null, error: 'missing_config', tableName: 'post_comments' };
  let response;
  try {
    response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/staff_remove_post_comment`, {
      method: 'POST',
      headers: {
        ...buildHeaders(session),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        p_comment_id: commentId,
        p_reason: reasonCategory || null,
        p_note: staffNote || null,
      }),
    });
  } catch (error) {
    return { data: null, error: error.message || String(error), tableName: 'post_comments' };
  }

  if (!response.ok) return { data: null, error: await response.text(), tableName: 'post_comments' };
  const data = await response.json();
  return { data, error: null, tableName: 'post_comments' };
}

function isMissingRpcError(error) {
  const text = String(error || '').toLowerCase();
  return text.includes('staff_remove_post_comment') && (text.includes('could not find') || text.includes('pgrst202') || text.includes('schema cache'));
}

function defaultPostModerationMessage(action, post, reasonCategory) {
  const name = post?.coachName || 'there';
  if (action === 'restore') {
    return `Hi ${name}, GuideNextdoor Customer Service has restored your post "${post.title}". It is visible again on GuideNextdoor.`;
  }
  const reason = reasonCategory ? ` Reason: ${humanizeKey(reasonCategory)}.` : '';
  return `Hi ${name}, GuideNextdoor Customer Service removed your post "${post.title}" after review.${reason} You can reply here if you need clarification.`;
}

function defaultCommentModerationMessage(comment, reasonCategory) {
  const name = comment?.userName || 'there';
  const reason = reasonCategory ? ` Reason: ${humanizeKey(reasonCategory)}.` : '';
  return `Hi ${name}, GuideNextdoor Customer Service removed your comment after review.${reason} You can reply here if you need clarification.`;
}

function getComplaintModerationTarget(complaint) {
  const metadata = complaint.evidenceMetadata || {};
  const type = String(metadata.raw_target_type || complaint.targetType || '').toLowerCase();
  if (type === 'comment') return { type: 'comment', id: metadata.comment_id || complaint.targetId || '' };
  if (type === 'post') return { type: 'post', id: metadata.post_id || complaint.targetId || '' };
  return { type, id: complaint.targetId || '' };
}

async function createInteraction(tableName, postId, session = null) {
  const activeSession = session || getCurrentSession();
  if (!activeSession) return { error: 'auth_required' };

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...buildHeaders(activeSession),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      post_id: postId,
      user_id: activeSession.user.id,
    }),
  });

  if (!response.ok && response.status !== 409) {
    return { error: await response.text() };
  }

  return { error: null, alreadyExists: response.status === 409 };
}

async function deleteInteraction(tableName, postId, session = null) {
  const activeSession = session || getCurrentSession();
  if (!activeSession) return { error: 'auth_required' };

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  url.searchParams.set('post_id', `eq.${postId}`);
  url.searchParams.set('user_id', `eq.${activeSession.user.id}`);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(activeSession),
      Prefer: 'return=minimal',
    },
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  return { error: null };
}

async function deleteTable(tableName, filters, session = null) {
  if (!databaseStatus.hasConfig) {
    return { error: 'missing_config', tableName };
  }

  const activeSession = session || getCurrentSession();
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(activeSession),
      Prefer: 'return=minimal',
    },
  });

  if (!response.ok) {
    return { error: await response.text(), tableName };
  }

  return { error: null, tableName };
}

async function updateTable(tableName, id, payload, session = null) {
  if (!databaseStatus.hasConfig) {
    return { data: null, error: 'missing_config', tableName };
  }

  const activeSession = session || getCurrentSession();
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  url.searchParams.set('id', `eq.${id}`);

  let response;
  try {
    response = await fetchWithTimeout(url.toString(), {
      method: 'PATCH',
      headers: {
        ...buildHeaders(activeSession),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { data: null, error: error.message || String(error), tableName };
  }

  if (!response.ok) {
    return { data: null, error: await response.text(), tableName };
  }

  const data = await response.json();
  return { data: Array.isArray(data) ? data[0] : data, error: null, tableName };
}

async function insertTable(tableName, payload, session = null, prefer = 'return=representation') {
  if (!databaseStatus.hasConfig) {
    return { data: null, error: 'missing_config', tableName };
  }

  const activeSession = session || getCurrentSession();
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  let response;
  try {
    response = await fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: {
        ...buildHeaders(activeSession),
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { data: null, error: error.message || String(error), tableName };
  }

  if (!response.ok) {
    return { data: null, error: await response.text(), tableName };
  }

  if (prefer === 'return=minimal' || response.status === 204) {
    return { data: null, error: null, tableName };
  }

  return { data: await response.json(), error: null, tableName };
}

async function fetchAuthUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return { user: null, error: await response.text() };
  }

  return { user: await response.json(), error: null };
}

function buildHeaders(session = null) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
  };
}

function getAuthStorageKey() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-guidenextdoor-auth-token';
  }
}

function normalizeCoachApplicationPayload(payload) {
  const session = getCurrentSession();
  return {
    applicant_user_id: payload.applicantUserId || session?.user?.id || null,
    email: payload.email,
    legal_name: payload.legalName,
    public_display_name: payload.publicName,
    phone: payload.phone || null,
    languages: payload.languageLabels?.length ? payload.languageLabels : splitList(payload.languages),
    language_ids: payload.languageIds || [],
    bio: payload.bio || null,
    profile_photo_url: payload.profilePhotoUrl || null,
    activity_id: payload.activityId || null,
    qualification_id: payload.qualificationId && !['custom', 'other'].includes(payload.qualificationId) ? payload.qualificationId : null,
    activity_type: payload.activityType,
    credential_name: payload.credentialName || null,
    attainment_year: payload.attainmentYear ? Number(payload.attainmentYear) : null,
    certificate_url: payload.certificateUrl || null,
    proof_notes: payload.proofNotes || null,
    service_title: payload.serviceTitle,
    service_location_ids: payload.locationIds || [],
    manual_location: payload.manualLocation || null,
    service_location: payload.serviceLocation,
    meeting_point: payload.meetingPoint || null,
    service_description: payload.serviceDescription || null,
    min_duration_hours: payload.minDurationHours ? Number(payload.minDurationHours) : null,
    pricing: payload.pricing || [],
    pricing_later: Boolean(payload.pricingLater),
    skill_levels: payload.skillLevels || [],
    duration: payload.duration || null,
    max_group_size: payload.maxGroupSize ? Number(payload.maxGroupSize) : null,
    price_text: payload.price || null,
    currency: payload.currency || 'HKD',
    availability_notes: payload.availability || null,
    consent_review: Boolean(payload.consentReview),
    source: payload.source || 'platform_homepage',
    submitted_at: payload.submitted_at || new Date().toISOString(),
    status: 'new',
  };
}

async function requireStaffPermission(permission) {
  const context = await fetchCurrentStaffContext();
  if (context.error && !context.data?.isStaff) return { error: context.error, tableName: context.tableName };
  if (!hasStaffPermission(context.data, permission)) return { error: 'staff_permission_required', tableName: 'staff_members' };
  return { error: null, data: context.data, tableName: 'staff_members' };
}

async function requireStaffAnyPermission(permissions) {
  const context = await fetchCurrentStaffContext();
  if (context.error && !context.data?.isStaff) return { error: context.error, tableName: context.tableName };
  if (!permissions.some((permission) => hasStaffPermission(context.data, permission))) {
    return { error: 'staff_permission_required', tableName: 'staff_members' };
  }
  return { error: null, data: context.data, tableName: 'staff_members' };
}

async function requireSuperAdminStaff() {
  const context = await fetchCurrentStaffContext();
  if (context.error && !context.data?.isStaff) return { error: context.error, tableName: context.tableName };
  if (!hasStaffRole(context.data, 'super_admin')) return { error: 'super_admin_required', tableName: 'staff_members' };
  return { error: null, data: context.data, tableName: 'staff_members' };
}

async function requireNonStaffAccount(tableName) {
  const context = await fetchCurrentStaffContext();
  if (context.data?.isStaff) return { error: 'staff_account_restricted', tableName };
  return { error: null, tableName };
}

async function requireInteractiveAccount(tableName) {
  const session = await getActiveSession();
  if (!session) return { error: 'auth_required', tableName };
  const staffCheck = await requireNonStaffAccount(tableName);
  if (staffCheck.error) return staffCheck;
  const suspension = await fetchActiveUserSuspension(session.user.id, session);
  if (suspension.data) return { error: 'account_suspended', tableName, suspension: suspension.data };
  return { error: null, tableName };
}

async function fetchActiveUserSuspension(userId, session) {
  if (!userId) return { data: null, error: 'missing_user', tableName: 'user_blocks' };
  const result = await queryTable('user_blocks', {
    select: '*,users!user_blocks_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
    user_id: `eq.${userId}`,
    lifted_at: 'is.null',
    order: 'created_at.desc',
    limit: '20',
  }, session);
  if (result.error) return { data: null, error: result.error, tableName: result.tableName };
  const active = (result.data || []).map(normalizeUserBlock).find(isActiveUserBlock) || null;
  return { ...result, data: active };
}

function isActiveUserBlock(block) {
  if (!block || block.liftedAt) return false;
  if (block.status === 'permanent') return true;
  if (!block.blockedUntil) return true;
  return new Date(block.blockedUntil).getTime() > Date.now();
}

async function touchCurrentStaffLastActive(session) {
  if (!databaseStatus.hasConfig || !session?.access_token) return;
  try {
    await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/touch_current_staff_last_active`, {
      method: 'POST',
      headers: {
        ...buildHeaders(session),
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch {
    // Non-critical. Older databases may not have the RPC until the migration is applied.
  }
}

async function insertStaffAuditLog({ action, targetType = '', targetId = '', metadata = {}, session }) {
  const context = await fetchCurrentStaffContext();
  if (!context.data?.isStaff) return { data: null, error: 'staff_required', tableName: 'staff_audit_logs' };
  return insertTable('staff_audit_logs', {
    staff_member_id: context.data.member?.id || null,
    actor_user_id: session.user.id,
    action,
    target_type: targetType,
    target_id: String(targetId || ''),
    metadata,
  }, session, 'return=minimal');
}

async function createStaffMemberOnServer(payload, session) {
  if (!databaseStatus.hasConfig || !session?.access_token) {
    return { data: null, error: 'missing_config', tableName: 'staff_members' };
  }

  let response;
  try {
    response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/create-staff-member`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { data: null, error: error.message || String(error), tableName: 'staff_members' };
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }

  if (!response.ok) {
    return { data: null, error: body?.error || response.statusText, tableName: 'staff_members' };
  }

  return { data: body?.data || null, error: body?.error || null, tableName: 'staff_members' };
}

async function updateStaffMemberOnServer(payload, session) {
  if (!databaseStatus.hasConfig) {
    return { data: null, error: 'missing_config', tableName: 'staff_members' };
  }

  let response;
  try {
    response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/update-staff-member`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { data: null, error: error.message || String(error), tableName: 'staff_members' };
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }

  if (!response.ok) {
    return { data: null, error: body?.error || response.statusText, tableName: 'staff_members' };
  }

  return { data: body?.data || null, error: body?.error || null, tableName: 'staff_members' };
}

function buildEmptyStaffContext() {
  return {
    isStaff: false,
    source: 'none',
    member: null,
    roles: [],
    permissions: [],
  };
}

function buildFallbackStaffContext(session) {
  const email = String(session?.user?.email || '').toLowerCase();
  const isFallbackStaff = Boolean(
    session?.user?.id && (
      STAFF_USER_IDS.includes(session.user.id)
      || STAFF_EMAILS.includes(email)
      || email.endsWith('@guidenextdoor.com')
    )
  );
  if (!isFallbackStaff) return buildEmptyStaffContext();
  return {
    isStaff: true,
    source: 'env_fallback',
    member: {
      id: '',
      userId: session.user.id,
      email,
      displayName: session.user.user_metadata?.display_name || session.user.user_metadata?.nickname || email,
      department: 'Local testing',
      status: 'active',
    },
    roles: [{ id: 'env-super-admin', key: 'super_admin', name: 'Super admin' }],
    permissions: STAFF_FALLBACK_PERMISSIONS,
  };
}

function normalizeStaffMember(row) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email || '',
    displayName: row.display_name || row.email || '',
    department: row.department || '',
    status: row.status || 'active',
    lastActiveAt: row.last_active_at || '',
    forcePasswordChange: Boolean(row.force_password_change) || row.status === 'pending_first_login',
    passwordChangedAt: row.password_changed_at || '',
  };
}

function normalizeStaffDirectoryMember(row, assignments = []) {
  const roles = assignments.map((assignment) => assignment.staff_roles).filter(Boolean).map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description || '',
  }));
  return {
    ...normalizeStaffMember(row),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    roles,
    roleIds: roles.map((role) => role.id),
    sensitive: roles.some((role) => ['super_admin', 'it_admin'].includes(role.key)),
  };
}

function normalizeStaffRole(row, permissionRows = []) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description || '',
    permissions: permissionRows.map((item) => item.staff_permissions).filter(Boolean).map((permission) => ({
      key: permission.key,
      description: permission.description || '',
    })),
  };
}

function normalizeStaffAuditLog(row, context = {}) {
  const metadata = row.metadata || {};
  const action = row.action || '';
  const actorName = context.staffMember?.display_name || displayUserName(context.actorUser) || 'GuideNextdoor staff';
  const actorEmail = context.staffMember?.email || context.actorUser?.email || '';
  const targetName = buildAuditTargetName(row.target_type || '', row.target_id || '', metadata, context);
  const targetEmail = context.targetStaffMember?.email || context.targetUser?.email || metadata.email || '';
  return {
    id: row.id,
    action,
    actionLabel: buildAuditActionLabel(action),
    summary: buildAuditSummary(action, row.target_type || '', row.target_id || '', metadata, { actorName, targetName }),
    targetLabel: targetName || buildAuditTargetLabel(row.target_type || '', row.target_id || '', metadata),
    targetName,
    targetEmail,
    targetType: row.target_type || '',
    targetId: row.target_id || '',
    metadata,
    createdAt: row.created_at || '',
    actorUserId: row.actor_user_id || '',
    staffMemberId: row.staff_member_id || '',
    actorName,
    actorEmail,
  };
}

function buildAuditActionLabel(action) {
  const labels = {
    'application.approved': 'Coach application approved',
    'application.rejected': 'Coach application rejected',
    'application.needs_info': 'More information requested',
    'application.public_certificate_updated': 'Public certificate updated',
    'service.created': 'Instructor service created',
    'service.approved': 'Service approved',
    'service.rejected': 'Service rejected',
    'post.removed': 'Post removed',
    'post.restored': 'Post restored',
    'post.reviewed': 'Post reviewed',
    'complaint.in_review': 'Complaint moved to review',
    'complaint.needs_more_info': 'Complaint needs more information',
    'complaint.resolved': 'Complaint resolved',
    'complaint.dismissed': 'Complaint dismissed',
    'complaint.sent_to_suspension': 'Complaint sent to suspension',
    'complaint.message_reporter': 'Reporter messaged',
    'complaint.message_reported': 'Reported user messaged',
    'user_risk.reviewed': 'Risk profile marked reviewed',
    'user.suspended_temporarily': 'Account temporarily suspended',
    'user.suspended_permanently': 'Account permanently suspended',
    'user.unblocked': 'Suspension uplifted',
    'staff.created': 'Staff account created',
    'staff.updated': 'Staff account updated',
    'staff.suspended': 'Staff account suspended',
    'staff.offboarded': 'Staff account offboarded',
  };
  return labels[action] || humanizeKey(action);
}

function buildAuditSummary(action, targetType, targetId, metadata, context = {}) {
  const actor = context.actorName || 'A staff member';
  const target = context.targetName || buildAuditTargetLabel(targetType, targetId, metadata);
  if (action === 'staff.created') {
    return `${actor} created staff access for ${target || metadata.email || 'a staff member'}${metadata.department ? ` in ${metadata.department}` : ''}.`;
  }
  if (action === 'staff.updated' || action === 'staff.suspended' || action === 'staff.offboarded') {
    return `${actor} updated staff access${target ? ` for ${target}` : ''}${metadata.status ? ` to ${metadata.status}` : ''}.`;
  }
  if (action === 'user_risk.reviewed') {
    return `${actor} marked ${target || 'a user profile'} as reviewed and removed it from the Suspension review queue until a newer risk signal appears.`;
  }
  if (action.startsWith('user.suspended')) {
    return `${actor} suspended ${target || 'a user profile'}. ${metadata.reasonCategory ? `${humanizeKey(metadata.reasonCategory)}. ` : ''}${metadata.blockedUntil ? `Suspension ends ${formatDisplayDate(metadata.blockedUntil)}.` : 'No automatic end date.'}`;
  }
  if (action === 'user.unblocked') return `${actor} uplifted an active suspension and account access resumed.`;
  if (action.startsWith('post.')) {
    return `${metadata.reason_category ? `${humanizeKey(metadata.reason_category)}. ` : ''}${metadata.moderation_action ? `Action: ${humanizeKey(metadata.moderation_action)}.` : 'Post moderation action recorded.'}`;
  }
  if (action.startsWith('complaint.')) {
    return `${metadata.severity ? `Severity: ${humanizeKey(metadata.severity)}. ` : ''}${metadata.priority ? `Priority: ${humanizeKey(metadata.priority)}.` : 'Complaint workflow updated.'}`;
  }
  if (action.startsWith('application.')) {
    return metadata.staffNote ? `Staff note: ${metadata.staffNote}` : 'Coach application review updated.';
  }
  if (action.startsWith('service.')) {
    return metadata.staffNote ? `Staff note: ${metadata.staffNote}` : 'Service review updated.';
  }
  return targetType ? `Updated ${humanizeKey(targetType)}${targetId ? ` ${shortId(targetId)}` : ''}.` : 'Staff action recorded.';
}

function buildAuditTargetName(targetType, targetId, metadata, context = {}) {
  if (targetType === 'staff_member' && context.targetStaffMember) {
    return context.targetStaffMember.display_name || context.targetStaffMember.email || '';
  }
  if (targetType === 'user' && context.targetUser) {
    return displayUserName(context.targetUser);
  }
  if (metadata.email) return metadata.email;
  if (metadata.displayName) return metadata.displayName;
  return buildAuditTargetLabel(targetType, targetId, metadata);
}

function buildAuditTargetLabel(targetType, targetId, metadata) {
  if (metadata.email) return metadata.email;
  if (metadata.displayName) return metadata.displayName;
  if (metadata.reasonCategory) return humanizeKey(metadata.reasonCategory);
  if (metadata.reason_category) return humanizeKey(metadata.reason_category);
  if (!targetType) return 'GuideNextdoor';
  if (targetType === 'staff_member') return 'Staff member';
  if (targetType === 'user') return 'User profile';
  if (targetType === 'user_block') return 'Suspension record';
  if (targetType === 'coach_application') return 'Coach application';
  if (targetType === 'instructor_service') return 'Instructor service';
  return `${humanizeKey(targetType)}${targetId ? ` ${shortId(targetId)}` : ''}`;
}

function shortId(value) {
  const text = String(value || '');
  if (text.length <= 12) return text;
  return `${text.slice(0, 8)}...`;
}

function normalizeUserBlock(row) {
  const user = row.users || {};
  const block = {
    id: row.id,
    userId: row.user_id,
    userName: displayUserName(user),
    userEmail: user.email || '',
    avatarUrl: user.avatar_url || '',
    status: row.status || 'temporary',
    scope: row.scope || 'full_account_read_only',
    reasonCategory: row.reason_category || '',
    reason: row.reason || '',
    internalNote: row.internal_note || '',
    userMessage: row.user_message || '',
    blockedUntil: row.blocked_until || '',
    liftedAt: row.lifted_at || '',
    supportConversationId: row.support_conversation_id || '',
    systemMessageId: row.system_message_id || '',
    createdAt: row.created_at || '',
  };
  return {
    ...block,
    active: isActiveUserBlock(block),
    expired: Boolean(block.status === 'temporary' && block.blockedUntil && new Date(block.blockedUntil).getTime() <= Date.now() && !block.liftedAt),
  };
}

function normalizeComplaint(row) {
  const reporter = row.reporter || {};
  const reported = row.reported || {};
  const assignedStaff = row.assignedStaff || {};
  const reasonCategory = row.reason_category || 'other';
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id || '',
    reporterName: displayUserName(reporter),
    reporterNickname: reporter.nickname || reporter.display_name || reporter.username || '',
    reporterEmail: reporter.email || '',
    reportedUserId: row.reported_user_id || '',
    reportedName: displayUserName(reported),
    reportedNickname: reported.nickname || reported.display_name || reported.username || '',
    reportedEmail: reported.email || '',
    reportedAvatarUrl: reported.avatar_url || '',
    targetType: row.target_type || 'other',
    targetId: row.target_id || '',
    reasonCategory,
    reasonLabel: humanizeKey(reasonCategory),
    description: row.description || '',
    evidenceUrl: row.evidence_url || '',
    evidenceMetadata: row.evidence_metadata || {},
    status: row.status || 'new',
    severity: row.severity || 'unassigned',
    priority: row.priority || 'normal',
    assignedTeam: row.assigned_team || '',
    assignedStaffMemberId: row.assigned_staff_member_id || '',
    assignedStaffName: assignedStaff.display_name || assignedStaff.email || '',
    assignedStaffEmail: assignedStaff.email || '',
    assignedStaffDepartment: assignedStaff.department || '',
    slaDueAt: row.sla_due_at || '',
    staffNote: row.staff_note || '',
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    displayDate: formatDisplayDate(row.created_at),
  };
}

function mapComplaintReasonToSuspensionReason(reason) {
  const value = String(reason || '').toLowerCase();
  if (value.includes('credential') || value.includes('identity')) return 'identity_or_credential_review';
  if (value.includes('booking') || value.includes('payment')) return 'payment_or_booking_dispute';
  if (value.includes('spam') || value.includes('scam')) return 'spam_or_abuse';
  if (value.includes('unsafe') || value.includes('harassment')) return 'safety_review';
  return 'policy_violation';
}

function normalizeComplaintTargetType(value) {
  const allowed = new Set(['post', 'comment', 'profile', 'service', 'message', 'booking', 'user', 'other']);
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.has(normalized) ? normalized : 'other';
}

async function enrichSuspensionAccounts(accounts, session) {
  const ids = [...new Set((accounts || []).map((account) => account.id).filter(Boolean))];
  if (!ids.length) return [];

  const [staffResult, instructorResult, blockResult, commentsResult, learnerBookingsResult] = await Promise.all([
    queryTable('staff_members', {
      select: 'id,user_id,email,display_name,status',
      user_id: `in.(${ids.join(',')})`,
      limit: '200',
    }, session),
    queryTable('instructor_profiles', {
      select: 'id,user_id',
      user_id: `in.(${ids.join(',')})`,
      limit: '200',
    }, session),
    queryTable('user_blocks', {
      select: '*,users!user_blocks_user_id_fkey(id,email,display_name,nickname,username,avatar_url)',
      user_id: `in.(${ids.join(',')})`,
      order: 'created_at.desc',
      limit: '500',
    }, session),
    queryTable('post_comments', {
      select: 'id,user_id,status,created_at',
      user_id: `in.(${ids.join(',')})`,
      limit: '1000',
    }, session),
    queryTable('bookings', {
      select: 'id,learner_id,status,created_at',
      learner_id: `in.(${ids.join(',')})`,
      limit: '1000',
    }, session),
  ]);

  const staffByUser = new Map((staffResult.data || []).map((row) => [row.user_id, row]));
  const instructorByUser = new Map((instructorResult.data || []).map((row) => [row.user_id, row]));
  const blocksByUser = groupBy((blockResult.data || []).map(normalizeUserBlock), (block) => block.userId);
  const commentsByUser = groupBy(commentsResult.data || [], (row) => row.user_id);
  const bookingsByUser = groupBy(learnerBookingsResult.data || [], (row) => row.learner_id);

  let serviceCountsByInstructor = new Map();
  let postCountsByInstructor = new Map();
  let instructorBookingCountsByUser = new Map();
  const instructorIds = [...instructorByUser.values()].map((profile) => profile.id).filter(Boolean);
  if (instructorIds.length) {
    const [servicesResult, postsResult] = await Promise.all([
      queryTable('instructor_services', {
        select: 'id,instructor_id,is_active,service_approval_status',
        instructor_id: `in.(${instructorIds.join(',')})`,
        limit: '1000',
      }, session),
      queryTable('posts', {
        select: 'id,instructor_id,approval_status,created_at',
        instructor_id: `in.(${instructorIds.join(',')})`,
        limit: '1000',
      }, session),
    ]);
    serviceCountsByInstructor = groupCount(servicesResult.data || [], (row) => row.instructor_id);
    postCountsByInstructor = groupCount(postsResult.data || [], (row) => row.instructor_id);
    const serviceIds = (servicesResult.data || []).map((row) => row.id).filter(Boolean);
    if (serviceIds.length) {
      const instructorBookingsResult = await queryTable('bookings', {
        select: 'id,service_id,status,created_at',
        service_id: `in.(${serviceIds.join(',')})`,
        limit: '1000',
      }, session);
      const serviceToUser = new Map((servicesResult.data || []).map((row) => [row.id, findInstructorUserByProfileId(instructorByUser, row.instructor_id)]));
      instructorBookingCountsByUser = groupCount(instructorBookingsResult.data || [], (row) => serviceToUser.get(row.service_id));
    }
  }

  return accounts.map((account) => {
    const staff = staffByUser.get(account.id);
    const instructor = instructorByUser.get(account.id);
    const blocks = blocksByUser.get(account.id) || [];
    const activeBlock = blocks.find((block) => block.active) || null;
    const comments = commentsByUser.get(account.id) || [];
    const learnerBookings = bookingsByUser.get(account.id) || [];
    const instructorBookingCount = instructorBookingCountsByUser.get(account.id) || 0;
    const signals = account.signals || [];
    return {
      ...account,
      accountType: staff ? 'staff' : instructor ? 'instructor' : 'learner',
      isStaff: Boolean(staff),
      staffStatus: staff?.status || '',
      instructorId: instructor?.id || '',
      serviceCount: instructor ? serviceCountsByInstructor.get(instructor.id) || 0 : 0,
      postCount: instructor ? postCountsByInstructor.get(instructor.id) || 0 : 0,
      commentCount: comments.length,
      learnerBookingCount: learnerBookings.length,
      instructorBookingCount,
      bookingCount: learnerBookings.length + instructorBookingCount,
      activeSuspension: activeBlock,
      previousSuspensionCount: blocks.filter((block) => !block.active).length,
      signalCount: signals.length,
      lastSignalAt: signals.map((signal) => signal.createdAt).filter(Boolean).sort().at(-1) || account.createdAt || '',
    };
  });
}

function normalizeSuspensionAccount(row) {
  return {
    id: row?.id || '',
    email: row?.email || '',
    displayName: displayUserName(row || {}),
    username: row?.username || '',
    nickname: row?.nickname || '',
    avatarUrl: row?.avatar_url || '',
    createdAt: row?.created_at || '',
  };
}

function groupCount(rows, keyFn) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function findInstructorUserByProfileId(instructorByUser, instructorId) {
  return [...instructorByUser.entries()].find(([, profile]) => profile.id === instructorId)?.[0] || '';
}

function escapePostgrestPattern(value) {
  return String(value || '').replace(/[%*_]/g, '').replace(/[(),]/g, ' ');
}

function normalizeStaffServiceRequest(row) {
  const service = normalizeInstructorService(row);
  const profile = row.instructor_profiles || {};
  const user = profile.users || {};
  return {
    ...service,
    requestType: 'service',
    instructorId: row.instructor_id || profile.id || '',
    instructorUserId: profile.user_id || user.id || '',
    coachName: displayUserName(user),
    coachEmail: user.email || '',
    coachAvatarUrl: user.avatar_url || '',
    status: row.service_approval_status || 'Pending',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeStaffCredentialRequest(row) {
  const credential = normalizeInstructorCredential(row);
  const profile = row.instructor_profiles || {};
  const user = profile.users || {};
  return {
    ...credential,
    requestType: 'credential',
    title: credential.title,
    qualification: credential.qualification,
    instructorId: row.instructor_id || profile.id || '',
    instructorUserId: profile.user_id || user.id || '',
    coachName: displayUserName(user),
    coachEmail: user.email || '',
    coachAvatarUrl: user.avatar_url || '',
    rawCertUrl: row.raw_certificate_url || '',
    maskedCertUrl: row.masked_certificate_url || '',
    description: row.staff_note || '',
    locations: [],
    pricing: [],
    activityImageUrls: [],
    minDurationHours: null,
    minPrice: null,
    currency: '',
    status: row.approval_status || 'Pending',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeCoachApplication(row) {
  return {
    raw: row,
    id: row.id,
    applicantUserId: row.applicant_user_id || row.user_id || '',
    email: row.email || '',
    legalName: row.legal_name || row.legalName || '',
    publicName: row.public_display_name || row.publicName || '',
    phone: row.phone || '',
    languages: row.languages || [],
    languageIds: row.language_ids || [],
    bio: row.bio || '',
    profilePhotoUrl: row.profile_photo_url || '',
    activityId: row.activity_id || '',
    qualificationId: row.qualification_id || '',
    activityType: row.activity_type || '',
    credentialName: row.credential_name || '',
    attainmentYear: row.attainment_year || '',
    certificateUrl: row.certificate_url || '',
    publicCertificateUrl: row.public_certificate_url || row.masked_certificate_url || '',
    proofNotes: row.proof_notes || '',
    serviceTitle: row.service_title || '',
    serviceLocationIds: row.service_location_ids || [],
    manualLocation: row.manual_location || '',
    serviceLocation: row.service_location || '',
    meetingPoint: row.meeting_point || '',
    serviceDescription: row.service_description || '',
    minDurationHours: row.min_duration_hours || 1,
    pricing: row.pricing || [],
    pricingLater: Boolean(row.pricing_later),
    currency: row.currency || 'HKD',
    availabilityNotes: row.availability_notes || '',
    source: row.source || '',
    status: normalizeApplicationStatus(row.status),
    reviewNotes: row.review_notes || row.staff_notes || '',
    reviewedAt: row.reviewed_at || '',
    submittedAt: row.submitted_at || row.created_at || '',
    instructorProfileId: row.instructor_profile_id || '',
    instructorServiceId: row.instructor_service_id || '',
  };
}

function normalizeApplicationStatus(value) {
  const status = String(value || 'new').trim().toLowerCase();
  if (status === 'in_review' || status === 'in review') return 'in_review';
  if (status === 'needs_info' || status === 'needs info' || status === 'further_information_required') return 'needs_info';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'new';
}

async function updateApplicationReviewFields(applicationId, payload, session) {
  const attempts = [
    payload,
    {
      status: payload.status,
      review_notes: payload.review_notes,
      reviewed_by: payload.reviewed_by,
      reviewed_at: payload.reviewed_at,
    },
    {
      status: payload.status,
      staff_notes: payload.review_notes,
    },
    {
      status: payload.status,
    },
  ];

  let lastResult = { data: null, error: 'application_update_failed', tableName: 'coach_applications' };
  for (const attempt of attempts) {
    const filtered = Object.fromEntries(Object.entries(attempt).filter(([, value]) => value !== undefined));
    lastResult = await updateTable('coach_applications', applicationId, filtered, session);
    if (!lastResult.error) return lastResult;
    if (!String(lastResult.error).includes('column')) break;
  }
  return lastResult;
}

async function resolveApplicationUser(application, session) {
  if (application.applicantUserId) {
    const byId = await queryTable('users', {
      select: 'id,display_name,nickname,avatar_url,username,email',
      id: `eq.${application.applicantUserId}`,
      limit: '1',
    }, session);
    if (!byId.error && byId.data?.[0]) return { ...byId, data: byId.data[0] };
  }

  if (!application.email) return { data: null, error: 'missing_applicant_email', tableName: 'users' };
  const byEmail = await queryTable('users', {
    select: 'id,display_name,nickname,avatar_url,username,email',
    email: `eq.${application.email}`,
    limit: '1',
  }, session);
  return { ...byEmail, data: byEmail.data?.[0] || null };
}

async function ensureInstructorProfileForApplication(application, userId, session) {
  const existingResult = await queryTable('instructor_profiles', {
    select: '*',
    user_id: `eq.${userId}`,
    limit: '1',
  }, session);
  if (existingResult.error) return { data: null, error: existingResult.error, tableName: 'instructor_profiles' };

  await updateTable('users', userId, {
    nickname: application.publicName || application.legalName || null,
    avatar_url: application.profilePhotoUrl || null,
  }, session);

  if (existingResult.data?.[0]?.id) {
    const updateResult = await updateTable('instructor_profiles', existingResult.data[0].id, {
      bio_description: application.bio || null,
      cover_photo_url: application.profilePhotoUrl || null,
      id_verification_status: 'Verified',
      is_on_break: false,
    }, session);
    return updateResult.error ? { data: existingResult.data[0], error: null, tableName: 'instructor_profiles' } : updateResult;
  }

  const insertPayload = {
    user_id: userId,
    bio_description: application.bio || null,
    cover_photo_url: application.profilePhotoUrl || null,
    id_verification_status: 'Verified',
    is_on_break: false,
  };
  const result = await insertTable('instructor_profiles', insertPayload, session);
  return { ...result, data: Array.isArray(result.data) ? result.data[0] : result.data };
}

async function createStaffServiceForInstructor({ instructorId, application = null, serviceOverride = {}, session }) {
  if (!instructorId) return { data: null, error: 'missing_instructor', tableName: 'instructor_services' };

  let qualificationId = serviceOverride.qualificationId || application?.qualificationId || null;
  if ((qualificationId === 'custom' || qualificationId === 'other' || !qualificationId) && (serviceOverride.customQualification || application?.credentialName)) {
    const qualResult = await insertTable('ref_qualifications', {
      activity_id: serviceOverride.activityId || application?.activityId || null,
      qualification_name: serviceOverride.customQualification || application?.credentialName,
      is_verified: false,
    }, session);
    if (!qualResult.error && qualResult.data) {
      const qualification = Array.isArray(qualResult.data) ? qualResult.data[0] : qualResult.data;
      qualificationId = qualification.id;
    }
  }

  const servicePayload = {
    instructor_id: instructorId,
    activity_id: serviceOverride.activityId || application?.activityId || null,
    qualification_id: qualificationId && !['custom', 'other'].includes(qualificationId) ? qualificationId : null,
    attainment_year: Number(serviceOverride.attainmentYear || application?.attainmentYear) || null,
    service_description: serviceOverride.description || application?.serviceDescription || application?.serviceTitle || null,
    min_duration_hours: Number(serviceOverride.minDurationHours || application?.minDurationHours) || 1,
    raw_cert_url: serviceOverride.rawCertUrl || application?.certificateUrl || null,
    masked_cert_url: serviceOverride.maskedCertUrl || application?.publicCertificateUrl || null,
    is_active: true,
    service_approval_status: 'approved',
  };

  const serviceResult = await insertTable('instructor_services', servicePayload, session);
  if (serviceResult.error) return serviceResult;

  const service = Array.isArray(serviceResult.data) ? serviceResult.data[0] : serviceResult.data;
  const pricingRows = normalizeStaffPricing(serviceOverride.pricing || application?.pricing, application?.currency);
  if (pricingRows.length) {
    await insertTable('instructor_pricing', pricingRows.map((pricing) => ({
      service_id: service.id,
      skill_level: pricing.skillLevel,
      currency: pricing.currency,
      price_1_pax: pricing.price1,
      extra_person_fee: pricing.extraPersonFee,
    })), session, 'return=minimal');
  }

  const locationIds = serviceOverride.locationIds || application?.serviceLocationIds || [];
  if (locationIds.length) {
    await insertServiceLocationAreas(service.id, locationIds, session);
  }

  return { data: service, error: null, tableName: 'instructor_services' };
}

function normalizeStaffPricing(pricing, fallbackCurrency = 'HKD') {
  if (!Array.isArray(pricing)) return [];
  return pricing
    .filter((tier) => tier && tier.price1 !== '' && tier.price1 !== null && tier.price1 !== undefined)
    .map((tier) => ({
      skillLevel: tier.skillLevel || 'All Levels',
      currency: tier.currency || fallbackCurrency || 'HKD',
      price1: Number(tier.price1) || null,
      extraPersonFee: Number(tier.extraPersonFee) || 0,
    }))
    .filter((tier) => tier.price1 !== null);
}

async function sendStaffApplicationMessage({ application, status, body, session }) {
  const applicantResult = await resolveApplicationUser(application, session);
  if (applicantResult.error || !applicantResult.data?.id) {
    return { data: null, error: applicantResult.error || 'applicant_user_not_found', tableName: 'users' };
  }

  const staffUserId = CENTRAL_STAFF_USER_ID || session.user.id;
  const conversationResult = await ensureConversationBetweenUsers(staffUserId, applicantResult.data.id, session);
  if (conversationResult.error || !conversationResult.data?.id) return conversationResult;
  const recipientName = displayUserName(applicantResult.data);

  const basePayload = {
    conversation_id: conversationResult.data.id,
    text_content: normalizePublicSupportBody(body, true, recipientName),
    message_type: 'coach_application_update',
    metadata: {
      application_id: application.id,
      application_status: status,
      actual_staff_user_id: session.user.id,
      centralized_staff_user_id: staffUserId,
      public_sender_name: PUBLIC_SUPPORT_NAME,
      system_generated: true,
    },
  };

  const attempts = [
    { ...basePayload, sender_id: staffUserId },
    { ...basePayload, sender_id: session.user.id },
  ];
  let result = { data: null, error: 'message_insert_failed', tableName: 'messages' };
  for (const attempt of attempts) {
    result = await insertTable('messages', attempt, session);
    if (!result.error) {
      await updateTable('conversations', conversationResult.data.id, { last_message_at: new Date().toISOString() }, session);
      return result;
    }
  }
  return result;
}

async function sendStaffServiceReviewMessage({ service, status, body, session }) {
  if (!service?.instructorUserId) return { data: null, error: 'instructor_user_not_found', tableName: 'instructor_services' };
  return sendCentralSupportMessage({
    recipientUserId: service.instructorUserId,
    body,
    messageType: 'service_review_update',
    metadata: {
      service_id: service.id,
      service_status: status,
      service_title: service.title,
      system_generated: true,
    },
    session,
  });
}

async function sendStaffCredentialReviewMessage({ credential, status, body, session }) {
  if (!credential?.instructorUserId) return { data: null, error: 'instructor_user_not_found', tableName: 'instructor_credentials' };
  return sendCentralSupportMessage({
    recipientUserId: credential.instructorUserId,
    body,
    messageType: 'credential_review_update',
    metadata: {
      credential_id: credential.id,
      credential_status: status,
      credential_title: credential.qualification,
      activity_title: credential.title,
      system_generated: true,
    },
    session,
  });
}

function defaultServiceDecisionMessage(status, service) {
  const title = service?.title || 'your service request';
  if (status === 'Rejected') {
    return `Hi ${service?.coachName || 'there'}, GuideNextdoor reviewed ${title} and could not approve it yet. Please review the staff notes and submit an updated service when ready.`;
  }
  if (status === 'Needs info') {
    return `Hi ${service?.coachName || 'there'}, GuideNextdoor needs more information before reviewing ${title}. Please reply here with the requested details.`;
  }
  return `Hi ${service?.coachName || 'there'}, GuideNextdoor reviewed ${title}.`;
}

function defaultCredentialDecisionMessage(status, credential) {
  const title = credential?.qualification || 'your credential';
  if (status === 'Rejected') {
    return `Hi ${credential?.coachName || 'there'}, GuideNextdoor reviewed ${title} and could not approve it yet. Please review the staff notes and submit an updated credential when ready.`;
  }
  if (status === 'Needs info') {
    return `Hi ${credential?.coachName || 'there'}, GuideNextdoor needs more information before reviewing ${title}. Please reply here with the requested details.`;
  }
  return `Hi ${credential?.coachName || 'there'}, GuideNextdoor reviewed ${title}.`;
}

async function sendCentralSupportMessage({ recipientUserId, body, messageType, metadata = {}, session }) {
  const staffUserId = CENTRAL_STAFF_USER_ID || session.user.id;
  const conversationResult = await ensureConversationBetweenUsers(staffUserId, recipientUserId, session);
  if (conversationResult.error || !conversationResult.data?.id) return conversationResult;
  const recipientName = await fetchUserDisplayNameById(recipientUserId, session);

  const basePayload = {
    conversation_id: conversationResult.data.id,
    text_content: normalizePublicSupportBody(body, true, recipientName),
    message_type: messageType || 'staff_support_message',
    metadata: {
      ...metadata,
      actual_staff_user_id: session.user.id,
      centralized_staff_user_id: staffUserId,
      public_sender_name: PUBLIC_SUPPORT_NAME,
    },
  };
  const attempts = [
    { ...basePayload, sender_id: staffUserId },
    { ...basePayload, sender_id: session.user.id },
  ];
  let result = { data: null, error: 'message_insert_failed', tableName: 'messages' };
  for (const attempt of attempts) {
    result = await insertTable('messages', attempt, session);
    if (!result.error) {
      await updateTable('conversations', conversationResult.data.id, { last_message_at: new Date().toISOString() }, session);
      return result;
    }
  }
  return result;
}

async function ensureConversationBetweenUsers(userIdOne, userIdTwo, session) {
  if (!userIdOne || !userIdTwo) return { data: null, error: 'missing_participant', tableName: 'conversations' };
  if (userIdOne === userIdTwo) return { data: null, error: 'invalid_participants', tableName: 'conversations' };

  const [participantOneId, participantTwoId] = orderedPairIds(userIdOne, userIdTwo);
  const existing = await queryTable('conversations', {
    select: '*',
    participant_one_id: `eq.${participantOneId}`,
    participant_two_id: `eq.${participantTwoId}`,
    merged_into_conversation_id: 'is.null',
    limit: '1',
  }, session);
  if (!existing.error && existing.data?.[0]?.id) return { ...existing, data: existing.data[0] };

  const conversationId = crypto.randomUUID();
  const conversationPayload = {
    id: conversationId,
    participant_one_id: participantOneId,
    participant_two_id: participantTwoId,
    last_message_at: new Date().toISOString(),
  };
  let conversationResult = await insertTable('conversations', conversationPayload, session);
  if (conversationResult.error && String(conversationResult.error).includes('participant_')) {
    conversationResult = await insertTable('conversations', {
      id: conversationId,
      last_message_at: conversationPayload.last_message_at,
    }, session);
  }
  if (conversationResult.error) return conversationResult;

  await insertTable('conversation_participants', { conversation_id: conversationId, user_id: userIdOne }, session, 'return=minimal');
  await insertTable('conversation_participants', { conversation_id: conversationId, user_id: userIdTwo }, session, 'return=minimal');

  return { data: { id: conversationId }, error: null, tableName: 'conversations' };
}

function defaultApplicationDecisionMessage(status, application) {
  const name = application.publicName || application.legalName || 'there';
  if (status === 'approved') {
    return `Hi ${name}, your GuideNextdoor coach application has been approved. Your coach profile and first service are being prepared for public listing.`;
  }
  if (status === 'rejected') {
    return `Hi ${name}, we reviewed your GuideNextdoor coach application and cannot approve it at this stage. You can reply here if you would like our team to clarify the decision.`;
  }
  if (status === 'needs_info') {
    return `Hi ${name}, we need a bit more information before we can continue reviewing your GuideNextdoor coach application. Please reply in this chat with the requested details.`;
  }
  return `Hi ${name}, your GuideNextdoor coach application is now under review.`;
}

function splitList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEnvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLocation(row) {
  const metadata = row.metadata || {};
  const district = row.district || row.city || row.name || metadata.district || metadata.name || '';
  const region = row.region || row.city_or_region || metadata.region || '';
  const country = row.country || metadata.country || '';
  const displayName = row.display_name
    || [district, region, country].filter(Boolean).join(', ')
    || row.formatted_address
    || row.name
    || metadata.name
    || 'New location';
  return {
    id: row.id || row.slug || row.name,
    name: displayName,
    displayName,
    district,
    region,
    country,
    countryCode: row.country_code || metadata.country_code || '',
    slug: row.slug || metadata.slug || '',
    latitude: row.latitude !== undefined && row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== undefined && row.longitude !== null ? Number(row.longitude) : null,
    timezone: row.timezone || metadata.timezone || '',
    coachCount: row.coach_count || metadata.coach_count || 0,
    serviceCount: row.service_count || metadata.service_count || 0,
  };
}

function formatPostDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatLessonDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}-${month}-${year}` : formatPostDate(value);
}

function formatDisplayDate(value) {
  return formatPostDate(value);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateInput(value, offset) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function addHoursToTime(value, hours) {
  const [rawHour, rawMinute] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return '';

  const totalMinutes = rawHour * 60 + rawMinute + (Number(hours) || 0) * 60;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getEffectiveAvailabilityForDate(availability, overrides, date) {
  const day = new Date(`${date}T00:00:00`).getDay();
  const recurring = (availability || [])
    .filter((window) => Number(window.dayOfWeek) === day)
    .map((window) => ({ ...window, source: 'recurring' }));
  const dateOverrides = (overrides || []).filter((override) => override.date === date);
  const extraOpen = dateOverrides
    .filter((override) => override.isAvailable)
    .map((override) => ({ ...override, source: 'override' }));
  const unavailable = dateOverrides.filter((override) => !override.isAvailable);

  return subtractUnavailableWindows([...recurring, ...extraOpen], unavailable)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

function subtractUnavailableWindows(windows, unavailableWindows) {
  let result = (windows || []).filter((window) => window.startTime && window.endTime && window.startTime < window.endTime);

  (unavailableWindows || []).forEach((block) => {
    result = result.flatMap((window) => subtractWindow(window, block));
  });

  return result;
}

function subtractWindow(window, block) {
  if (!timeRangesOverlap(window.startTime, window.endTime, block.startTime, block.endTime)) return [window];

  const segments = [];
  if (window.startTime < block.startTime) {
    segments.push({ ...window, id: `${window.id || 'window'}-before-${block.id || block.startTime}`, endTime: block.startTime });
  }
  if (block.endTime < window.endTime) {
    segments.push({ ...window, id: `${window.id || 'window'}-after-${block.id || block.endTime}`, startTime: block.endTime });
  }
  return segments.filter((segment) => segment.startTime < segment.endTime);
}

function timeRangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function formatWeekday(value) {
  const day = Number(value);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels[Number.isInteger(day) && day >= 0 && day < labels.length ? day : 0];
}


export async function fetchRefActivities() {
  return queryTable("ref_activities", {
    select: "*",
    is_active: "eq.true",
    order: "translation_key.asc",
  });
}

export async function fetchRefQualifications() {
  return queryTable('ref_qualifications', {
    select: 'id,activity_id,qualification_name',
    order: 'qualification_name.asc',
  });
}

export async function deleteInstructorService(serviceId) {
  const session = getCurrentSession();
  if (!session) return { error: "auth_required" };
  const accountCheck = await requireInteractiveAccount('instructor_services');
  if (accountCheck.error) return accountCheck;

  return updateTable("instructor_services", serviceId, { is_active: false }, session);
}

export async function createInstructorCredential(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_credentials' };
  const accountCheck = await requireInteractiveAccount('instructor_credentials');
  if (accountCheck.error) return { data: null, ...accountCheck };

  let finalQualId = payload.qualificationId === 'custom' ? null : (payload.qualificationId || null);
  let customQualification = String(payload.customQualification || '').trim();

  if (payload.qualificationId === 'custom' && customQualification) {
    const qualResult = await insertTable('ref_qualifications', {
      activity_id: payload.activityId,
      qualification_name: customQualification,
      is_verified: false,
    }, session);
    if (!qualResult.error && qualResult.data) {
      const qualification = Array.isArray(qualResult.data) ? qualResult.data[0] : qualResult.data;
      finalQualId = qualification.id;
    }
  }

  let certUrl = '';
  if (payload.certFile) {
    const uploadResult = await uploadFile('posts', payload.certFile, `credential-certificates/${Date.now()}-${Math.random().toString(36).slice(2)}-${payload.certFile.name || 'certificate.jpg'}`);
    if (uploadResult.error) return { data: null, error: uploadResult.error, tableName: 'storage.objects' };
    certUrl = uploadResult.data;
  }

  return insertTable('instructor_credentials', {
    instructor_id: payload.instructorId,
    activity_id: payload.activityId || null,
    qualification_id: finalQualId,
    custom_qualification_name: finalQualId ? null : customQualification,
    attainment_year: Number(payload.attainmentYear) || null,
    raw_certificate_url: certUrl || null,
    approval_status: 'Pending',
  }, session);
}

export async function createInstructorService(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: "auth_required" };
  const accountCheck = await requireInteractiveAccount('instructor_services');
  if (accountCheck.error) return { data: null, ...accountCheck };

  let finalQualId = payload.qualificationId === 'custom' ? null : (payload.qualificationId || null);
  let certUrl = null;
  const activityImageUploadResult = await uploadServiceActivityImages(payload.activityImageFiles || []);
  if (activityImageUploadResult.error) return { data: null, error: activityImageUploadResult.error, tableName: 'storage.objects' };
  const activityImageUrls = activityImageUploadResult.data;

  // 1. Handle Custom Qualification & Upload
  if (payload.qualificationId === 'custom' && payload.customQualification) {
    const qualResult = await insertTable("ref_qualifications", {
      activity_id: payload.activityId,
      qualification_name: payload.customQualification,
      is_verified: false,
    }, session);

    if (!qualResult.error && qualResult.data) {
      finalQualId = Array.isArray(qualResult.data) ? qualResult.data[0].id : qualResult.data.id;
    }
  }

  // Handle Certificate Upload
  if (payload.certFile) {
    const uploadResult = await uploadFile('posts', payload.certFile, `service-certificates/${Date.now()}-${Math.random().toString(36).slice(2)}-${payload.certFile.name || 'certificate.jpg'}`);
    if (uploadResult.error) return { data: null, error: uploadResult.error, tableName: 'storage.objects' };
    if (!uploadResult.error) {
      certUrl = uploadResult.data;
    }
  }

  // 2. Insert service
  const serviceResult = await insertTable("instructor_services", {
    instructor_id: payload.instructorId,
    activity_id: payload.activityId,
    qualification_id: finalQualId,
    attainment_year: Number(payload.attainmentYear) || null,
    service_description: payload.description,
    min_duration_hours: Number(payload.minDurationHours) || 1,
    raw_cert_url: certUrl,
    activity_image_urls: activityImageUrls,
    is_active: false,
    service_approval_status: "Pending",
  }, session);

  if (serviceResult.error) return serviceResult;
  const service = Array.isArray(serviceResult.data) ? serviceResult.data[0] : serviceResult.data;

  // 3. Insert pricing
  if (payload.pricing && payload.pricing.length > 0) {
    const pricingPayloads = payload.pricing.map(p => ({
      service_id: service.id,
      skill_level: p.skillLevel,
      currency: p.currency || "USD",
      price_1_pax: Number(p.price1) || null,
      extra_person_fee: Number(p.extraPersonFee) || 0,
    }));
    const pricingResult = await insertTable("instructor_pricing", pricingPayloads, session, "return=minimal");
    if (pricingResult.error) return { data: service, error: pricingResult.error, tableName: 'instructor_pricing' };
  }

  // 4. Insert locations
  if (payload.locationIds && payload.locationIds.length > 0) {
    const locationResult = await insertServiceLocationAreas(service.id, payload.locationIds, session);
    if (locationResult.error) return { data: service, error: locationResult.error, tableName: locationResult.tableName || 'service_location_areas' };
  }

  return { data: service, error: null };
}

export async function updateInstructorService(serviceId, payload) {
  const session = getCurrentSession();
  if (!session) return { error: "auth_required" };
  const accountCheck = await requireInteractiveAccount('instructor_services');
  if (accountCheck.error) return accountCheck;

  const updatePayload = {};
  if (payload.activityId !== undefined) updatePayload.activity_id = payload.activityId;
  if (payload.qualificationId !== undefined && payload.qualificationId !== 'custom') updatePayload.qualification_id = payload.qualificationId || null;
  if (payload.attainmentYear !== undefined) updatePayload.attainment_year = Number(payload.attainmentYear) || null;
  if (payload.description !== undefined) updatePayload.service_description = payload.description;
  if (payload.minDurationHours !== undefined) updatePayload.min_duration_hours = Number(payload.minDurationHours);
  updatePayload.service_approval_status = 'Pending';
  updatePayload.is_active = false;

  // Handle Certificate Upload on Edit
  if (payload.certFile) {
    const uploadResult = await uploadFile('posts', payload.certFile, `service-certificates/${Date.now()}-${Math.random().toString(36).slice(2)}-${payload.certFile.name || 'certificate.jpg'}`);
    if (uploadResult.error) return { error: uploadResult.error, tableName: 'storage.objects' };
    if (!uploadResult.error) {
      updatePayload.raw_cert_url = uploadResult.data;
    }
  }

  const existingActivityImageUrls = Array.isArray(payload.existingActivityImageUrls) ? payload.existingActivityImageUrls.filter(Boolean) : [];
  const activityImageUploadResult = await uploadServiceActivityImages(payload.activityImageFiles || []);
  if (activityImageUploadResult.error) return { error: activityImageUploadResult.error, tableName: 'storage.objects' };
  const nextActivityImageUrls = [
    ...existingActivityImageUrls,
    ...activityImageUploadResult.data,
  ];
  if (payload.activityImageFiles !== undefined || payload.existingActivityImageUrls !== undefined) {
    updatePayload.activity_image_urls = nextActivityImageUrls;
  }

  // Handle Custom Qualification on Edit
  if (payload.qualificationId === 'custom' && payload.customQualification) {
    const qualResult = await insertTable("ref_qualifications", {
      activity_id: payload.activityId,
      qualification_name: payload.customQualification,
      is_verified: false,
    }, session);

    if (!qualResult.error && qualResult.data) {
      updatePayload.qualification_id = Array.isArray(qualResult.data) ? qualResult.data[0].id : qualResult.data.id;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const updateResult = await updateTable("instructor_services", serviceId, updatePayload, session);
    if (updateResult.error) return updateResult;
  }

  if (payload.pricing) {
    const deletePricingResult = await deleteTable("instructor_pricing", { service_id: `eq.${serviceId}` }, session);
    if (deletePricingResult.error) return { error: deletePricingResult.error, tableName: 'instructor_pricing' };
    if (payload.pricing.length > 0) {
      const pricingPayloads = payload.pricing.map(p => ({
        service_id: serviceId,
        skill_level: p.skillLevel,
        currency: p.currency || "USD",
        price_1_pax: Number(p.price1) || null,
        extra_person_fee: Number(p.extraPersonFee) || 0,
      }));
      const pricingResult = await insertTable("instructor_pricing", pricingPayloads, session, "return=minimal");
      if (pricingResult.error) return { error: pricingResult.error, tableName: 'instructor_pricing' };
    }
  }

  if (payload.locationIds) {
    const locationResult = await replaceServiceLocationAreas(serviceId, payload.locationIds, session);
    if (locationResult.error) return { error: locationResult.error, tableName: locationResult.tableName || 'service_location_areas' };
  }

  return { error: null };
}

async function uploadServiceActivityImages(files = []) {
  const uploads = await Promise.all(Array.from(files || []).map((file) => uploadFile('posts', file, `service-activity-images/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name || 'activity.jpg'}`)));
  const failedUpload = uploads.find((result) => result.error);
  if (failedUpload) return { data: [], error: failedUpload.error };
  return { data: uploads.map((result) => result.data).filter(Boolean), error: null };
}

export async function updateInstructorBreakStatus(instructorId, isOnBreak) {
  const session = getCurrentSession();
  if (!session) {
    console.error('updateInstructorBreakStatus: No active session');
    return { error: 'auth_required' };
  }
  const accountCheck = await requireInteractiveAccount('instructor_profiles');
  if (accountCheck.error) return accountCheck;

  console.log(`updateInstructorBreakStatus: Updating instructor ${instructorId} to isOnBreak=${isOnBreak}`);
  const result = await updateTable('instructor_profiles', instructorId, {
    is_on_break: isOnBreak,
  }, session);

  if (result.error) {
    console.error('updateInstructorBreakStatus: Update failed', result.error);
  } else {
    console.log('updateInstructorBreakStatus: Update successful', result.data);
  }

  return result;
}
