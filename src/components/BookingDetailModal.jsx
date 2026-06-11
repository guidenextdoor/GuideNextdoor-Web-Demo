import { 
  X, 
  User, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Calendar,
  Clock,
  MessageCircle,
  Activity,
  CalendarCheck,
  Pencil,
  CreditCard,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { updateBookingRequest } from '../lib/database';
import ReportModal from './ReportModal';
import MoreActionsMenu from './MoreActionsMenu';

export default function BookingDetailModal({ booking, onClose, messagePath = '', onUpdated }) {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    startTime: booking?.startTime || '',
    locationDetails: booking?.locationDetails || '',
    totalPrice: booking?.totalPrice ?? 0,
  });
  const [editStatus, setEditStatus] = useState({ saving: false, error: '' });
  const [reportTarget, setReportTarget] = useState(null);

  const lang = i18n.language || 'en';
  const resolvedMessagePath = messagePath || `/${lang}/instructor/messages?user=${booking?.learnerUsername || booking?.learnerId || ''}`;

  useEffect(() => {
    // Prevent background scrolling
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!booking) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return formatLessonDate(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatLessonDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = String(dateString).slice(0, 10).split('-');
    if (year && month && day) return `${day}-${month}-${year}`;
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const statusConfig = {
    'Pending': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500' },
    'Confirmed': { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', dot: 'bg-green-500' },
    'Completed': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500' },
    'Cancelled': { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
  };

  const config = statusConfig[booking.status] || { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100', dot: 'bg-gray-500' };
  const canEdit = !['Completed', 'Cancelled'].includes(booking.status);

  const handleSaveEdit = async () => {
    setEditStatus({ saving: true, error: '' });
    const nextStatus = 'Pending learner confirmation';
    const result = await updateBookingRequest({
      bookingId: booking.id,
      conversationId: booking.conversationId || '',
      updates: {
        startTime: editForm.startTime,
        locationDetails: editForm.locationDetails,
        totalPrice: editForm.totalPrice,
        status: nextStatus,
      },
      summary: [
        'Booking request updated',
        `Service: ${booking.serviceTitle || 'Session'}`,
        `Date: ${formatLessonDate(booking.lessonDate)}`,
        `Start time: ${editForm.startTime || '-'}`,
        `Meeting point: ${editForm.locationDetails || '-'}`,
        `Price: ${formatMoney(editForm.totalPrice, booking.currency)}`,
        `Status: ${nextStatus}`,
      ].join('\n'),
    });

    if (result.error) {
      setEditStatus({ saving: false, error: result.error });
      return;
    }

    setEditStatus({ saving: false, error: '' });
    setIsEditing(false);
    await onUpdated?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gnd-dark/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        
        {/* Header: Status & Actions */}
        <div className="flex-none flex items-center justify-between border-b border-gnd-cream/20 bg-white px-8 py-5">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 rounded-full ${config.bg} ${config.color} ${config.border} border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest`}>
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot} animate-pulse`} />
              {booking.status}
            </div>
            <div className="text-[10px] font-bold text-gnd-gray/40 uppercase tracking-widest">
              ID: {booking.id.slice(0, 8)}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-gnd-cream/30 p-2 text-gnd-gray transition-colors hover:bg-gnd-red hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Section 1: Hero Summary */}
          <div className="bg-gradient-to-b from-gnd-cream/20 to-transparent px-8 py-8 sm:px-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gnd-red/60">{t('profile.sessions.title') || 'Session Detail'}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gnd-dark sm:text-4xl leading-tight">
              {booking.serviceTitle}
            </h2>
            
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gnd-cream/40">
                <Calendar size={18} className="text-gnd-red" />
                <span className="text-sm font-black text-gnd-dark">{booking.displayLessonDate || formatLessonDate(booking.lessonDate)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gnd-cream/40">
                <Clock size={18} className="text-gnd-red" />
                <span className="text-sm font-black text-gnd-dark">{booking.startTime} ({booking.durationHours}h)</span>
              </div>
            </div>
          </div>

          <div className="px-8 pb-10 sm:px-10">
            {/* Main Info Grid */}
            <div className="grid gap-10 lg:grid-cols-2">
              
              {/* Left Column: Logistics */}
              <div className="space-y-8">
                <div>
                  <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray/60 flex items-center gap-2">
                    <Info size={14} /> Logistics
                  </h3>
                  <div className="grid gap-6">
                    <DetailItem icon={MapPin} label="Meeting Point" value={booking.locationDetails || "To be coordinated"} />
                    <DetailItem icon={Activity} label="Activity Level" value={booking.skillLevel} />
                    <DetailItem icon={Users} label="Group Size" value={t('workspace.sessions.groupSize', { count: booking.groupSize })} />
                  </div>
                </div>

                <div className="rounded-3xl bg-blue-50/50 p-6">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/60 flex items-center gap-2">
                    <MessageCircle size={14} /> Learner Message
                  </h3>
                  <p className="text-sm font-bold leading-relaxed text-gnd-dark italic">
                    "{booking.learnerNote || "No specific message left for this session."}"
                  </p>
                </div>
              </div>

              {/* Right Column: Participant */}
              <div className="space-y-8">
                <div>
                  <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray/60 flex items-center gap-2">
                    <User size={14} /> Requested By
                  </h3>
                  <Link 
                    to={resolvedMessagePath}
                    className="group/card flex items-center gap-5 rounded-3xl border border-gnd-cream/40 bg-white p-5 shadow-sm transition-all hover:border-gnd-red/20 hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gnd-cream border-2 border-white shadow-md">
                      {booking.learnerAvatar ? (
                        <img src={booking.learnerAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-gnd-red">
                          <User size={32} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-black text-gnd-dark truncate group-hover/card:text-gnd-red transition-colors">{booking.learnerName}</p>
                      <p className="mt-1 text-xs font-bold text-gnd-gray/60">Requested on {formatDate(booking.createdAt)}</p>
                    </div>
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-gnd-cream/30 text-gnd-gray group-hover/card:bg-gnd-red group-hover/card:text-white transition-all">
                      <MessageCircle size={18} />
                    </div>
                  </Link>
                </div>

                <div className="rounded-3xl border border-gnd-cream bg-white p-6 shadow-sm">
                   <div className="flex items-center gap-2 mb-3">
                     <CalendarCheck size={16} className="text-gnd-red" />
                     <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/60">Verification Status</p>
                   </div>
                   <div className="flex items-center gap-2 text-xs font-bold text-green-600">
                     <CheckCircle2 size={14} />
                     Verified GuideNextdoor Booking
                   </div>
                   <p className="mt-2 text-xs font-bold text-gnd-gray leading-relaxed">
                     This is a confirmed service record from the platform.
                   </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex-none border-t border-gnd-cream/20 bg-white px-8 py-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gnd-cream/40 text-gnd-dark">
                <CreditCard size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">Instructor Earnings</p>
                <p className="text-2xl font-black text-gnd-dark">{formatMoney(booking.totalPrice, booking.currency)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-gnd-cream bg-white px-6 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-cream/40 active:scale-95"
                >
                  <Pencil size={16} />
                  Edit Details
                </button>
              )}
              {resolvedMessagePath && (
                <Link
                  to={resolvedMessagePath}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gnd-dark bg-white px-6 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-dark hover:text-white active:scale-95"
                >
                  <MessageCircle size={16} />
                  Message Learner
                </Link>
              )}
              <MoreActionsMenu
                buttonClassName="h-12 w-12 rounded-2xl border border-gnd-cream bg-white"
                actions={[{ key: 'report', label: 'Report', onClick: () => setReportTarget(buildBookingReportTarget(booking)) }]}
              />
              
              {booking.status === 'Pending' ? (
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gnd-red px-8 text-xs font-black text-white shadow-lg shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-95">
                  Accept Session
                </button>
              ) : (
                <button onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-2xl bg-gnd-cream px-8 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-cream/60 active:scale-95">
                  Close Window
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Internal Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] grid place-items-center bg-gnd-dark/80 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gnd-red">Booking Management</p>
                  <h3 className="mt-2 text-2xl font-black text-gnd-dark">Edit Session</h3>
                  <p className="mt-1 text-xs font-bold text-gnd-gray">Learner must re-confirm updated details.</p>
                </div>
                <button onClick={() => setIsEditing(false)} className="rounded-full bg-gnd-cream/40 p-2 text-gnd-gray hover:text-gnd-red">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-8 space-y-5">
                <div className="grid gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Start Time</label>
                  <input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-2xl border border-gnd-cream px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:ring-2 focus:ring-gnd-red/20 focus:border-gnd-red"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Meeting Point</label>
                  <input
                    type="text"
                    value={editForm.locationDetails}
                    onChange={(e) => setEditForm(prev => ({ ...prev, locationDetails: e.target.value }))}
                    className="w-full rounded-2xl border border-gnd-cream px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:ring-2 focus:ring-gnd-red/20 focus:border-gnd-red"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Total Price ({booking.currency})</label>
                  <input
                    type="number"
                    value={editForm.totalPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, totalPrice: Number(e.target.value) }))}
                    className="w-full rounded-2xl border border-gnd-cream px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:ring-2 focus:ring-gnd-red/20 focus:border-gnd-red"
                  />
                </div>
              </div>

              {editStatus.error && (
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-xs font-bold text-gnd-red">
                  <X size={14} /> {editStatus.error}
                </div>
              )}

              <div className="mt-10 flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="flex-1 h-12 rounded-2xl bg-gnd-cream/40 text-xs font-black text-gnd-dark hover:bg-gnd-cream/60"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={editStatus.saving}
                  className="flex-1 h-12 rounded-2xl bg-gnd-red text-xs font-black text-white shadow-lg shadow-red-600/20 hover:bg-gnd-dark disabled:opacity-50"
                >
                  {editStatus.saving ? 'Saving...' : 'Confirm Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReportModal reportTarget={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

function buildBookingReportTarget(booking) {
  return {
    title: 'Report booking issue',
    targetType: 'booking',
    targetId: booking.id || booking.bookingId,
    reportedUserId: booking.learnerId || booking.instructorUserId || '',
    evidenceMetadata: {
      booking_id: booking.id || booking.bookingId,
      service_title: booking.serviceTitle || booking.title || '',
      learner_name: booking.learnerName || '',
      status: booking.status || '',
      lesson_date: booking.lessonDate || '',
    },
  };
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gnd-cream/40 text-gnd-red">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{label}</p>
        <p className="mt-1 text-sm font-black text-gnd-dark leading-tight">{value}</p>
      </div>
    </div>
  );
}

function formatMoney(value, currency = 'USD') {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${currency} ${formatted}`;
}
