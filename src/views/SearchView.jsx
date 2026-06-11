import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, DatabaseZap, MapPin, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchSessionSearchData } from '../lib/database';

const ACTIVE_BOOKING_STATUSES = new Set([
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
  'Confirmed',
]);

const SESSION_IMAGES = [
  ['ski', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=900&q=80'],
  ['snowboard', 'https://images.unsplash.com/photo-1481671703460-040cb8a2d909?auto=format&fit=crop&w=900&q=80'],
  ['surf', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=80'],
  ['yoga', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80'],
  ['tennis', 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=80'],
  ['fitness', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80'],
  ['run', 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=900&q=80'],
  ['hike', 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80'],
  ['dance', 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80'],
  ['swim', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=80'],
];

const FALLBACK_SESSION_IMAGE = 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80';

export default function SearchView() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null, tableName: '' });
  const [filters, setFilters] = useState({
    locationId: '',
    activityId: '',
    date: '',
    time: '',
    keyword: '',
  });
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessionSearchData().then((result) => {
      if (!cancelled) {
        setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const items = state.data?.results || [];
    return items
      .filter((service) => matchesFilters(service, filters))
      .map((service) => ({
        ...service,
        availabilityState: getAvailabilityState(service, filters),
      }))
      .sort((a, b) => availabilityRank(a.availabilityState.status) - availabilityRank(b.availabilityState.status));
  }, [filters, state.data]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl px-5 py-7 md:px-8 md:py-10"
    >
      <div className="border-b border-gnd-cream pb-5">
        <p className="mb-2 text-xs font-black uppercase text-gnd-red">{t('sessionsSearch.eyebrow')}</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h1 className="max-w-2xl text-3xl font-black text-gnd-dark md:text-5xl">{t('sessionsSearch.title')}</h1>
          <p className="text-sm font-black text-gnd-gray">{state.loading ? t('states.loading') : t('sessionsSearch.resultCount', { count: results.length })}</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => updateFilter('activityId', '')}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${!filters.activityId ? 'border-gnd-dark bg-gnd-dark text-white' : 'border-gnd-cream bg-white text-gnd-gray hover:border-gnd-red hover:text-gnd-red'}`}
        >
          {t('sessionsSearch.filters.anyActivity')}
        </button>
        {(state.data?.activities || []).map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => updateFilter('activityId', activity.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${filters.activityId === activity.id ? 'border-gnd-dark bg-gnd-dark text-white' : 'border-gnd-cream bg-white text-gnd-gray hover:border-gnd-red hover:text-gnd-red'}`}
          >
            {activity.label}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-lg border border-gnd-cream bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_150px_140px_minmax(190px,1.1fr)_auto] md:items-end">
          <label className="grid gap-1 text-xs font-black uppercase text-gnd-gray">
            {t('sessionsSearch.filters.location')}
            <select
              value={filters.locationId}
              onChange={(event) => updateFilter('locationId', event.target.value)}
              className="h-11 rounded-md border border-gnd-cream bg-white px-3 text-sm font-bold normal-case text-gnd-dark outline-none focus:border-gnd-red"
            >
              <option value="">{t('sessionsSearch.filters.anyLocation')}</option>
              {(state.data?.locations || []).map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-black uppercase text-gnd-gray">
            {t('sessionsSearch.filters.date')}
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
              className="h-11 rounded-md border border-gnd-cream bg-white px-3 text-sm font-bold normal-case text-gnd-dark outline-none focus:border-gnd-red"
            />
          </label>

          <label className="grid gap-1 text-xs font-black uppercase text-gnd-gray">
            {t('sessionsSearch.filters.startTime')}
            <input
              type="time"
              value={filters.time}
              onChange={(event) => updateFilter('time', event.target.value)}
              className="h-11 rounded-md border border-gnd-cream bg-white px-3 text-sm font-bold normal-case text-gnd-dark outline-none focus:border-gnd-red"
            />
          </label>

          <label className="grid gap-1 text-xs font-black uppercase text-gnd-gray">
            {t('sessionsSearch.filters.keyword')}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray/50" />
              <input
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
                placeholder={t('sessionsSearch.filters.keywordPlaceholder')}
                className="h-11 w-full rounded-md border border-gnd-cream bg-white pl-9 pr-3 text-sm font-bold normal-case text-gnd-dark outline-none focus:border-gnd-red"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() => setFilters({ locationId: '', activityId: '', date: '', time: '', keyword: '' })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gnd-cream px-4 text-xs font-black text-gnd-dark transition hover:bg-gnd-dark hover:text-white"
          >
            <SlidersHorizontal size={14} />
            {t('sessionsSearch.clear')}
          </button>
        </div>
      </section>

      {state.error && (
        <div className="mt-5 rounded-lg bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-gnd-red">
            <DatabaseZap size={18} />
            <span className="text-sm font-black">{t('states.schemaPending')}</span>
          </div>
          <p className="text-sm leading-6 text-gnd-gray">{t('states.schemaPendingBody', { table: state.tableName })}</p>
        </div>
      )}

      <div className="mt-6 divide-y divide-gnd-cream border-y border-gnd-cream bg-white">
        {state.loading && [1, 2, 3, 4].map((item) => <div key={item} className="h-48 animate-pulse bg-white" />)}
        {!state.loading && results.map((service) => (
          <SessionResultCard key={service.id} service={service} language={i18n.language} onOpen={setSelectedService} />
        ))}
      </div>

      {!state.loading && !results.length && !state.error && (
        <div className="mt-4 rounded-lg border border-dashed border-gnd-cream bg-white p-10 text-center">
          <h2 className="text-xl font-black text-gnd-dark">{t('sessionsSearch.emptyTitle')}</h2>
          <p className="mt-2 text-sm font-bold text-gnd-gray">{t('sessionsSearch.emptyBody')}</p>
        </div>
      )}

      {selectedService && (
        <SessionDetailModal service={selectedService} language={i18n.language} onClose={() => setSelectedService(null)} />
      )}
    </motion.section>
  );
}

function SessionResultCard({ service, language, onOpen }) {
  const state = service.availabilityState;
  const imageUrl = sessionImageFor(service);
  const bookingPath = buildBookingPath(service, language);
  const profilePath = buildProfilePath(service, language);
  const showAvailabilityMeta = state.status !== 'flexible';
  const open = () => onOpen(service);
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={handleKeyDown}
      className="group grid min-w-0 cursor-pointer gap-4 bg-white px-0 py-5 transition hover:bg-gnd-cream/30 focus:outline-none focus:ring-2 focus:ring-gnd-red/20 sm:grid-cols-[176px_minmax(0,1fr)] md:grid-cols-[204px_minmax(0,1fr)_170px] md:px-4"
    >
        <div className="aspect-[4/3] overflow-hidden bg-gnd-cream sm:aspect-square">
          <img src={imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        </div>
        <div className="min-w-0 px-4 sm:px-0">
          {showAvailabilityMeta && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AvailabilityBadge status={state.status} label={state.label} />
            </div>
          )}
          <h2 className="line-clamp-2 text-2xl font-black leading-tight text-gnd-dark">{service.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-gnd-gray">{service.description || 'Ask the coach for the best session format and meeting point.'}</p>

          <div className="mt-4 grid gap-2 text-sm font-black text-gnd-gray sm:grid-cols-2">
            <span className="inline-flex min-w-0 items-center gap-2">
              <MapPin size={13} className="text-gnd-red" />
              <span className="truncate">{formatLocations(service)}</span>
            </span>
            {showAvailabilityMeta && (
              <>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CalendarDays size={13} className="text-gnd-red" />
                  <span className="truncate">{state.dateLabel}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Clock size={13} className="text-gnd-red" />
                  <span className="truncate">{state.timeLabel}</span>
                </span>
              </>
            )}
            <span className="inline-flex min-w-0 items-center gap-2">
              <Link
                to={profilePath}
                onClick={(event) => event.stopPropagation()}
                className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-gnd-cream text-gnd-red ring-1 ring-gnd-cream transition hover:ring-gnd-red"
                aria-label={`View ${service.coachName}'s profile`}
              >
                {service.avatarUrl ? <img src={service.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={12} />}
              </Link>
              <span className="truncate">{service.coachName}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 sm:col-start-2 sm:px-0 md:col-start-auto md:flex-col md:items-end md:justify-between">
          <div className="text-left md:text-right">
            <p className="text-xs font-black uppercase text-gnd-gray">From</p>
            <p className="mt-1 text-xl font-black text-gnd-dark">{service.minPrice ? formatMoney(service.minPrice, service.currency) : 'Ask for price'}</p>
          </div>
          <Link
            to={bookingPath}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-lg border border-gnd-red bg-gnd-red px-4 py-3 text-xs font-black !text-white shadow-sm shadow-red-900/10 transition hover:border-gnd-red hover:bg-red-600 hover:!text-white active:scale-[0.98]"
          >
            Book session
            <ArrowRight size={14} />
          </Link>
        </div>
    </article>
  );
}

function SessionDetailModal({ service, language, onClose }) {
  const state = service.availabilityState;
  const imageUrl = sessionImageFor(service);
  const galleryUrls = Array.isArray(service.activityImageUrls) && service.activityImageUrls.length ? service.activityImageUrls : [imageUrl];
  const bookingPath = buildBookingPath(service, language);
  const profilePath = buildProfilePath(service, language);
  const showAvailabilityMeta = state.status !== 'flexible';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-gnd-dark/55 px-4 py-6" onMouseDown={onClose}>
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="grid md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="bg-gnd-cream">
            <img src={imageUrl} alt="" className="h-full max-h-[520px] min-h-[260px] w-full object-cover" />
          </div>
          <div className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {showAvailabilityMeta && <AvailabilityBadge status={state.status} label={state.label} />}
                <h2 className="mt-3 text-3xl font-black leading-tight text-gnd-dark">{service.title}</h2>
                <Link to={profilePath} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-gnd-dark hover:text-gnd-red">
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gnd-cream text-gnd-red">
                    {service.avatarUrl ? <img src={service.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={14} />}
                  </span>
                  {service.coachName}
                </Link>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream p-2 text-gnd-dark hover:text-gnd-red">
                <X size={18} />
              </button>
            </div>

            <p className="mt-5 whitespace-pre-wrap text-sm font-bold leading-7 text-gnd-gray">
              {service.description || 'The instructor has not added a full introduction yet. Use the booking request to share your goals, preferred level, and timing.'}
            </p>

            {galleryUrls.length > 1 && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {galleryUrls.slice(0, 6).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg bg-gnd-cream">
                    <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SessionDetailItem icon={MapPin} label="Location" value={formatLocations(service)} />
              <SessionDetailItem icon={Clock} label="Duration" value={`${service.minDurationHours || 1} hour minimum`} />
              {showAvailabilityMeta && <SessionDetailItem icon={CalendarDays} label="Availability" value={`${state.dateLabel} / ${state.timeLabel}`} />}
              <SessionDetailItem icon={UserRound} label="Coach" value={service.coachName} />
            </div>

            {service.qualification && (
              <div className="mt-5 rounded-lg bg-gnd-cream/70 p-4">
                <p className="text-xs font-black uppercase text-gnd-gray">Credential</p>
                <p className="mt-1 text-sm font-black text-gnd-dark">{service.qualification}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-gnd-cream pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-gnd-gray">From</p>
                <p className="mt-1 text-2xl font-black text-gnd-dark">{service.minPrice ? formatMoney(service.minPrice, service.currency) : 'Ask for price'}</p>
              </div>
              <Link to={bookingPath} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gnd-red bg-gnd-red px-5 py-3 text-sm font-black !text-white shadow-sm shadow-red-900/10 transition hover:border-gnd-red hover:bg-red-600 hover:!text-white active:scale-[0.98]">
                Book session
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SessionDetailItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-gnd-cream p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase text-gnd-gray">
        <Icon size={14} className="text-gnd-red" />
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-gnd-dark">{value || '-'}</p>
    </div>
  );
}

function AvailabilityBadge({ status, label }) {
  const className = {
    available: 'bg-green-50 text-green-700 border-green-100',
    full: 'bg-red-50 text-gnd-red border-red-100',
    unavailable: 'bg-gray-100 text-gnd-gray border-gray-200',
    flexible: 'bg-amber-50 text-amber-700 border-amber-100',
  }[status] || 'bg-gnd-cream text-gnd-gray border-gnd-cream';

  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${className}`}>{label}</span>;
}

function matchesFilters(service, filters) {
  if (filters.activityId && service.activityId !== filters.activityId) return false;
  if (filters.locationId && !service.locations.some((location) => location.id === filters.locationId)) return false;

  const keyword = filters.keyword.trim().toLowerCase();
  if (!keyword) return true;

  const haystack = [
    service.title,
    service.coachName,
    service.description,
    ...service.locations.map((location) => location.name),
  ].join(' ').toLowerCase();
  return haystack.includes(keyword);
}

function sessionImageFor(service) {
  if (Array.isArray(service.activityImageUrls) && service.activityImageUrls[0]) return service.activityImageUrls[0];
  const text = `${service.activityKey || ''} ${service.title || ''} ${service.description || ''}`.toLowerCase();
  return SESSION_IMAGES.find(([key]) => text.includes(key))?.[1] || FALLBACK_SESSION_IMAGE;
}

function buildProfilePath(service, language) {
  return `/${language}/guide/${service.coachUsername || service.instructorId}`;
}

function buildBookingPath(service, language) {
  return `${buildProfilePath(service, language)}?tab=sessions&service=${encodeURIComponent(service.id)}`;
}

function getAvailabilityState(service, filters) {
  if (!filters.date) {
    return { status: 'flexible', label: '', dateLabel: '', timeLabel: '' };
  }

  const day = new Date(`${filters.date}T00:00:00`).getDay();
  const recurringWindows = service.availability.filter((window) => Number(window.dayOfWeek) === day);
  const windows = getEffectiveAvailabilityForDate(
    recurringWindows,
    (service.availabilityOverrides || []).filter((override) => override.date === filters.date),
  );
  const activeBookings = service.bookedSlots.filter((booking) => (
    booking.lessonDate === filters.date
    && ACTIVE_BOOKING_STATUSES.has(booking.status)
  ));

  if (!windows.length) {
    return { status: 'unavailable', label: 'Unavailable', dateLabel: formatDate(filters.date), timeLabel: 'No windows' };
  }

  if (!filters.time) {
    return {
      status: 'available',
      label: activeBookings.length ? 'Limited slots' : 'Available',
      dateLabel: formatDate(filters.date),
      timeLabel: windows.map((window) => `${window.startTime}-${window.endTime}`).slice(0, 2).join(', '),
    };
  }

  const requestedEnd = addHoursToTime(filters.time, Math.max(Number(service.minDurationHours) || 1, 1));
  const withinWindow = windows.some((window) => filters.time >= window.startTime && requestedEnd <= window.endTime);
  if (!withinWindow) {
    return { status: 'unavailable', label: 'Unavailable', dateLabel: formatDate(filters.date), timeLabel: filters.time };
  }

  const isBooked = activeBookings.some((booking) => timeRangesOverlap(filters.time, requestedEnd, booking.startTime, booking.endTime));
  return {
    status: isBooked ? 'full' : 'available',
    label: isBooked ? 'Full' : 'Available',
    dateLabel: formatDate(filters.date),
    timeLabel: filters.time,
  };
}

function getEffectiveAvailabilityForDate(recurring, overrides) {
  const extraOpen = (overrides || []).filter((override) => override.isAvailable);
  const unavailable = (overrides || []).filter((override) => !override.isAvailable);
  let windows = [...(recurring || []), ...extraOpen]
    .filter((window) => window.startTime && window.endTime && window.startTime < window.endTime);

  unavailable.forEach((block) => {
    windows = windows.flatMap((window) => {
      if (!timeRangesOverlap(window.startTime, window.endTime, block.startTime, block.endTime)) return [window];
      const segments = [];
      if (window.startTime < block.startTime) segments.push({ ...window, endTime: block.startTime });
      if (block.endTime < window.endTime) segments.push({ ...window, startTime: block.endTime });
      return segments.filter((segment) => segment.startTime < segment.endTime);
    });
  });

  return windows.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

function availabilityRank(status) {
  return { available: 0, flexible: 1, full: 2, unavailable: 3 }[status] ?? 4;
}

function timeRangesOverlap(start, end, otherStart, otherEnd) {
  return start < otherEnd && end > otherStart;
}

function addHoursToTime(value, hours) {
  const [hour, minute] = String(value || '00:00').split(':').map(Number);
  const total = (hour * 60) + (minute || 0) + (hours * 60);
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}

function formatLocations(service) {
  const inferred = inferLocationFromText(service.title, service.description, service.coachName);
  if (inferred) return inferred;
  if (service.locations.length) return service.locations.map((location) => location.name).slice(0, 2).join(', ');
  return service.profileLocation?.name || 'Meeting point to confirm';
}

function inferLocationFromText(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
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

function formatMoney(value, currency = 'USD') {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${currency} ${formatted}`;
}
