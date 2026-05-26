import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, DollarSign, Inbox, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';

export default function InstructorBookings() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], stats: {}, error: null });

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

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.sessions.eyebrow')}
      title={t('workspace.sessions.title')}
      subtitle={t('workspace.sessions.subtitle')}
    >
      <div className="grid gap-4">
        {state.loading && (
          <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
              <p className="text-sm font-black text-gnd-gray uppercase tracking-widest">{t('states.loading')}</p>
            </div>
          </div>
        )}

        {!state.loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('workspace.sessions.totalEarnings')} value={formatEarnings(state.stats.totalEarnings)} icon={DollarSign} />
            <SummaryCard label={t('workspace.sessions.completed')} value={state.stats.completedSessionCount || 0} icon={CalendarDays} />
            <SummaryCard label={t('workspace.sessions.confirmed')} value={state.stats.confirmedSessionCount || 0} icon={Clock} />
            <SummaryCard label={t('workspace.sessions.pending')} value={state.stats.pendingSessionCount || 0} icon={Inbox} />
          </div>
        )}

        {!state.loading && state.data.length === 0 && (
          <div className="grid place-items-center rounded-lg border border-gnd-cream bg-white p-12 shadow-sm sm:p-16">
            <Inbox size={48} className="text-gnd-cream mb-4" />
            <h2 className="text-2xl font-black text-gnd-dark">{t('workspace.sessions.emptyTitle')}</h2>
            <p className="mt-2 text-gnd-gray font-bold text-center max-w-sm">{t('workspace.sessions.emptyBody')}</p>
          </div>
        )}

        {!state.loading && state.data.map((booking) => (
          <BookingCard key={booking.id} booking={booking} t={t} />
        ))}
      </div>
    </InstructorDashboardLayout>
  );
}

function BookingCard({ booking, t }) {
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
            {booking.location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-gnd-red" />
                {booking.location}
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
        <button className="group/btn flex items-center gap-2 rounded-md bg-gnd-cream px-5 py-3 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-red hover:text-white">
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
