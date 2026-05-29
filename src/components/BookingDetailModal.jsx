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
  Hash,
  Pencil,
  Circle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { updateBookingRequest } from '../lib/database';

export default function BookingDetailModal({ booking, onClose, t, messagePath = '', onUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    startTime: booking?.startTime || '',
    locationDetails: booking?.locationDetails || '',
    totalPrice: booking?.totalPrice ?? 0,
  });
  const [editStatus, setEditStatus] = useState({ saving: false, error: '' });

  if (!booking) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return formatLessonDate(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    return `${day}-${month}-${year} ${time}`;
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
    'Pending': { bg: 'bg-amber-500', text: 'text-white', icon: 'text-amber-500', lightBg: 'bg-amber-50' },
    'Confirmed': { bg: 'bg-green-600', text: 'text-white', icon: 'text-green-600', lightBg: 'bg-green-50' },
    'Completed': { bg: 'bg-blue-600', text: 'text-white', icon: 'text-blue-600', lightBg: 'bg-blue-50' },
    'Cancelled': { bg: 'bg-red-600', text: 'text-white', icon: 'text-red-600', lightBg: 'bg-red-50' },
  };

  const config = statusConfig[booking.status] || { bg: 'bg-gray-600', text: 'text-white', icon: 'text-gray-600', lightBg: 'bg-gray-50' };
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gnd-dark/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-250">
        
        {/* Top Header - Status & ID */}
        <div className="flex items-center justify-between border-b border-gnd-cream/40 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 rounded-full ${config.bg} ${config.text} px-4 py-1.5 text-[11px] font-black uppercase tracking-wider shadow-sm`}>
              <Circle size={10} fill="currentColor" />
              {booking.status}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-black text-gnd-gray/50 uppercase tracking-widest">
              <Hash size={12} />
              {booking.id.slice(0, 8)}
            </div>
          </div>
          <button onClick={onClose} className="group rounded-full p-2 text-gnd-gray transition-all hover:bg-gnd-cream/30 hover:text-gnd-red">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
          {/* Section 1: The "What & When" */}
          <div className="mb-10">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gnd-red/60">Booking Summary</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gnd-dark sm:text-4xl">
              {booking.serviceTitle}
            </h2>
            <p className="mt-4 flex items-center gap-2 text-lg font-black text-gnd-gray">
              <Calendar size={20} className="text-gnd-red" />
              {booking.displayLessonDate || formatLessonDate(booking.lessonDate)}
            </p>
          </div>

            <div className="grid gap-12 lg:grid-cols-2">
            {/* Left Column: Details List */}
            <div className="space-y-10">
              <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                <DataPoint icon={Clock} label="Time & Duration" value={`${booking.startTime} (${booking.durationHours}h)`} />
                <DataPoint icon={Activity} label="Activity Level" value={booking.skillLevel} />
                <DataPoint icon={Users} label="Group Size" value={t('workspace.sessions.groupSize', { count: booking.groupSize })} />
                <DataPoint icon={MapPin} label="Meeting Point" value={booking.locationDetails || "To be coordinated"} />
              </div>

              <div className="pt-8 border-t border-gnd-cream/30">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle size={16} className="text-blue-500" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-gnd-gray/50">Message from Learner</p>
                </div>
                <div className="relative rounded-2xl bg-blue-50/40 p-5 italic">
                  <span className="absolute -top-2 -left-2 text-4xl text-blue-100 font-serif">"</span>
                  <p className="relative z-10 text-sm font-medium leading-relaxed text-gnd-dark">
                    {booking.learnerNote || "No specific message left for this session."}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Learner Context */}
            <div className="space-y-8">
              <div>
                <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-gnd-gray/50">Requested By</p>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl bg-gnd-cream border-2 border-white shadow-md">
                    {booking.learnerAvatar ? (
                      <img src={booking.learnerAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-gnd-red">
                        <User size={32} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black text-gnd-dark truncate">{booking.learnerName}</p>
                    <p className="text-xs font-bold text-gnd-gray/60">Requested {formatDate(booking.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gnd-cream/30">
                <div className="rounded-2xl border border-gnd-cream bg-white p-5 shadow-sm">
                   <div className="flex items-center gap-2 mb-2">
                     <CalendarCheck size={16} className="text-gnd-red" />
                     <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/60">Session Audit</p>
                   </div>
                   <p className="text-xs font-bold text-gnd-gray leading-relaxed">
                     This is a verified booking for {booking.serviceTitle}. Review the details below before confirming the next step.
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t border-gnd-cream/40 bg-gnd-cream/5 px-5 py-5 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray/50">Instructor Earnings</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-gnd-dark">{formatMoney(booking.totalPrice, booking.currency)}</p>
              </div>
              {booking.status === 'Cancelled' && (
                <p className="mt-1 text-[10px] font-black text-gnd-red uppercase tracking-widest">
                   Note: This booking was cancelled.
                </p>
              )}
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-flow-col lg:auto-cols-max lg:grid-cols-none">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gnd-cream bg-white px-4 py-3 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-cream/40"
                >
                  <Pencil size={17} />
                  Edit
                </button>
              )}
              {messagePath && (
                <Link
                  to={messagePath}
                  className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gnd-dark bg-white px-4 py-3 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-dark hover:text-white"
                >
                  <MessageCircle size={18} />
                  Message learner
                </Link>
              )}
              {booking.status === 'Pending' ? (
                <>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gnd-cream bg-white px-4 py-3 text-xs font-black text-gnd-dark transition-all hover:bg-red-50 hover:text-gnd-red">
                    Decline
                  </button>
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gnd-red px-4 py-3 text-xs font-black text-white shadow-md shadow-red-600/15 transition-all hover:bg-gnd-dark active:scale-[0.98]">
                    <CheckCircle2 size={18} />
                    Accept Session
                  </button>
                </>
              ) : (
                <button onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gnd-cream bg-white px-4 py-3 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-cream/30">
                  Close Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {isEditing && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-gnd-dark/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">Edit request</p>
                <h3 className="mt-1 text-xl font-black text-gnd-dark">{booking.serviceTitle || 'Session'}</h3>
                <p className="mt-1 text-sm font-bold text-gnd-gray">Changes require learner confirmation.</p>
              </div>
              <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={() => setIsEditing(false)} aria-label="Close">
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="grid gap-1 text-xs font-black text-gnd-gray">
                Start time
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(event) => setEditForm((current) => ({ ...current, startTime: event.target.value }))}
                  className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark outline-none focus:border-gnd-red"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-gnd-gray">
                Meeting point
                <input
                  value={editForm.locationDetails}
                  onChange={(event) => setEditForm((current) => ({ ...current, locationDetails: event.target.value }))}
                  className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark outline-none focus:border-gnd-red"
                  placeholder="-"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-gnd-gray">
                Price
                <input
                  type="number"
                  min="0"
                  value={editForm.totalPrice}
                  onChange={(event) => setEditForm((current) => ({ ...current, totalPrice: event.target.value }))}
                  className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark outline-none focus:border-gnd-red"
                />
              </label>
            </div>

            {editStatus.error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-gnd-red">{editStatus.error}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg bg-gnd-cream px-4 py-2 text-xs font-black text-gnd-dark">Close</button>
              <button type="button" onClick={handleSaveEdit} disabled={editStatus.saving} className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                {editStatus.saving ? 'Saving' : 'Save and request confirmation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataPoint({ icon: Icon, label, value, valueClass = "text-gnd-dark" }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 rounded-lg bg-gnd-cream/30 p-2 text-gnd-red">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{label}</p>
        <p className={`mt-0.5 text-base font-black ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function formatMoney(value, currency = 'USD') {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${currency} ${formatted}`;
}
