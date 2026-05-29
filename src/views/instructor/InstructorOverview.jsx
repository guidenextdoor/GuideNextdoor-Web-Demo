import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Star, 
  Calendar, 
  Clock, 
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import BookingDetailModal from '../../components/BookingDetailModal';

export default function InstructorOverview() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    async function loadData() {
      const result = await fetchInstructorSchedule();
      setState({ loading: false, data: result.data, error: result.error });
    }
    loadData();
  }, []);

  if (state.loading) return <div className="grid h-64 place-items-center">{t('states.loading')}</div>;

  const coach = state.data?.coach;
  const stats = state.data?.coach?.stats || {};
  const today = toDateInputValue(new Date());
  const upcomingBookings = state.data?.bookedSlots?.filter(b => b.status === 'Confirmed' && b.lessonDate >= today).slice(0, 3) || [];
  const pendingBookings = state.data?.bookedSlots?.filter(b => String(b.status || '').startsWith('Pending') && b.lessonDate >= today).slice(0, 3) || [];

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.overview.title')}
      title={t('workspace.overview.welcome', { name: coach?.name?.split(' ')[0] || 'Coach' })}
      subtitle={t('workspace.overview.subtitle')}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('profile.stats.reviews')} value={stats.reviewCount || 0} icon={Star} subValue={stats.averageRating ? stats.averageRating.toFixed(1) : '0.0'} color="text-yellow-500" />
        <StatCard label={t('profile.stats.sessions')} value={stats.sessionCount || 0} icon={Calendar} color="text-blue-500" />
        <StatCard label={t('workspace.overview.earnings')} value={formatEarnings(stats.earningsThisMonth)} icon={TrendingUp} subValue={t('workspace.overview.thisMonth')} color="text-green-600" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-gnd-dark sm:text-lg">
              <AlertCircle size={20} className="text-gnd-red" />
              {t('workspace.overview.pendingRequests')}
            </h2>
            <button className="text-sm font-black text-gnd-red hover:underline">
              {t('workspace.overview.viewAll')}
            </button>
          </div>
          <div className="grid gap-3">
            {pendingBookings.length > 0 ? pendingBookings.map((booking) => (
              <BookingActionCard key={booking.id} booking={booking} type="pending" onClick={() => setSelectedBooking(booking)} />
            )) : (
              <EmptyState small message={t('workspace.overview.noPending')} />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-gnd-dark sm:text-lg">
              <Clock size={20} className="text-blue-500" />
              {t('workspace.overview.upcomingSessions')}
            </h2>
            <button className="text-sm font-black text-gnd-red hover:underline">
              {t('workspace.overview.viewSchedule')}
            </button>
          </div>
          <div className="grid gap-3">
            {upcomingBookings.length > 0 ? upcomingBookings.map((booking) => (
              <BookingActionCard key={booking.id} booking={booking} type="upcoming" onClick={() => setSelectedBooking(booking)} />
            )) : (
              <EmptyState small message={t('workspace.overview.noUpcoming')} />
            )}
          </div>
        </section>
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

function StatCard({ label, value, subValue, color }) {
  return (
    <div className="rounded-lg border border-gnd-cream bg-white p-6 shadow-sm transition-shadow hover:shadow-md text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray mb-3">{label}</p>
      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl font-black text-gnd-dark">{value}</span>
        {subValue && (
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gnd-cream/30 ${color}`}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

function BookingActionCard({ booking, type, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-gnd-cream bg-gnd-cream/15 p-3 text-left transition-all hover:border-gnd-red/20 hover:bg-gnd-cream/25 active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
        <div className={`grid h-10 w-10 place-items-center rounded-md ${type === 'pending' ? 'bg-red-50 text-gnd-red' : 'bg-blue-50 text-blue-500'}`}>
          <Calendar size={20} />
        </div>
        <div>
          <p className="text-sm font-black text-gnd-dark">{booking.displayLessonDate || formatLessonDate(booking.lessonDate)}</p>
          <p className="text-xs font-bold text-gnd-gray">{booking.startTime} ({booking.durationHours}h)</p>
        </div>
      </div>
      <ArrowUpRight size={18} className="text-gnd-cream" />
    </button>
  );
}

function EmptyState({ message, small }) {
  return (
    <div className={`grid place-items-center rounded-lg border border-dashed border-gnd-cream bg-gnd-cream/20 ${small ? 'p-8' : 'p-16'}`}>
      <Inbox size={small ? 24 : 32} className="text-gnd-cream mb-2" />
      <p className="text-sm font-bold text-gnd-gray text-center">{message}</p>
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
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${currency} ${formatted}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLessonDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}-${month}-${year}` : String(value);
}
