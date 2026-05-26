import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Inbox, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchInstructorSchedule } from '../../lib/database';

export default function InstructorBookings() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null });

  useEffect(() => {
    async function load() {
      const result = await fetchInstructorSchedule();
      setState({ 
        loading: false, 
        data: result.data?.bookedSlots || [], 
        error: result.error 
      });
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">
            {t('workspace.sessions.title')}
          </h1>
          <p className="mt-2 text-lg font-bold text-gnd-gray">
            {t('workspace.sessions.subtitle')}
          </p>
        </div>
      </header>

      <div className="grid gap-4">
        {state.loading && (
          <div className="grid h-64 place-items-center rounded-3xl bg-white border border-gnd-cream/30">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
              <p className="text-sm font-black text-gnd-gray uppercase tracking-widest">{t('states.loading')}</p>
            </div>
          </div>
        )}

        {!state.loading && state.data.length === 0 && (
          <div className="grid place-items-center rounded-3xl bg-white p-16 border border-gnd-cream/30 shadow-sm">
            <Inbox size={48} className="text-gnd-cream mb-4" />
            <h2 className="text-2xl font-black text-gnd-dark">{t('workspace.sessions.emptyTitle')}</h2>
            <p className="mt-2 text-gnd-gray font-bold text-center max-w-sm">{t('workspace.sessions.emptyBody')}</p>
          </div>
        )}

        {!state.loading && state.data.map((booking) => (
          <BookingCard key={booking.id} booking={booking} t={t} />
        ))}
      </div>
    </div>
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
    <article className="group flex flex-col gap-4 rounded-3xl bg-white p-5 border border-gnd-cream/30 shadow-sm transition-all hover:shadow-md md:flex-row md:items-center md:justify-between md:p-6">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 grid place-items-center rounded-2xl bg-gnd-cream/50 text-gnd-red">
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
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-gnd-red" />
              {booking.startTime} ({booking.durationHours}h)
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
        <div className="md:hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50 mb-1">{t('profile.stats.sessions')}</p>
          <div className="flex items-center gap-2 text-sm font-bold text-gnd-dark">
            <User size={14} className="text-gnd-red" />
            {t('nav.messages')}
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-gnd-cream px-5 py-3 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-red hover:text-white group/btn">
          {t('workspace.overview.viewAll')}
          <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}
