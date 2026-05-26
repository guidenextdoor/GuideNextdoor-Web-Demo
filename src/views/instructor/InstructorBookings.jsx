import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, DollarSign, Inbox, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import BookingDetailModal from '../../components/BookingDetailModal';

export default function InstructorBookings() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], stats: {}, error: null });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    async function load() {
      const result = await fetchInstructorSchedule();
      setState({ 
        loading: false, 
        data: result.data?.bookedSlots || [], 
        stats: result.data?.coach?.stats || {},
        error: result.error 
      });
    }
    load();
  }, []);

  const filteredData = filter === 'All' 
    ? state.data 
    : state.data.filter(b => b.status === filter);

  const filterConfigs = [
    { key: 'All', label: 'All Sessions', count: state.data.length, icon: CalendarDays, color: 'text-gnd-dark' },
    { key: 'Confirmed', label: t('workspace.sessions.confirmed'), count: state.stats.confirmedSessionCount || 0, icon: Clock, color: 'text-green-600' },
    { key: 'Pending', label: t('workspace.sessions.pending'), count: state.stats.pendingSessionCount || 0, icon: Inbox, color: 'text-amber-500' },
    { key: 'Completed', label: t('workspace.sessions.completed'), count: (state.stats.completedSessionCount || 0) + (state.data.filter(b => b.status === 'Cancelled').length), icon: CalendarDays, color: 'text-blue-500' },
  ];

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.sessions.eyebrow')}
      title={t('workspace.sessions.title')}
      subtitle={t('workspace.sessions.subtitle')}
    >
      <div className="grid gap-6">
        {state.loading ? (
          <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
              <p className="text-sm font-black text-gnd-gray uppercase tracking-widest">{t('states.loading')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filterConfigs.map((cfg) => (
              <button
                key={cfg.key}
                onClick={() => setFilter(cfg.key)}
                className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all ${
                  filter === cfg.key 
                    ? 'border-gnd-red bg-white shadow-lg shadow-red-600/5 ring-1 ring-gnd-red' 
                    : 'border-gnd-cream bg-white hover:border-gnd-red/30 hover:bg-gnd-cream/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg bg-gnd-cream/50 p-1.5 ${cfg.color}`}>
                    <cfg.icon size={18} />
                  </div>
                  <span className="text-lg font-black text-gnd-dark">{cfg.count}</span>
                </div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${filter === cfg.key ? 'text-gnd-red' : 'text-gnd-gray'}`}>
                  {cfg.label}
                </p>
              </button>
            ))}
          </div>
        )}

        {!state.loading && filteredData.length === 0 && (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed border-gnd-cream bg-white p-12 py-20">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-gnd-cream/30 text-gnd-cream">
                <Inbox size={32} />
              </div>
              <h2 className="text-xl font-black text-gnd-dark">No sessions found</h2>
              <p className="mt-2 max-w-xs text-sm font-bold text-gnd-gray">
                {filter === 'All' 
                  ? t('workspace.sessions.emptyBody')
                  : `You don't have any ${filter.toLowerCase()} sessions at the moment.`
                }
              </p>
              {filter !== 'All' && (
                <button 
                  onClick={() => setFilter('All')}
                  className="mt-6 text-xs font-black uppercase tracking-widest text-gnd-red hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        {!state.loading && filteredData.map((booking) => (
          <BookingCard key={booking.id} booking={booking} t={t} onClick={() => setSelectedBooking(booking)} />
        ))}
      </div>

      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)} 
          t={t} 
        />
      )}
    </InstructorDashboardLayout>
  );
}

function BookingCard({ booking, t, onClick }) {
  const statusColors = {
    'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
    'Confirmed': 'bg-green-50 text-green-600 border-green-100',
    'Completed': 'bg-blue-50 text-blue-600 border-blue-100',
    'Cancelled': 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <article className="group flex flex-col gap-4 rounded-lg border border-gnd-cream bg-white p-4 shadow-sm transition-all hover:shadow-md md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-gnd-cream/50 text-gnd-red">
          <CalendarDays size={24} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColors[booking.status] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>
              {booking.status}
            </span>
            <span className="text-[10px] font-black text-gnd-gray/50 uppercase tracking-[0.15em]">
              #{booking.id.slice(0, 8)}
            </span>
          </div>
          <h2 className="text-xl font-black text-gnd-dark truncate">
            {booking.lessonDate}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm font-bold text-gnd-gray">
            {booking.serviceTitle && (
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-gnd-red" />
                {booking.serviceTitle}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-gnd-red" />
              {booking.startTime} ({booking.durationHours}h)
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-gnd-red" />
              {t('workspace.sessions.groupSize', { count: booking.groupSize })}
            </div>
            {booking.locationDetails && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-gnd-red" />
                {booking.locationDetails.slice(0, 20)}{booking.locationDetails.length > 20 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gnd-cream/50 pt-4 md:border-t-0 md:pt-0">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{t('workspace.sessions.totalPrice')}</p>
          <p className="text-lg font-black text-gnd-dark">{formatMoney(booking.totalPrice, booking.currency)}</p>
        </div>
        <button onClick={onClick} className="group/btn flex items-center gap-2 rounded-md bg-gnd-cream px-5 py-3 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-red hover:text-white">
          {t('workspace.overview.viewAll')}
          <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">{label}</p>
          <p className="mt-2 text-xl font-black text-gnd-dark sm:text-2xl break-words">{value}</p>
        </div>
        <div className="rounded-md bg-gnd-cream/50 p-2 text-gnd-red shrink-0">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function formatEarnings(earnings) {
  if (!earnings || typeof earnings !== 'object') return formatMoney(0);
  const entries = Object.entries(earnings);
  if (entries.length === 0) return formatMoney(0);
  return entries.map(([curr, val]) => formatMoney(val, curr)).join(' + ');
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
