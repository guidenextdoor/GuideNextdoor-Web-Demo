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

async function queryFirstAvailable(resourceName, params) {
  const errors = [];

  for (const tableName of tableCandidates[resourceName]) {
    const result = await queryTable(tableName, params);
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
  const result = await queryFirstAvailable('coaches', {
    select: '*,users(*),locations(*)',
    limit: '24',
    order: 'average_rating.desc',
  });

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

export async function fetchInstructorSchedule() {
  const session = await getActiveSession();
  const instructorResult = session
    ? await queryTable('instructor_profiles', {
        select: '*,users(*),locations(*)',
        user_id: `eq.${session.user.id}`,
        limit: '1',
      })
    : { data: [], error: null, tableName: 'instructor_profiles' };

  const fallbackResult = !instructorResult.data?.length
    ? await queryTable('instructor_profiles', {
        select: '*,users(*),locations(*)',
        limit: '1',
      })
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
      select: '*,locations(*)',
      instructor_id: `eq.${coach.id}`,
      approval_status: 'eq.approved',
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

  const services = await attachServiceLocations(servicesResult.data.map((row) => normalizeInstructorService(row)));
  const bookingsResult = await fetchInstructorServiceBookings(services, session);
  const posts = postsResult.error ? [] : postsResult.data.map((row) => normalizePost(row));
  const reviews = reviewsResult.error ? [] : reviewsResult.data.map((row) => normalizeReview(row));
  const bookedSlots = bookingsResult.error ? [] : mapBookedSlotsToServices(bookingsResult.data, services);

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
  const resultWithLocation = await queryFirstAvailable('posts', {
    ...query,
    select: '*,instructor_profiles(users(*),locations(*)),locations(*)',
  });

  const result = resultWithLocation.error
    ? await queryFirstAvailable('posts', {
        ...query,
        select: '*,instructor_profiles(users(*))',
      })
    : resultWithLocation;

  const posts = result.data.map((row) => normalizePost(row));
  const interactionState = session ? await fetchPostInteractionState(posts.map((post) => post.id), session) : {};

  return {
    ...result,
    data: posts.map((post) => ({
      ...post,
      liked: Boolean(interactionState[post.id]?.liked),
      saved: Boolean(interactionState[post.id]?.saved),
    })),
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

  for (const tableName of tableCandidates.coaches) {
    const result = await queryTable(tableName, {
      select: '*,users(*),locations(*)',
      id: `eq.${id}`,
      limit: '1',
    });
    if (!result.error) {
      return { ...result, data: result.data[0] ? normalizeCoach(result.data[0]) : null };
    }
  }

  return { data: null, error: 'not_found', tableName: tableCandidates.coaches[0] };
}

export async function fetchInstructorProfile(id) {
  const coachResult = await fetchCoachById(id);
  if (coachResult.error || !coachResult.data) return coachResult;

  const [postsResult, servicesResult, reviewsResult, availabilityResult, overridesResult, qualificationsResult] = await Promise.all([
    queryTable('posts', {
      select: '*,locations(*)',
      instructor_id: `eq.${id}`,
      approval_status: 'eq.approved',
      order: 'created_at.desc',
      limit: '24',
    }),
    queryTable('instructor_services', {
      select: '*,ref_activities(*),ref_qualifications(*),instructor_pricing(*)',
      instructor_id: `eq.${id}`,
      order: 'attainment_year.asc',
      limit: '24',
    }),
    queryTable('reviews', {
      select: '*,users(*),bookings(*)',
      instructor_id: `eq.${id}`,
      order: 'created_at.desc',
      limit: '20',
    }),
    queryTable('instructor_availability', {
      select: '*',
      instructor_id: `eq.${id}`,
      is_active: 'eq.true',
      order: 'day_of_week.asc,start_time.asc',
    }),
    queryTable('instructor_availability_overrides', {
      select: '*',
      instructor_id: `eq.${id}`,
      order: 'date.asc',
      limit: '20',
    }),
    queryTable('instructor_qualifications', {
      select: '*,ref_activities(*)',
      instructor_id: `eq.${id}`,
      order: 'attainment_year.asc',
      limit: '48',
    }),
  ]);

  const services = servicesResult.data.map((row) => normalizeInstructorService(row));
  const servicesWithLocations = await attachServiceLocations(services);
  const bookingsResult = await fetchInstructorServiceBookings(servicesWithLocations);
  const qualifications = qualificationsResult.data.map((row) => normalizeQualification(row));
  const posts = postsResult.data.map((row) => normalizePost({
    ...row,
    instructor_profiles: {
      users: {
        display_name: coachResult.data.name,
        avatar_url: coachResult.data.avatarUrl,
      },
      locations: null,
      cover_photo_url: coachResult.data.avatarUrl,
    },
  }));
  const session = getCurrentSession();
  const interactionState = session ? await fetchPostInteractionState(posts.map((post) => post.id), session) : {};
  const postsWithInteractions = posts.map((post) => ({
    ...post,
    liked: Boolean(interactionState[post.id]?.liked),
    saved: Boolean(interactionState[post.id]?.saved),
  }));
  const reviews = reviewsResult.data.map((row) => normalizeReview(row));
  const availability = availabilityResult.error ? [] : availabilityResult.data.map((row) => normalizeAvailability(row));
  const availabilityOverrides = overridesResult.error ? [] : overridesResult.data.map((row) => normalizeAvailabilityOverride(row));
  const bookedSlots = bookingsResult.error ? [] : bookingsResult.data.map((row) => normalizeBookedSlot(row));

  return {
    data: {
      ...coachResult.data,
      posts: postsWithInteractions,
      services: servicesWithLocations,
      reviews,
      availability,
      availabilityOverrides,
      bookedSlots,
      qualifications,
      stats: buildInstructorStats(coachResult.data, servicesWithLocations, postsWithInteractions, reviews),
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
  return {
    id: row.id || row.user_id || row.render_id,
    name: user.display_name || row.display_name || row.full_name || row.name || user.username || user.email || 'GuideNextdoor coach',
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

function normalizePost(row) {
  const profile = row.instructor_profiles || {};
  const user = profile.users || {};
  const location = row.locations || profile.locations || {};
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const caption = row.caption || row.title || '';
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
    coachName: user.display_name || user.username || 'GuideNextdoor coach',
    avatarUrl: user.avatar_url || profile.cover_photo_url || '',
    hashtags: row.hashtags || [],
    location: location.name || location.formatted_address || location.city || location.city_or_region || '',
    liked: false,
    saved: false,
  };
}

async function fetchPostInteractionState(postIds, session) {
  if (!postIds.length) return {};

  const postFilter = `in.(${postIds.join(',')})`;
  const [likes, saves] = await Promise.all([
    queryInteractionTable('post_likes', postFilter, session),
    queryInteractionTable('saved_posts', postFilter, session),
  ]);

  const state = {};
  likes.forEach((like) => {
    state[like.post_id] = { ...state[like.post_id], liked: true };
  });
  saves.forEach((save) => {
    state[save.post_id] = { ...state[save.post_id], saved: true };
  });

  return state;
}

async function queryInteractionTable(tableName, postFilter, session) {
  const result = await requestTable(tableName, {
    select: 'post_id',
    user_id: `eq.${session.user.id}`,
    post_id: postFilter,
  }, session);

  return result.error ? [] : result.data;
}

async function createInteraction(tableName, postId, session) {
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...buildHeaders(session),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      post_id: postId,
      user_id: session.user.id,
    }),
  });

  if (!response.ok && response.status !== 409) {
    return { error: await response.text() };
  }

  return { error: null, alreadyExists: response.status === 409 };
}

async function deleteInteraction(tableName, postId, session) {
  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  url.searchParams.set('post_id', `eq.${postId}`);
  url.searchParams.set('user_id', `eq.${session.user.id}`);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(session),
      Prefer: 'return=minimal',
    },
  });

  if (!response.ok) {
    return { error: await response.text() };
  }

  return { error: null };
}

async function deleteTable(tableName, filters, session) {
  if (!databaseStatus.hasConfig) {
    return { error: 'missing_config', tableName };
  }

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      ...buildHeaders(session),
      Prefer: 'return=minimal',
    },
  });

  if (!response.ok) {
    return { error: await response.text(), tableName };
  }

  return { error: null, tableName };
}

async function insertTable(tableName, payload, session, prefer = 'return=representation') {
  if (!databaseStatus.hasConfig) {
    return { data: null, error: 'missing_config', tableName };
  }

  const url = new URL(`/rest/v1/${tableName}`, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...buildHeaders(session),
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
