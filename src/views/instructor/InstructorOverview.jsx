import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Star, 
  Calendar, 
  Clock, 
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  X,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import BookingDetailModal from '../../components/BookingDetailModal';

export default function InstructorOverview() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showEarningModal, setShowEarningModal] = useState(false);

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
  const allBookings = state.data?.bookedSlots || [];
  const upcomingBookings = allBookings
    .filter(b => b.status === 'Confirmed' && b.lessonDate >= today)
    .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.startTime.localeCompare(b.startTime))
    .slice(0, 3);
  const pendingBookings = allBookings
    .filter(b => String(b.status || '').startsWith('Pending') && b.lessonDate >= today)
    .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.startTime.localeCompare(b.startTime))
    .slice(0, 3);

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.overview.title')}
      title={t('workspace.overview.welcome', { name: coach?.name?.split(' ')[0] || 'Coach' })}
      subtitle={t('workspace.overview.subtitle')}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('profile.stats.reviews')} value={stats.reviewCount || 0} icon={Star} subValue={stats.averageRating ? stats.averageRating.toFixed(1) : '0.0'} color="text-yellow-500" />
        <StatCard label={t('profile.stats.sessions')} value={stats.completedSessionCount || 0} icon={Calendar} color="text-blue-500" />
        
        <button 
          onClick={() => setShowEarningModal(true)}
          className="group relative overflow-hidden rounded-lg border border-gnd-cream bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gnd-red/20 text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray mb-3">{t('workspace.overview.earnings')}</p>
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-black text-gnd-dark group-hover:text-gnd-red transition-colors">
              {formatEarnings(stats.earningsThisMonth)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gnd-cream/30 text-green-600">
              {t('workspace.overview.thisMonth')}
            </span>
          </div>
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight size={14} className="text-gnd-red" />
          </div>
        </button>
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
        />
      )}

      {showEarningModal && (
        <EarningDetailModal 
          bookings={allBookings.filter(b => b.status === 'Completed')}
          totalEarnings={stats.totalEarnings}
          onClose={() => setShowEarningModal(false)}
          onBookingClick={(booking) => setSelectedBooking(booking)}
          t={t}
        />
      )}
    </InstructorDashboardLayout>
  );
}

function EarningDetailModal({ bookings, totalEarnings, onClose, onBookingClick, t }) {
  const [selectedMonth, setSelectedMonth] = useState(toDateInputMonth(new Date()));
  
  useEffect(() => {
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const availableMonths = [...new Set(bookings.map(b => b.lessonDate.slice(0, 7)))].sort().reverse();
  if (!availableMonths.includes(toDateInputMonth(new Date()))) {
    availableMonths.unshift(toDateInputMonth(new Date()));
  }

  const monthBookings = bookings.filter(b => b.lessonDate?.startsWith(selectedMonth));
  const monthEarnings = monthBookings.reduce((acc, b) => {
    const curr = b.currency || 'USD';
    acc[curr] = (acc[curr] || 0) + b.totalPrice;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gnd-dark/80 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none bg-gnd-cream/30 px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-gnd-dark">{t('workspace.overview.earnings')}</h2>
              <p className="text-xs font-bold text-gnd-gray mt-1">Detailed breakdown of your coaching income</p>
            </div>
            <button 
              onClick={onClose}
              className="rounded-full bg-white p-2 text-gnd-gray shadow-sm transition-colors hover:bg-gnd-red hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Select Month</span>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white px-3 py-1.5 rounded-lg text-sm font-black text-gnd-red shadow-sm outline-none border border-gnd-cream cursor-pointer"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-gnd-red px-4 py-3 text-white shadow-lg shadow-red-600/20">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5">Month Total</p>
              <p className="text-xl font-black">{formatEarnings(monthEarnings)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gnd-gray">Completed Sessions ({monthBookings.length})</h3>
          </div>

          <div className="grid gap-3">
            {monthBookings.length > 0 ? monthBookings.map((booking) => (
              <button 
                key={booking.id} 
                onClick={() => onBookingClick(booking)}
                className="group flex w-full items-center justify-between rounded-xl border border-gnd-cream p-4 text-left transition-all hover:border-gnd-red/20 hover:bg-gnd-cream/10 active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-green-50 text-green-600 transition-colors group-hover:bg-green-100">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gnd-dark group-hover:text-gnd-red transition-colors">{booking.learnerName}</p>
                    <p className="text-[10px] font-bold text-gnd-gray">{booking.displayLessonDate} • {booking.startTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-black text-gnd-dark">{formatMoney(booking.totalPrice, booking.currency)}</p>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{t('workspace.sessions.completed')}</p>
                  </div>
                  <ChevronRight size={16} className="text-gnd-cream transition-transform group-hover:translate-x-0.5 group-hover:text-gnd-red" />
                </div>
              </button>
            )) : (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <Inbox size={40} className="mx-auto text-gnd-cream mb-3" />
                <p className="text-sm font-bold text-gnd-gray">No earnings recorded for this month.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-gnd-cream bg-gnd-cream/10 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Total Lifetime Earnings</p>
              <p className="text-2xl font-black text-gnd-dark mt-1">{formatEarnings(totalEarnings)}</p>
            </div>
            <TrendingUp size={32} className="text-gnd-cream" />
          </div>
        </div>
      </motion.div>
    </div>
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

function formatMonth(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMoney(value, currency = 'USD') {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${currency} ${formatted}`;
}

function toDateInputMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
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
