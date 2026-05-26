import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, Plus, Trash2, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  createInstructorAvailabilityWindow,
  deleteInstructorAvailabilityWindow,
  fetchInstructorSchedule,
} from '../../lib/database';

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function InstructorSchedule() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null, tableName: '' });
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(new Date()));
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' });
  const [status, setStatus] = useState({ saving: false, error: '', notice: '' });

  const loadSchedule = () => {
    setState((current) => ({ ...current, loading: true }));
    fetchInstructorSchedule().then((result) => {
      setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
    });
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleAddWindow = async (event) => {
    event.preventDefault();
    if (!state.data?.coach?.id) return;

    if (form.endTime <= form.startTime) {
      setStatus({ saving: false, error: t('workspace.schedule.invalidWindow'), notice: '' });
      return;
    }

    setStatus({ saving: true, error: '', notice: '' });
    const result = await createInstructorAvailabilityWindow({
      instructorId: state.data.coach.id,
      ...form,
    });

    if (result.error) {
      setStatus({
        saving: false,
        error: result.error === 'auth_required' ? t('workspace.schedule.loginRequired') : t('workspace.schedule.saveFailed'),
        notice: '',
      });
      return;
    }

    setStatus({ saving: false, error: '', notice: t('workspace.schedule.saved') });
    loadSchedule();
  };

  const handleDeleteWindow = async (id) => {
    setStatus({ saving: true, error: '', notice: '' });
    const result = await deleteInstructorAvailabilityWindow(id);

    if (result.error) {
      setStatus({
        saving: false,
        error: result.error === 'auth_required' ? t('workspace.schedule.loginRequired') : t('workspace.schedule.deleteFailed'),
        notice: '',
      });
      return;
    }

    setStatus({ saving: false, error: '', notice: t('workspace.schedule.deleted') });
    loadSchedule();
  };

  const monthCells = state.data
    ? buildScheduleMonthCells(state.data.availability, state.data.bookedSlots, visibleMonth)
    : [];
  const upcomingBookings = state.data?.bookedSlots
    ?.filter((booking) => booking.lessonDate >= toDateInputValue(new Date()))
    ?.slice(0, 8) || [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">{t('workspace.schedule.title')}</h1>
          <p className="mt-2 text-lg font-bold text-gnd-gray">{t('workspace.schedule.subtitle')}</p>
        </div>
        <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
          {t('workspace.schedule.month')}
          <input
            type="month"
            value={visibleMonth.slice(0, 7)}
            onChange={(event) => {
              if (event.target.value) setVisibleMonth(`${event.target.value}-01`);
            }}
            className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-black text-gnd-dark outline-none focus:border-gnd-red"
          />
        </label>
      </header>

      {state.loading && (
        <div className="grid h-64 place-items-center rounded-3xl bg-white border border-gnd-cream/30">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
        </div>
      )}

      {!state.loading && state.data && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-gnd-cream/30 md:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-gnd-dark">{formatMonthHeading(visibleMonth)}</h2>
                <p className="mt-1 text-sm font-bold text-gnd-gray">{t('workspace.schedule.calendarHint')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark hover:bg-gnd-red hover:text-white transition-colors" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}>
                  {t('profile.booking.previousMonth')}
                </button>
                <button type="button" className="rounded-xl bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark hover:bg-gnd-red hover:text-white transition-colors" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}>
                  {t('profile.booking.nextMonth')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekdayOptions.map((day) => (
                <div key={day.value} className="pb-2 text-center text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{day.label}</div>
              ))}
              {monthCells.map((cell) => cell.blank ? (
                <span key={cell.key} aria-hidden="true" />
              ) : (
                <div key={cell.value} className={`min-h-[120px] rounded-2xl border p-3 transition-colors ${cell.isPast ? 'border-gray-50 bg-gray-50/50 text-gray-300' : 'border-gnd-cream bg-gnd-cream/20'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-black">{cell.day}</span>
                    {cell.availableWindows.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </div>
                  <div className="grid gap-1">
                    {cell.availableWindows.slice(0, 2).map((window) => (
                      <p key={`${cell.value}-${window.id}`} className="truncate rounded-lg bg-white px-2 py-1 text-[9px] font-black text-gnd-dark border border-gnd-cream/30">
                        {window.startTime}-{window.endTime}
                      </p>
                    ))}
                    {cell.blockedSlots.slice(0, 2).map((slot) => (
                      <p key={`${cell.value}-${slot.id}`} className="truncate rounded-lg bg-gnd-red px-2 py-1 text-[9px] font-black text-white shadow-sm shadow-red-600/20">
                        {slot.startTime}-{slot.endTime}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="grid gap-8">
            <section className="rounded-3xl bg-white p-6 shadow-sm border border-gnd-cream/30 md:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gnd-red">{t('workspace.schedule.recurring')}</p>
                  <h2 className="mt-1 text-2xl font-black text-gnd-dark">{t('workspace.schedule.weeklyWindows')}</h2>
                </div>
                {!state.data.canEdit && (
                  <span className="rounded-full bg-gnd-cream px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gnd-gray">{t('workspace.schedule.readOnly')}</span>
                )}
              </div>

              <form className="mt-6 grid gap-4" onSubmit={handleAddWindow}>
                <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
                  {t('workspace.schedule.day')}
                  <select
                    value={form.dayOfWeek}
                    onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))}
                    className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red"
                    disabled={!state.data.canEdit}
                  >
                    {weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
                    {t('workspace.schedule.start')}
                    <input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red" disabled={!state.data.canEdit} />
                  </label>
                  <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
                    {t('workspace.schedule.end')}
                    <input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red" disabled={!state.data.canEdit} />
                  </label>
                </div>
                <button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-gnd-red px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98] disabled:opacity-50" disabled={!state.data.canEdit || status.saving}>
                  <Plus size={18} />
                  {status.saving ? t('states.saving') : t('workspace.schedule.addWindow')}
                </button>
              </form>

              {status.error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-gnd-red">{status.error}</p>}
              {status.notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-xs font-bold text-green-600">{status.notice}</p>}

              <div className="mt-6 space-y-2">
                {state.data.availability.length ? state.data.availability.map((window) => (
                  <div key={window.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gnd-cream bg-gnd-cream/5 px-4 py-3 group/item hover:bg-white transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gnd-dark">{window.dayLabel}</p>
                      <p className="text-xs font-bold text-gnd-gray">{window.startTime}-{window.endTime}</p>
                    </div>
                    <button type="button" className="rounded-xl bg-gnd-cream p-2.5 text-gnd-red opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-50 disabled:opacity-40" onClick={() => handleDeleteWindow(window.id)} disabled={!state.data.canEdit || status.saving} aria-label={t('workspace.schedule.deleteWindow')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )) : (
                  <div className="grid place-items-center rounded-2xl border-2 border-dashed border-gnd-cream p-8 bg-white/50 text-center">
                    <p className="text-sm font-bold text-gnd-gray">{t('workspace.schedule.noWindows')}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-gnd-dark p-6 text-white shadow-xl shadow-gnd-dark/20 md:p-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{t('workspace.schedule.blocked')}</p>
              <h2 className="mt-1 text-2xl font-black text-white">{t('workspace.schedule.upcomingBookings')}</h2>
              <div className="mt-6 grid gap-3">
                {upcomingBookings.length ? upcomingBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center text-gnd-red">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{formatDisplayDate(booking.lessonDate)}</p>
                      <p className="text-xs font-bold text-white/40">{booking.startTime}-{booking.endTime} · {booking.status}</p>
                    </div>
                  </div>
                )) : (
                  <div className="grid place-items-center rounded-2xl bg-white/5 p-8 border border-white/5 text-center">
                    <p className="text-sm font-bold text-white/40">{t('workspace.schedule.noBookings')}</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function buildScheduleMonthCells(availability, bookedSlots, visibleMonth) {
  const monthStart = new Date(`${visibleMonth}T00:00:00`);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateInputValue(new Date());
  const leadingBlanks = Array.from({ length: monthStart.getDay() }, (_, index) => ({
    key: `blank-${visibleMonth}-${index}`,
    blank: true,
  }));

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const value = toDateInputValue(date);
    return {
      value,
      day: String(index + 1).padStart(2, '0'),
      isPast: value < today,
      availableWindows: availability.filter((window) => Number(window.dayOfWeek) === date.getDay()),
      blockedSlots: bookedSlots.filter((slot) => slot.lessonDate === value && ['Pending', 'Confirmed'].includes(slot.status)),
    };
  });

  return [...leadingBlanks, ...days];
}

function getMonthStart(value) {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : new Date(value);
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}

function shiftMonth(value, offset) {
  const date = new Date(`${value}T00:00:00`);
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthHeading(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
}

function formatDisplayDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
}
