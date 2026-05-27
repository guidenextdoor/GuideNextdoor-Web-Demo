const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tableCandidates = {
  coaches: ['instructor_profiles'],
  services: ['instructor_services'],
  locations: ['locations', 'service_locations', 'destinations'],
  applications: ['waitlist'],
  posts: ['posts'],
};

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

  const refreshed = await refreshSession(session.refresh_token);
  return refreshed || session;
}

async function refreshSession(refreshToken) {
  if (!databaseStatus.hasConfig || !refreshToken) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
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

  const response = await fetch(url.toString(), {
    headers: {
      ...buildHeaders(session),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    return { data: [], error: body || response.statusText, tableName };
  }

  return { data: await response.json(), error: null, tableName };
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

export async function fetchCoaches({ query = '', role = 'all', location = '' } = {}) {
  const session = getCurrentSession();
  const result = await queryFirstAvailable('coaches', {
    select: '*,users(*),locations(*)',
    limit: '24',
    order: 'average_rating.desc',
  }, session);

  const normalized = result.data.map((row) => normalizeCoach(row));
  const filtered = normalized.filter((coach) => {
    const haystack = `${coach.name} ${coach.location} ${coach.role} ${coach.bio}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesRole = role === 'all' || coach.roleKey === role;
    const matchesLocation = !location || coach.locationKey === location;
    return matchesQuery && matchesRole && matchesLocation;
  });

  return { ...result, data: filtered };
}

export async function fetchServices() {
  const result = await queryFirstAvailable('services', {
    select: '*,ref_activities(*)',
    limit: '12',
    order: 'years_of_experience.desc',
  });
  return { ...result, data: result.data.map((row) => normalizeService(row)) };
}

export async function fetchLanguages() {
  const result = await queryTable('ref_languages', {
    select: '*',
    is_active: 'eq.true',
    order: 'name.asc',
  });
  return result;
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
      order: 'date.asc',
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
  const bookingsResult = await fetchInstructorServiceBookings(services, session);
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
  const query = {
    approval_status: 'eq.approved',
    limit: '60',
    order: 'created_at.desc',
  };
  
  // Base select includes a join to post_likes and saved_posts.
  // We explicitly filter by user_id to double-ensure we only fetch the current user's state.
  const userFilter = session ? `(user_id=eq.${session.user.id})` : '';
  const likeJoin = `user_liked:post_likes(id)${userFilter}`;
  const saveJoin = `user_saved:saved_posts(id)${userFilter}`;
  const select = `*,instructor_profiles(users(*),locations(*)),locations(*),${likeJoin},${saveJoin}`;

  const resultWithLocation = await queryFirstAvailable('posts', {
    ...query,
    select,
  }, session);

  const result = resultWithLocation.error
    ? await queryFirstAvailable('posts', {
        ...query,
        select: `*,instructor_profiles(users(*)),${likeJoin},${saveJoin}`,
      }, session)
    : resultWithLocation;

  return {
    ...result,
    data: result.data.map((row) => normalizePost(row)),
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
    limit: '18',
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

  const [postsResult, servicesResult, reviewsResult, availabilityResult, overridesResult, qualificationsResult, languageResult] = await Promise.all([
    queryTable('posts', {
      select: '*,locations(*),user_liked:post_likes(id),user_saved:saved_posts(id)',
      instructor_id: `eq.${id}`,
      approval_status: 'eq.approved',
      order: 'created_at.desc',
      limit: '24',
    }, session),
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*)',
      instructor_id: `eq.${id}`,
      order: 'attainment_year.asc',
      limit: '24',
    }, session),
    queryTable('reviews', {
      select: '*,users(*),bookings(*)',
      instructor_id: `eq.${id}`,
      order: 'created_at.desc',
      limit: '20',
    }, session),
    queryTable('instructor_availability', {
      select: '*',
      instructor_id: `eq.${id}`,
      is_active: 'eq.true',
      order: 'day_of_week.asc,start_time.asc',
    }, session),
    queryTable('instructor_availability_overrides', {
      select: '*',
      instructor_id: `eq.${id}`,
      order: 'date.asc',
      limit: '20',
    }, session),
    queryTable('instructor_qualifications', {
      select: '*,ref_activities(*)',
      instructor_id: `eq.${id}`,
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
    select: '*,users(display_name,avatar_url,email),messages(*)',
    service_id: `in.(${serviceIds.join(',')})`,
    order: 'lesson_date.asc,start_time_utc.asc',
    limit: '240',
  }, session);
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
  const session = getCurrentSession();
  if (!session) return { data: null, error: 'auth_required', tableName: 'bookings' };

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

  const bookingResult = await insertTable('bookings', bookingPayload, session);
  if (bookingResult.error) return bookingResult;

  const booking = Array.isArray(bookingResult.data) ? bookingResult.data[0] : bookingResult.data;
  const note = String(payload.note || '').trim();

  if (booking?.id && note) {
    const messageResult = await insertTable('messages', {
      booking_id: booking.id,
      sender_id: session.user.id,
      text_content: note,
    }, session, 'return=minimal');

    if (messageResult.error) {
      return {
        data: booking,
        error: messageResult.error,
        tableName: 'messages',
      };
    }
  }

  return { data: booking, error: null, tableName: 'bookings' };
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
    location: location.formatted_address || location.city || row.location || row.city || metadata.location || 'Location pending',
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
  ]).filter((price) => Number.isFinite(Number(price)));
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
    location: row.location || metadata.location || 'Location pending',
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
    locationDetails: row.location_details || '',
    learnerName: user.display_name || user.email || 'GuideNextdoor learner',
    learnerAvatar: user.avatar_url || '',
    learnerNote: firstMessage?.text_content || '',
    createdAt: row.created_at || '',
    cancelledAt: row.cancelled_at || null,
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
  return String(value || '')
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function fetchUserMessages() {
  const session = getCurrentSession();
  if (!session) return { data: [], error: 'auth_required', tableName: 'bookings' };

  const [learnerResult, instructorProfileResult] = await Promise.all([
    queryTable('bookings', {
      select: '*,instructor_services(instructor_profiles(users(display_name,avatar_url)),ref_activities(translation_key)),users(display_name,avatar_url)',
      learner_id: `eq.${session.user.id}`,
      order: 'lesson_date.desc',
    }),
    queryTable('instructor_profiles', {
      user_id: `eq.${session.user.id}`,
      select: 'id',
      limit: '1',
    }),
  ]);

  let data = learnerResult.data || [];

  if (instructorProfileResult.data?.[0]?.id) {
    const instructorId = instructorProfileResult.data[0].id;
    const instructorBookings = await queryTable('bookings', {
      select: '*,instructor_services(instructor_profiles(users(display_name,avatar_url)),ref_activities(translation_key)),users(display_name,avatar_url)',
      'instructor_services.instructor_id': `eq.${instructorId}`,
      order: 'lesson_date.desc',
    });
    if (instructorBookings.data?.length) {
      data = [...data, ...instructorBookings.data];
      // Deduplicate and re-sort
      const seen = new Set();
      data = data.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      data.sort((a, b) => new Date(b.lesson_date) - new Date(a.lesson_date));
    }
  }

  return {
    ...learnerResult,
    data: data.map((row) => normalizeChatRoom(row, session.user.id)),
  };
}

function normalizeChatRoom(row, currentUserId) {
  const service = row.instructor_services || {};
  const instructorProfile = service.instructor_profiles || {};
  const instructorUser = instructorProfile.users || {};
  const activity = service.ref_activities || {};
  const learnerUser = row.users || {};

  const isLearner = row.learner_id === currentUserId;
  const otherParty = isLearner ? instructorUser : learnerUser;

  return {
    id: row.id,
    title: humanizeKey(activity.translation_key || 'Chat'),
    coachName: otherParty.display_name || otherParty.username || 'GuideNextdoor user',
    avatarUrl: otherParty.avatar_url || '',
    location: row.lesson_date ? formatDisplayDate(row.lesson_date) : 'Pending',
    status: row.status || 'Active',
    lastMessage: 'Click to view conversation',
  };
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
  const location = row.locations || profile.locations || {};
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const caption = row.caption || row.title || '';
  
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
    authorUsername: user.username || '',
    avatarUrl: user.avatar_url || profile.cover_photo_url || '',
    hashtags: row.hashtags || [],
    location: location.name || location.formatted_address || location.city || location.city_or_region || '',
    liked,
    saved,
  };
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

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      ...buildHeaders(activeSession),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

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
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...buildHeaders(activeSession),
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { data: null, error: await response.text(), tableName };
  }

  if (prefer === 'return=minimal' || response.status === 204) {
    return { data: null, error: null, tableName };
  }

  return { data: await response.json(), error: null, tableName };
}

async function requestTable(tableName, searchParams = {}, session = null) {
  if (!databaseStatus.hasConfig) {
    return { data: [], error: 'missing_config', tableName };
  }

  // Use provided session or try to get current one
  const activeSession = session || getCurrentSession();

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      ...buildHeaders(activeSession),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return { data: [], error: await response.text(), tableName };
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

function formatDisplayDate(value) {
  return formatPostDate(value);
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
