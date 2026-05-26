import { 
  X, 
  User, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Calendar,
  Star,
  Clock,
  TrendingUp,
  MessageCircle,
  Activity,
  CalendarCheck,
  Hash,
  Circle
} from 'lucide-react';

export default function BookingDetailModal({ booking, onClose, t }) {
  if (!booking) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const statusConfig = {
    'Pending': { bg: 'bg-amber-500', text: 'text-white', icon: 'text-amber-500', lightBg: 'bg-amber-50' },
    'Confirmed': { bg: 'bg-green-600', text: 'text-white', icon: 'text-green-600', lightBg: 'bg-green-50' },
    'Completed': { bg: 'bg-blue-600', text: 'text-white', icon: 'text-blue-600', lightBg: 'bg-blue-50' },
    'Cancelled': { bg: 'bg-red-600', text: 'text-white', icon: 'text-red-600', lightBg: 'bg-red-50' },
  };

  const config = statusConfig[booking.status] || { bg: 'bg-gray-600', text: 'text-white', icon: 'text-gray-600', lightBg: 'bg-gray-50' };

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
              {booking.lessonDate}
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
                     This is a verified booking for {booking.serviceTitle}. All details are pulled from the secure Supabase ledger.
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t border-gnd-cream/40 bg-gnd-cream/5 px-6 py-6 sm:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
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
            
            <div className="flex w-full gap-3 sm:w-auto">
              {booking.status === 'Pending' ? (
                <>
                  <button className="flex-1 rounded-2xl border border-gnd-cream bg-white px-8 py-4 text-xs font-black text-gnd-dark transition-all hover:bg-red-50 hover:text-gnd-red sm:flex-none">
                    Decline
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gnd-red px-10 py-4 text-xs font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98] sm:flex-none">
                    <CheckCircle2 size={18} />
                    Accept Session
                  </button>
                </>
              ) : (
                <button onClick={onClose} className="w-full rounded-2xl border border-gnd-cream bg-white px-8 py-4 text-xs font-black text-gnd-dark transition-all hover:bg-gnd-cream/30 sm:w-auto">
                  Close Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
