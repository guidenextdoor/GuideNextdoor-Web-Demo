import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Star, 
  Heart, 
  Calendar, 
  Clock, 
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchInstructorSchedule, getCurrentSession } from '../../lib/database';

export default function InstructorOverview() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null });

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
  const upcomingBookings = state.data?.bookedSlots?.filter(b => b.status === 'Confirmed').slice(0, 3) || [];
  const pendingBookings = state.data?.bookedSlots?.filter(b => b.status === 'Pending').slice(0, 3) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">
          {t('workspace.overview.welcome', { name: coach?.name?.split(' ')[0] || 'Coach' })}
        </h1>
        <p className="mt-2 text-lg font-bold text-gnd-gray">
          {t('workspace.overview.subtitle')}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label={t('profile.stats.reviews')} 
          value={stats.reviewCount || 0} 
          icon={Star} 
          subValue={stats.averageRating ? stats.averageRating.toFixed(1) : '0.0'}
          color="text-yellow-500"
        />
        <StatCard 
          label={t('profile.stats.likes')} 
          value={stats.totalLikes || 0} 
          icon={Heart} 
          color="text-gnd-red"
        />
        <StatCard 
          label={t('profile.stats.sessions')} 
          value={stats.sessionCount || 0} 
          icon={Calendar} 
          color="text-blue-500"
        />
        <StatCard 
          label={t('workspace.overview.earnings')} 
          value="$0" 
          icon={TrendingUp} 
          subValue={t('workspace.overview.thisMonth')}
          color="text-green-600"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Pending Requests */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-black text-gnd-dark">
              <AlertCircle size={20} className="text-gnd-red" />
              {t('workspace.overview.pendingRequests')}
            </h2>
            <button className="text-sm font-black text-gnd-red hover:underline">
              {t('workspace.overview.viewAll')}
            </button>
          </div>
          <div className="grid gap-3">
            {pendingBookings.length > 0 ? pendingBookings.map((booking) => (
              <BookingActionCard key={booking.id} booking={booking} type="pending" />
            )) : (
              <EmptyState small message={t('workspace.overview.noPending')} />
            )}
          </div>
        </section>

        {/* Upcoming Schedule */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-black text-gnd-dark">
              <Clock size={20} className="text-blue-500" />
              {t('workspace.overview.upcomingSessions')}
            </h2>
            <button className="text-sm font-black text-gnd-red hover:underline">
              {t('workspace.overview.viewSchedule')}
            </button>
          </div>
          <div className="grid gap-3">
            {upcomingBookings.length > 0 ? upcomingBookings.map((booking) => (
              <BookingActionCard key={booking.id} booking={booking} type="upcoming" />
            )) : (
              <EmptyState small message={t('workspace.overview.noUpcoming')} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, subValue, color }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-gnd-cream/30 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gnd-dark">{value}</span>
            {subValue && <span className={`text-xs font-black ${color}`}>{subValue}</span>}
          </div>
        </div>
        <div className={`rounded-xl bg-gnd-cream/50 p-2 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function BookingActionCard({ booking, type }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-gnd-cream/30 hover:border-gnd-red/20 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${type === 'pending' ? 'bg-red-50 text-gnd-red' : 'bg-blue-50 text-blue-500'}`}>
          <Calendar size={20} />
        </div>
        <div>
          <p className="text-sm font-black text-gnd-dark">{booking.lessonDate}</p>
          <p className="text-xs font-bold text-gnd-gray">{booking.startTime} ({booking.durationHours}h)</p>
        </div>
      </div>
      <ArrowUpRight size={18} className="text-gnd-cream" />
    </div>
  );
}

function EmptyState({ message, small }) {
  return (
    <div className={`grid place-items-center rounded-2xl border-2 border-dashed border-gnd-cream bg-white/50 ${small ? 'p-8' : 'p-16'}`}>
      <Inbox size={small ? 24 : 32} className="text-gnd-cream mb-2" />
      <p className="text-sm font-bold text-gnd-gray text-center">{message}</p>
    </div>
  );
}
