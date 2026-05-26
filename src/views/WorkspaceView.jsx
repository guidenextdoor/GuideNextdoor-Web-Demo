import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Inbox, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  createInstructorAvailabilityWindow,
  deleteInstructorAvailabilityWindow,
  fetchInstructorSchedule,
  fetchServices,
  fetchUserMessages,
} from '../lib/database';

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function WorkspaceView({ type }) {
  if (type === 'sessions') return <InstructorScheduleView />;

  return <GenericWorkspaceView type={type} />;
}

function GenericWorkspaceView({ type }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null, tableName: '' });
  const Icon = type === 'messages' ? MessageSquare : CalendarDays;

  useEffect(() => {
    let cancelled = false;
    const fetcher = type === 'messages' ? fetchUserMessages : fetchServices;
    
    fetcher().then((result) => {
      if (!cancelled) setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
    });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14"
    >
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t(`workspace.${type}.eyebrow`)}</p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t(`workspace.${type}.title`)}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gnd-gray">{t(`workspace.${type}.subtitle`)}</p>
        </div>
        {type !== 'messages' && (
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white">
            <Plus size={18} />
            {t(`workspace.${type}.primaryAction`)}
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {state.loading && <Panel icon={Icon} title={t('states.loading')} body={t('states.loadingDatabase')} />}
        {!state.loading && state.error && <Panel icon={Inbox} title={t('states.schemaPending')} body={t('states.schemaPendingBody', { table: state.tableName })} />}
        {!state.loading && !state.error && state.data.length === 0 && <Panel icon={Inbox} title={t(`workspace.${type}.emptyTitle`)} body={t(`workspace.${type}.emptyBody`)} />}
        {!state.loading && !state.error && state.data.map((item) => (
          <article key={item.id} className="rounded-lg bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black">{item.title}</h2>
                <p className="mt-1 text-sm text-gnd-gray">{item.coachName} / {item.location}</p>
              </div>
              <span className="w-fit rounded-md bg-gnd-cream px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-gnd-red">{item.status}</span>
            </div>
          </article>
        ))}
      </div>
    </motion.section>
  );
}

function InstructorScheduleView() {
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
    let cancelled = false;
    fetchInstructorSchedule().then((result) => {
      if (!cancelled) setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
    });
    return () => {
      cancelled = true;
    };
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
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14"
    >
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('workspace.schedule.eyebrow')}</p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t('workspace.schedule.title')}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gnd-gray">{t('workspace.schedule.subtitle')}</p>
        </div>
        <label className="grid gap-2 text-sm font-black">
          {t('workspace.schedule.month')}
          <input
            type="month"
            value={visibleMonth.slice(0, 7)}
            onChange={(event) => {
              if (event.target.value) setVisibleMonth(`${event.target.value}-01`);
            }}
            className="rounded-lg border border-white bg-white px-4 py-3 text-sm font-black outline-none focus:border-gnd-red"
          />
        </label>
      </div>

      {state.loading && <Panel icon={CalendarDays} title={t('states.loading')} body={t('states.loadingDatabase')} />}
      {!state.loading && state.error && !state.data && <Panel icon={Inbox} title={t('states.schemaPending')} body={t('states.schemaPendingBody', { table: state.tableName })} />}

      {!state.loading && state.data && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl bg-white p-4 shadow-lg shadow-red-900/5 md:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">{formatMonthHeading(visibleMonth)}</h2>
                <p className="mt-1 text-sm font-bold text-gnd-gray">{t('workspace.schedule.calendarHint')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg bg-gnd-cream px-3 py-2 text-xs font-black" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}>
                  {t('profile.booking.previousMonth')}
                </button>
                <button type="button" className="rounded-lg bg-gnd-cream px-3 py-2 text-xs font-black" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}>
                  {t('profile.booking.nextMonth')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekdayOptions.map((day) => (
                <div key={day.value} className="pb-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-gnd-gray">{day.label}</div>
              ))}
              {monthCells.map((cell) => cell.blank ? (
                <span key={cell.key} aria-hidden="true" />
              ) : (
                <div key={cell.value} className={`min-h-28 rounded-2xl border p-2 ${cell.isPast ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gnd-cream bg-gnd-cream/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black">{cell.day}</span>
                    <span className="text-[10px] font-black text-gnd-gray">{cell.availableWindows.length ? `${cell.availableWindows.length} ${t('workspace.schedule.windowsUnit')}` : t('profile.booking.noSlotsShort')}</span>
                  </div>
                  <div className="mt-2 grid gap-1">
                    {cell.availableWindows.slice(0, 2).map((window) => (
                      <p key={`${cell.value}-${window.id}`} className="truncate rounded-lg bg-white px-2 py-1 text-[10px] font-black text-gnd-dark">
                        {window.startTime}-{window.endTime}
                      </p>
                    ))}
                    {cell.blockedSlots.slice(0, 2).map((slot) => (
                      <p key={`${cell.value}-${slot.id}`} className="truncate rounded-lg bg-gnd-red px-2 py-1 text-[10px] font-black text-white">
                        {slot.startTime}-{slot.endTime}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">{t('workspace.schedule.recurring')}</p>
                  <h2 className="mt-1 text-2xl font-black">{t('workspace.schedule.weeklyWindows')}</h2>
                </div>
                {!state.data.canEdit && <span className="rounded-full bg-gnd-cream px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gnd-gray">{t('workspace.schedule.readOnly')}</span>}
              </div>

              <form className="mt-4 grid gap-3" onSubmit={handleAddWindow}>
                <label className="grid gap-2 text-sm font-black">
                  {t('workspace.schedule.day')}
                  <select
                    value={form.dayOfWeek}
                    onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))}
                    className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red"
                    disabled={!state.data.canEdit}
                  >
                    {weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-black">
                    {t('workspace.schedule.start')}
                    <input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red" disabled={!state.data.canEdit} />
                  </label>
                  <label className="grid gap-2 text-sm font-black">
                    {t('workspace.schedule.end')}
                    <input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="rounded-xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red" disabled={!state.data.canEdit} />
                  </label>
                </div>
                <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-gnd-red px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!state.data.canEdit || status.saving}>
                  <Plus size={17} />
                  {status.saving ? t('states.saving') : t('workspace.schedule.addWindow')}
                </button>
              </form>

              {status.error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-gnd-red">{status.error}</p>}
              {status.notice && <p className="mt-3 rounded-xl bg-gnd-cream px-3 py-2 text-sm font-bold text-gnd-dark">{status.notice}</p>}

              <div className="mt-5 grid gap-2">
                {state.data.availability.length ? state.data.availability.map((window) => (
                  <div key={window.id} className="flex items-center justify-between gap-3 rounded-xl border border-gnd-cream px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black">{window.dayLabel}</p>
                      <p className="text-xs font-bold text-gnd-gray">{window.startTime}-{window.endTime}</p>
                    </div>
                    <button type="button" className="rounded-lg bg-gnd-cream p-2 text-gnd-red disabled:opacity-40" onClick={() => handleDeleteWindow(window.id)} disabled={!state.data.canEdit || status.saving} aria-label={t('workspace.schedule.deleteWindow')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )) : (
                  <p className="rounded-xl bg-gnd-cream px-3 py-3 text-sm font-bold text-gnd-gray">{t('workspace.schedule.noWindows')}</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-gnd-dark p-5 text-white shadow-lg shadow-red-900/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">{t('workspace.schedule.blocked')}</p>
              <h2 className="mt-1 text-2xl font-black">{t('workspace.schedule.upcomingBookings')}</h2>
              <div className="mt-4 grid gap-2">
                {upcomingBookings.length ? upcomingBookings.map((booking) => (
                  <div key={booking.id} className="rounded-xl bg-white/10 px-3 py-3">
                    <p className="text-sm font-black">{formatDisplayDate(booking.lessonDate)} · {booking.startTime}-{booking.endTime}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs font-bold text-white/60"><Clock size={13} />{booking.status}</p>
                  </div>
                )) : (
                  <p className="rounded-xl bg-white/10 px-3 py-3 text-sm font-bold text-white/60">{t('workspace.schedule.noBookings')}</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </motion.section>
  );
}

function Panel({ icon: Icon, title, body }) {
  return (
    <div className="rounded-lg bg-white p-8">
      <Icon className="mb-5 text-gnd-red" size={28} />
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gnd-gray">{body}</p>
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
