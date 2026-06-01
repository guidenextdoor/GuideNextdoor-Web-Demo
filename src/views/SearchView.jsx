import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, DatabaseZap, MapPin, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchSessionSearchData } from '../lib/database';

const ACTIVE_BOOKING_STATUSES = new Set([
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
  'Confirmed',
]);

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
      className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10"
    >
      <div className="mb-6">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('sessionsSearch.eyebrow')}</p>
        <h1 className="text-3xl font-black tracking-tight md:text-5xl">{t('sessionsSearch.title')}</h1>
      </div>

      <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {t('sessionsSearch.filters.location')}
            <select
              value={filters.locationId}
              onChange={(event) => updateFilter('locationId', event.target.value)}
              className="rounded-lg border border-gnd-cream bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-gnd-dark outline-none focus:border-gnd-red"
            >
              <option value="">{t('sessionsSearch.filters.anyLocation')}</option>
              {(state.data?.locations || []).map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {t('sessionsSearch.filters.date')}
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter('date', event.target.value)}
              className="rounded-lg border border-gnd-cream bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-gnd-dark outline-none focus:border-gnd-red"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {t('sessionsSearch.filters.startTime')}
            <input
              type="time"
              value={filters.time}
              onChange={(event) => updateFilter('time', event.target.value)}
              className="rounded-lg border border-gnd-cream bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-gnd-dark outline-none focus:border-gnd-red"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {t('sessionsSearch.filters.activity')}
            <select
              value={filters.activityId}
              onChange={(event) => updateFilter('activityId', event.target.value)}
              className="rounded-lg border border-gnd-cream bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-gnd-dark outline-none focus:border-gnd-red"
            >
              <option value="">{t('sessionsSearch.filters.anyActivity')}</option>
              {(state.data?.activities || []).map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {t('sessionsSearch.filters.keyword')}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray/50" />
              <input
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
                placeholder={t('sessionsSearch.filters.keywordPlaceholder')}
                className="w-full rounded-lg border border-gnd-cream bg-white py-3 pl-9 pr-3 text-sm font-bold normal-case tracking-normal text-gnd-dark outline-none focus:border-gnd-red"
              />
            </div>
          </label>
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

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-gnd-gray">{state.loading ? t('states.loading') : t('sessionsSearch.resultCount', { count: results.length })}</p>
        <button
          type="button"
          onClick={() => setFilters({ locationId: '', activityId: '', date: '', time: '', keyword: '' })}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-gnd-dark"
        >
          <SlidersHorizontal size={14} />
          {t('sessionsSearch.clear')}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {state.loading && [1, 2, 3, 4].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg bg-white" />)}
        {!state.loading && results.map((service) => (
          <SessionResultCard key={service.id} service={service} language={i18n.language} />
        ))}
      </div>

      {!state.loading && !results.length && !state.error && (
        <div className="mt-4 rounded-lg border border-dashed border-gnd-cream bg-white p-10 text-center">
          <h2 className="text-xl font-black text-gnd-dark">{t('sessionsSearch.emptyTitle')}</h2>
          <p className="mt-2 text-sm font-bold text-gnd-gray">{t('sessionsSearch.emptyBody')}</p>
        </div>
      )}
    </motion.section>
  );
}

function SessionResultCard({ service, language }) {
  const state = service.availabilityState;
  const profileTarget = service.coachUsername || service.instructorId;

  return (
    <article className="rounded-lg border border-gnd-cream bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gnd-cream text-gnd-red">
          {service.avatarUrl ? <img src={service.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-gnd-dark">{service.title}</h2>
              <p className="mt-1 text-sm font-bold text-gnd-gray">{service.coachName}</p>
            </div>
            <AvailabilityBadge status={state.status} label={state.label} />
          </div>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-gnd-gray">{service.description || 'Ask the coach for the best session format and meeting point.'}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-gnd-gray">
            <span className="inline-flex items-center gap-1 rounded-md bg-gnd-cream/50 px-2 py-1">
              <MapPin size={13} className="text-gnd-red" />
              {formatLocations(service)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-gnd-cream/50 px-2 py-1">
              <CalendarDays size={13} className="text-gnd-red" />
              {state.dateLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-gnd-cream/50 px-2 py-1">
              <Clock size={13} className="text-gnd-red" />
              {state.timeLabel}
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-gnd-cream pt-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">From</p>
              <p className="text-lg font-black text-gnd-dark">{service.minPrice ? formatMoney(service.minPrice, service.currency) : 'Ask for price'}</p>
            </div>
            <Link
              to={`/${language}/guide/${profileTarget}?tab=sessions`}
              className="rounded-lg bg-gnd-red px-4 py-3 text-xs font-black text-white transition hover:bg-gnd-dark"
            >
              View profile
            </Link>
          </div>
        </div>
      </div>
    </article>
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

function getAvailabilityState(service, filters) {
  if (!filters.date) {
    return { status: 'flexible', label: 'Select date', dateLabel: 'Choose date', timeLabel: 'Flexible time' };
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
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return formatted.startsWith(currency) ? formatted : `${currency} ${formatted}`;
}
