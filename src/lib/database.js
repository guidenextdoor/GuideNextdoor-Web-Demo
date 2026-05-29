const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tableCandidates = {
  coaches: ['instructor_profiles'],
  services: ['instructor_services'],
  locations: ['locations', 'service_locations', 'destinations'],
  applications: ['waitlist'],
  posts: ['posts'],
};

const PENDING_BOOKING_STATUSES = new Set([
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
]);

const COMPLETION_PROMPT_MESSAGE_TYPE = 'booking_completion_prompt';
const AUTO_COMPLETED_MESSAGE_TYPE = 'booking_auto_completed';

export const databaseStatus = {
  hasConfig: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  projectUrl: SUPABASE_URL || '',
};

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

export async function signUpWithPassword(email, password) {
  if (!databaseStatus.hasConfig) {
    return { error: 'missing_config' };
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
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

  const data = await response.json();
  if (data.access_token) persistSession(data);
  return { data, error: null };
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
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*),instructor_profiles(id,user_id,users(id,display_name,avatar_url,username,email),locations(*))',
      is_active: 'eq.true',
      service_approval_status: 'in.(approved,Approved)',
      order: 'attainment_year.desc',
      limit: '240',
    }),
    fetchLocations(),
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

  const [availabilityResult, busySlotsResult] = await Promise.all([
    instructorIds.length
      ? queryTable('instructor_availability', {
          select: '*',
          instructor_id: `in.(${instructorIds.join(',')})`,
          is_active: 'eq.true',
          order: 'day_of_week.asc,start_time.asc',
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
  const bookingsByService = groupBy((busySlotsResult.data || []).map((row) => normalizeSearchBooking(row)), (row) => row.serviceId);

  return {
    data: {
      results: services.map((service) => ({
        ...service,
        availability: availabilityByInstructor.get(service.instructorId) || [],
        bookedSlots: bookingsByService.get(service.id) || [],
      })),
      locations: locationsResult.data || [],
      activities: (activitiesResult.data || []).map((activity) => ({
        id: activity.id,
        label: humanizeKey(activity.translation_key || activity.category_key || 'Activity'),
      })),
    },
    error: availabilityResult.error || busySlotsResult.error || null,
    tableName: availabilityResult.tableName || busySlotsResult.tableName || 'instructor_services',
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
  const [servicesResult, availabilityResult, overridesResult, postsResult, reviewsResult] = await Promise.all([
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

  return {
    data: {
      coach: {
        ...coach,
        stats: buildInstructorStats(coach, services, posts, reviews, bookedSlots),
      },
      services,
      availability: availabilityResult.error ? [] : availabilityResult.data.map((row) => normalizeAvailability(row)),
      availabilityOverrides: overridesResult.error ? [] : overridesResult.data.map((row) => normalizeAvailabilityOverride(row)),
      bookedSlots,
      posts,
      reviews,
      canEdit: Boolean(session && instructorResult.data?.length),
    },
    error: servicesResult.error || availabilityResult.error || overridesResult.error || postsResult.error || reviewsResult.error || bookingsResult.error || null,
    tableName: servicesResult.tableName || 'instructor_services',
  };
}

export async function createInstructorAvailabilityWindow(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'instructor_availability' };

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

  return deleteTable('instructor_availability', { id: `eq.${id}` }, session);
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
    data: (result.data || []).map((row) => normalizePost(row)).filter(isPublicQualityPost),
  };
}

export async function togglePostLike(post) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };

  return post.liked
    ? deleteInteraction('post_likes', post.id, session)
    : createInteraction('post_likes', post.id, session);
}

export async function toggleSavedPost(post) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };

  return post.saved
    ? deleteInteraction('saved_posts', post.id, session)
    : createInteraction('saved_posts', post.id, session);
}

export async function fetchPostComments(postId) {
  const result = await queryTable('post_comments', {
    select: '*,users(display_name,avatar_url)',
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

export async function uploadPostMedia(files) {
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

export async function createPost(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required' };

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

/**
 * Updates the instructor's profile (both user and instructor_profile tables).
 */
export async function updateInstructorProfile(updates) {
  const session = getCurrentSession();
  if (!session) return { error: 'auth_required' };

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

  const [postsResult, servicesResult, reviewsResult, availabilityResult, overridesResult, qualificationsResult, languageResult] = await Promise.all([
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
  const qualifications = qualificationsResult.data?.map((row) => normalizeQualification(row)) || [];
  
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
      services: servicesWithLocations,
      reviews,
      availability,
      availabilityOverrides,
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
    title: humanizeKey(activity.translation_key || activity.category_key || 'Coaching'),
    iconName: activity.icon_name || '',
    qualification: row.qualification_name || '',
    attainmentYear: row.attainment_year || null,
    certificateUrl: row.certificate_url || null,
  };
}

async function fetchInstructorServiceBookings(services, session = null) {
  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (!serviceIds.length) return { data: [], error: null, tableName: 'bookings' };

  return queryTable('bookings', {
    select: '*,users(id,display_name,avatar_url,username,email),messages(*)',
    service_id: `in.(${serviceIds.join(',')})`,
    order: 'lesson_date.asc,start_time_utc.asc',
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
    const insertPayload = tableName === 'waitlist' ? normalizeWaitlistPayload(payload) : payload;
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

export async function submitBookingRequest(payload) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'bookings' };

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
    title: humanizeKey(activity.translation_key || activity.category_key || 'Coaching session'),
    activityKey: activity.translation_key || activity.category_key || '',
    iconName: activity.icon_name || '',
    qualification: qualification.qualification_name || '',
    years: row.years_of_experience || 0,
    attainmentYear: row.attainment_year || null,
    tags: row.tags || [],
    description: row.description || row.service_description || '',
    minDurationHours: row.min_duration_hours || 1,
    status: row.service_approval_status || 'Pending',
    rawCertUrl: row.raw_cert_url || '',
    maskedCertUrl: row.masked_cert_url || '',
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
    title: row.title || row.name || metadata.title || humanizeKey(activity.translation_key || activity.category_key || 'Untitled service'),
    coachName: row.coach_name || metadata.coach_name || 'GuideNextdoor coach',
    status: row.service_approval_status || row.status || metadata.status || 'draft',
    location: row.location || metadata.location || 'Location to confirm',
    price: row.price || metadata.price || null,
  };
}

async function attachServiceLocations(services) {
  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (!serviceIds.length) return services;

  const coverageResult = await queryTable('service_coverage_areas', {
    select: '*',
    service_id: `in.(${serviceIds.join(',')})`,
  });
  if (coverageResult.error || !coverageResult.data.length) return services;

  const locationIds = [...new Set(coverageResult.data.map((row) => row.location_id).filter(Boolean))];
  const locationResult = locationIds.length
    ? await queryTable('locations', {
        select: '*',
        id: `in.(${locationIds.join(',')})`,
      })
    : { data: [] };
  const locationById = new Map((locationResult.data || []).map((location) => [location.id, normalizeLocation(location)]));

  return services.map((service) => ({
    ...service,
    locations: coverageResult.data
      .filter((row) => row.service_id === service.id)
      .map((row) => locationById.get(row.location_id))
      .filter(Boolean),
  }));
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
    reviewerName: user.display_name || user.username || 'GuideNextdoor learner',
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
    learnerName: user.display_name || user.email || 'GuideNextdoor learner',
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
    pendingSessionCount: bookedSlots.filter((booking) => booking.status === 'Pending').length,
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

  const [learnerResult, instructorProfileResult] = await Promise.all([
    queryTable('bookings', {
      select: '*,messages(*),instructor_services(instructor_profiles(user_id,users(id,display_name,avatar_url,username,email)),ref_activities(translation_key)),users(id,display_name,avatar_url,username,email)',
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
          select: '*,messages(*),instructor_services(instructor_profiles(user_id,users(id,display_name,avatar_url,username,email)),ref_activities(translation_key)),users(id,display_name,avatar_url,username,email)',
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
        select: 'conversation_id,user_id,users(id,display_name,avatar_url,username,email)',
        conversation_id: `in.(${conversationIds.join(',')})`,
        limit: '480',
      }, session),
      queryTable('messages', {
        select: '*,users(id,display_name,avatar_url,username,email)',
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
      const participantConversations = buildPersonConversations({
        conversationIds,
        participantRows: allParticipantsResult.data || [],
        messageRows: messagesResult.data || [],
        conversationRows: conversationsResult.data || [],
        bookingRows,
        currentUserId: session.user.id,
      });

      if (participantConversations.length) {
        return {
          ...participantResult,
          data: participantConversations,
        };
      }
    }
  }

  return {
    ...learnerResult,
    data: groupBookingConversations(bookingRows, session.user.id),
  };
}

export async function fetchUserMessages() {
  return fetchConversations();
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

  const existingPair = await fetchPairConversation(session.user.id, otherUserId, session);
  if (existingPair.data) return existingPair;

  const participantResult = await queryTable('conversation_participants', {
    select: 'conversation_id,user_id,users(id,display_name,avatar_url,username,email)',
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
      otherPartyName: displayUserName(otherUser),
      coachName: displayUserName(otherUser),
      avatarUrl: otherUser.avatar_url || '',
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
    }, session.user.id),
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
      otherPartyName: displayUserName(otherUser),
      coachName: displayUserName(otherUser),
      avatarUrl: otherUser.avatar_url || '',
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
    }, session.user.id),
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
          select: '*,users(id,display_name,avatar_url,username,email)',
          conversation_id: `in.(${conversationIds.join(',')})`,
          order: 'created_at.asc',
          limit: '1000',
        }, session)
      : { data: [], error: null },
    bookingIds.length
      ? queryTable('messages', {
          select: '*,users(id,display_name,avatar_url,username,email)',
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

  return {
    tableName: 'messages',
    error,
    data: data.map((row) => normalizeMessage(row, session.user.id)),
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

export async function updateBookingRequest({ bookingId, conversationId, updates, summary }) {
  const session = await getActiveSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'bookings' };
  if (!bookingId) return { data: null, error: 'missing_booking', tableName: 'bookings' };

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

function buildPersonConversations({ conversationIds, participantRows, messageRows, conversationRows, bookingRows, currentUserId }) {
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
      otherPartyName: displayUserName(otherParticipant.users),
      coachName: displayUserName(otherParticipant.users),
      avatarUrl: otherParticipant.users?.avatar_url || '',
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
        id: `person:${booking.otherPartyId}`,
        conversationIds: [],
        bookingIds: [booking.bookingId],
        primaryConversationId: '',
        bookings: [booking],
      });
    }
  });

  return [...byPerson.values()]
    .map((conversation) => finalizePersonConversation(conversation, currentUserId))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function finalizePersonConversation(conversation, currentUserId) {
  const messages = [...(conversation.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lastMessage = messages[messages.length - 1];
  const latestBooking = [...(conversation.bookings || [])].sort((a, b) => new Date(b.lessonDate || 0) - new Date(a.lessonDate || 0))[0];

  return {
    ...conversation,
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
    lastMessage: lastMessage?.text_content || latestBooking?.lastMessage || 'No messages yet',
    lastMessageAt: lastMessage?.created_at || latestBooking?.lastMessageAt || conversation.lastMessageAt || '',
    messageCount: messages.length,
    previewSenderName: lastMessage ? displayUserName(lastMessage.users) : '',
    lastMessageIsMine: lastMessage?.sender_id === currentUserId,
  };
}

function groupBookingConversations(bookingRows, currentUserId) {
  const byPerson = new Map();
  bookingRows.map((row) => normalizeConversation(row, currentUserId)).forEach((booking) => {
    const key = booking.otherPartyId || booking.bookingId;
    const existing = byPerson.get(key);
    if (existing) {
      existing.bookings.push(booking);
      existing.bookingIds.push(booking.bookingId);
      existing.messages.push(...booking.messages);
      byPerson.set(key, finalizePersonConversation(existing, currentUserId));
    } else {
      byPerson.set(key, finalizePersonConversation({
        ...booking,
        id: `person:${key}`,
        conversationIds: [],
        bookingIds: [booking.bookingId],
        primaryConversationId: '',
        bookings: [booking],
        messages: booking.messages,
      }, currentUserId));
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

function normalizeMessage(row, currentUserId) {
  const user = row.users || {};
  return {
    id: row.id,
    bookingId: row.booking_id,
    senderId: row.sender_id,
    body: row.text_content || '',
    imageUrl: row.image_url || '',
    messageType: row.message_type || 'text',
    metadata: row.metadata || {},
    createdAt: row.created_at || '',
    displayTime: formatMessageTime(row.created_at),
    isMine: row.sender_id === currentUserId,
    senderName: displayUserName(user),
    avatarUrl: user.avatar_url || '',
  };
}

function displayUserName(user = {}) {
  return user.display_name || user.username || user.email || 'GuideNextdoor user';
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
    userName: user.display_name || 'GuideNextdoor user',
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

function isPublicQualityPost(post) {
  const text = String(post.caption || post.title || '').trim();
  if (text.length < 12) return false;
  if (/^[a-z]{1,5}\1{2,}$/i.test(text.replace(/\s/g, ''))) return false;
  return true;
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

function normalizeWaitlistPayload(payload) {
  return {
    email: payload.email,
    user_type: payload.role || 'coach',
    language: 'en',
    marketing_opt_in: true,
    full_name: payload.full_name,
    phone: payload.phone || null,
    location: payload.location,
  };
}

function normalizeLocation(row) {
  const metadata = row.metadata || {};
  return {
    id: row.id || row.slug || row.name,
    name: row.name || row.city || metadata.name || 'New location',
    country: row.country || metadata.country || '',
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
    select: '*',
    order: 'qualification_name.asc',
  });
}

export async function deleteInstructorService(serviceId) {
  const session = getCurrentSession();
  if (!session) return { error: "auth_required" };

  return updateTable("instructor_services", serviceId, { is_active: false }, session);
}

export async function createInstructorService(payload) {
  const session = getCurrentSession();
  if (!session) return { data: null, error: "auth_required" };

  let finalQualId = payload.qualificationId === 'custom' ? null : (payload.qualificationId || null);
  let certUrl = null;

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
    const uploadResult = await uploadFile('certificates', payload.certFile);
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
    is_active: true,
    service_approval_status: "approved",
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
    await insertTable("instructor_pricing", pricingPayloads, session, "return=minimal");
  }

  // 4. Insert locations
  if (payload.locationIds && payload.locationIds.length > 0) {
    const locationPayloads = payload.locationIds.map(locId => ({
      service_id: service.id,
      location_id: locId,
    }));
    await insertTable("service_coverage_areas", locationPayloads, session, "return=minimal");
  }

  return { data: service, error: null };
}

export async function updateInstructorService(serviceId, payload) {
  const session = getCurrentSession();
  if (!session) return { error: "auth_required" };

  const updatePayload = {};
  if (payload.activityId !== undefined) updatePayload.activity_id = payload.activityId;
  if (payload.qualificationId !== undefined && payload.qualificationId !== 'custom') updatePayload.qualification_id = payload.qualificationId || null;
  if (payload.attainmentYear !== undefined) updatePayload.attainment_year = Number(payload.attainmentYear) || null;
  if (payload.description !== undefined) updatePayload.service_description = payload.description;
  if (payload.minDurationHours !== undefined) updatePayload.min_duration_hours = Number(payload.minDurationHours);

  // Handle Certificate Upload on Edit
  if (payload.certFile) {
    const uploadResult = await uploadFile('certificates', payload.certFile);
    if (!uploadResult.error) {
      updatePayload.raw_cert_url = uploadResult.data;
    }
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
    await deleteTable("instructor_pricing", { service_id: `eq.${serviceId}` }, session);
    if (payload.pricing.length > 0) {
      const pricingPayloads = payload.pricing.map(p => ({
        service_id: serviceId,
        skill_level: p.skillLevel,
        currency: p.currency || "USD",
        price_1_pax: Number(p.price1) || null,
        extra_person_fee: Number(p.extraPersonFee) || 0,
      }));
      await insertTable("instructor_pricing", pricingPayloads, session, "return=minimal");
    }
  }

  if (payload.locationIds) {
    await deleteTable("service_coverage_areas", { service_id: `eq.${serviceId}` }, session);
    if (payload.locationIds.length > 0) {
      const locationPayloads = payload.locationIds.map(locId => ({
        service_id: serviceId,
        location_id: locId,
      }));
      await insertTable("service_coverage_areas", locationPayloads, session, "return=minimal");
    }
  }

  return { error: null };
}
