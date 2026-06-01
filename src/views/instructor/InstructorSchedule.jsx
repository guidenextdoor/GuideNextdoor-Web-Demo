import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarCheck, CheckCircle2, Clock, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { 
  createInstructorAvailabilityWindow, 
  deleteInstructorAvailabilityWindow, 
  fetchInstructorSchedule,
  updateInstructorAvailabilityWindow,
  updateInstructorBreakStatus
} from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import BookingDetailModal from '../../components/BookingDetailModal';

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const windowPresets = [
  { label: 'Morning', startTime: '09:00', endTime: '12:00' },
  { label: 'Afternoon', startTime: '14:00', endTime: '17:00' },
  { label: 'Evening', startTime: '18:00', endTime: '20:00' },
];

export default function InstructorSchedule() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null, tableName: '' });
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [editingWindow, setEditingWindow] = useState(null);
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
      if (!cancelled) {
        setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
      }
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

    const hasOverlap = hasAvailabilityOverlap(state.data.availability, form);

    if (hasOverlap) {
      setStatus({ saving: false, error: t('workspace.schedule.overlapWindow'), notice: '' });
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

  const handleStartEditWindow = (window) => {
    setEditingWindow({
      id: window.id,
      dayOfWeek: Number(window.dayOfWeek),
      startTime: window.startTime,
      endTime: window.endTime,
    });
    setStatus({ saving: false, error: '', notice: '' });
  };

  const handleUpdateWindow = async (event) => {
    event.preventDefault();
    if (!editingWindow?.id) return;

    if (editingWindow.endTime <= editingWindow.startTime) {
      setStatus({ saving: false, error: t('workspace.schedule.invalidWindow'), notice: '' });
      return;
    }

    const hasOverlap = hasAvailabilityOverlap(state.data.availability, editingWindow, editingWindow.id);

    if (hasOverlap) {
      setStatus({ saving: false, error: t('workspace.schedule.overlapWindow'), notice: '' });
      return;
    }

    setStatus({ saving: true, error: '', notice: '' });
    const result = await updateInstructorAvailabilityWindow(editingWindow.id, editingWindow);

    if (result.error) {
      setStatus({
        saving: false,
        error: result.error === 'auth_required' ? t('workspace.schedule.loginRequired') : t('workspace.schedule.updateFailed'),
        notice: '',
      });
      return;
    }

    setEditingWindow(null);
    setStatus({ saving: false, error: '', notice: t('workspace.schedule.updated') });
    loadSchedule();
  };

  const handleDeleteWindow = async (id) => {
    if (!window.confirm(t('workspace.schedule.confirmDeleteWindow'))) return;

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

  const handleToggleBreak = async () => {
    const coachId = state.data?.coach?.id;
    if (!coachId) {
      return;
    }
    
    const currentStatus = state.data.coach.isOnBreak;
    setStatus({ saving: true, error: '', notice: '' });
    
    const result = await updateInstructorBreakStatus(coachId, !currentStatus);
    
    if (result.error) {
      setStatus({ 
        saving: false, 
        error: `${t('workspace.schedule.saveFailed')} (${result.error})`, 
        notice: '' 
      });
      return;
    }
    
    setStatus({ 
      saving: false, 
      error: '', 
      notice: !currentStatus ? t('workspace.schedule.breakEnabled') : t('workspace.schedule.breakDisabled') 
    });
    
    loadSchedule();
  };

  const monthCells = state.data
    ? buildScheduleMonthCells(state.data.availability, state.data.bookedSlots, visibleMonth)
    : [];
  const upcoming = state.data ? buildUpcomingScheduleItems(state.data.bookedSlots) : { attention: [], confirmed: [], today: [] };
  const timezoneLabel = state.data?.coach?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.schedule.eyebrow')}
      title={t('workspace.schedule.title')}
      subtitle={t('workspace.schedule.subtitle')}
    >

      {state.loading && (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
        </div>
      )}

      {!state.loading && state.data && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setMonthPickerYear(new Date(`${visibleMonth}T00:00:00`).getFullYear());
                        setMonthPickerOpen((current) => !current);
                      }}
                      className="rounded-md text-left outline-none focus:ring-2 focus:ring-gnd-red/25"
                      aria-expanded={monthPickerOpen}
                    >
                      <span className="text-xl font-black text-gnd-dark underline decoration-gnd-cream underline-offset-4 transition hover:text-gnd-red sm:text-2xl">
                      {formatMonthHeading(visibleMonth)}
                      </span>
                    </button>
                    {monthPickerOpen && (
                      <MonthPicker
                        year={monthPickerYear}
                        selectedMonth={visibleMonth}
                        onYearChange={setMonthPickerYear}
                        onSelect={(value) => {
                          setVisibleMonth(value);
                          setMonthPickerOpen(false);
                        }}
                      />
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm font-bold text-gnd-gray">{t('workspace.schedule.calendarHint')}</p>
                <p className="mt-1 text-xs font-bold text-gnd-gray">{t('workspace.schedule.timezoneNotice', { timezone: timezoneLabel })}</p>
                <ScheduleLegend />
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <div className="flex gap-2">
                <button type="button" className="rounded-md bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-red hover:text-white" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}>
                  {t('profile.booking.previousMonth')}
                </button>
                <button type="button" className="rounded-md border border-gnd-cream bg-white px-4 py-2.5 text-xs font-black text-gnd-dark transition-colors hover:border-gnd-red hover:text-gnd-red" onClick={() => setVisibleMonth(getMonthStart(new Date()))}>
                  {t('workspace.schedule.today')}
                </button>
                <button type="button" className="rounded-md bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark transition-colors hover:bg-gnd-red hover:text-white" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}>
                  {t('profile.booking.nextMonth')}
                </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekdayOptions.map((day) => (
                <div key={day.value} className="pb-2 text-center text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{day.label}</div>
              ))}
              {monthCells.map((cell) => cell.blank ? (
                <span key={cell.key} aria-hidden="true" />
              ) : (
                <button
                  key={cell.value}
                  type="button"
                  onClick={() => setSelectedDay(cell)}
                  className={`flex min-h-[88px] flex-col rounded-lg border p-2 text-left transition-colors sm:min-h-[118px] sm:p-3 ${cell.isToday ? 'border-gnd-red bg-red-50/40' : ''} ${cell.isPast ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gnd-cream bg-gnd-cream/20 hover:bg-white'}`}
                >
                  <div className="mb-2 flex h-5 shrink-0 items-start justify-between gap-2">
                    <span className="leading-none text-sm font-black">{cell.day}</span>
                    <DateStatusBadge cell={cell} />
                  </div>
                  <div className="grid min-h-0 flex-1 content-start gap-1">
                    {cell.timeline.slice(0, 4).map((segment) => (
                      <p key={`${cell.value}-${segment.key}`} className={getTimelineSegmentClass(segment)}>
                        {segment.startTime}-{segment.endTime} {segment.type === 'booking' ? `· ${formatBookingStatus(segment.status)}` : ''}
                      </p>
                    ))}
                    {!cell.isPast && cell.availableWindows.length === 0 && cell.blockedSlots.length === 0 && (
                      <p className="rounded-md bg-white/70 px-2 py-1 text-[9px] font-black uppercase text-gnd-gray/50">No windows</p>
                    )}
                    {cell.timelineHiddenCount > 0 && (
                      <p className="text-[9px] font-black text-gnd-gray">+{cell.timelineHiddenCount} more</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <ScheduleAttentionPanel upcoming={upcoming} onSelectBooking={setSelectedBooking} language={i18n.language} />

            <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
              <div className="rounded-lg border border-gnd-cream bg-gnd-cream/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gnd-red">{t('workspace.schedule.recurring')}</p>
                  <h2 className="mt-1 text-xl font-black text-gnd-dark">{t('workspace.schedule.weeklyWindows')}</h2>
                  <p className="mt-1 text-xs font-bold text-gnd-gray">
                    {state.data.coach?.isOnBreak ? t('workspace.schedule.onBreakBody') : t('workspace.schedule.takingBookingsBody', { timezone: timezoneLabel })}
                  </p>
                </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-md px-3 py-1 text-[9px] font-black uppercase tracking-widest ${state.data.coach?.isOnBreak ? 'bg-red-50 text-gnd-red' : 'bg-green-50 text-green-700'}`}>
                      {state.data.coach?.isOnBreak ? t('workspace.schedule.onBreak') : t('workspace.schedule.quickBreak')}
                    </span>
                    {!state.data.canEdit && (
                      <span className="rounded-md bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gnd-gray">{t('workspace.schedule.readOnly')}</span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleToggleBreak}
                    disabled={status.saving}
                    className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-xs font-black transition disabled:opacity-50 ${
                      state.data.coach?.isOnBreak
                        ? 'bg-gnd-dark text-white hover:bg-gnd-red'
                        : 'border border-gnd-cream bg-white text-gnd-dark hover:border-gnd-red hover:text-gnd-red'
                    }`}
                  >
                    {state.data.coach?.isOnBreak ? t('workspace.schedule.resumeBookings') : t('workspace.schedule.pauseBookings')}
                  </button>
                </div>
              </div>

              <form className="mt-6 grid gap-4" onSubmit={handleAddWindow}>
                <div className="flex flex-wrap gap-2">
                  {windowPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, startTime: preset.startTime, endTime: preset.endTime }))}
                      disabled={!state.data.canEdit}
                      className="rounded-md border border-gnd-cream bg-white px-3 py-2 text-xs font-black text-gnd-dark transition hover:border-gnd-red hover:text-gnd-red disabled:opacity-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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
                <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98] disabled:opacity-50" disabled={!state.data.canEdit || status.saving}>
                  <Plus size={18} />
                  {status.saving ? t('states.saving') : t('workspace.schedule.addWindow')}
                </button>
              </form>

              {status.error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-gnd-red">{status.error}</p>}
              {status.notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-xs font-bold text-green-600">{status.notice}</p>}

              <div className="mt-6 space-y-2">
                {state.data.availability.length ? state.data.availability.map((window) => (
                  editingWindow?.id === window.id ? (
                    <form key={window.id} className="rounded-lg border border-gnd-red/20 bg-white p-3" onSubmit={handleUpdateWindow}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-gnd-dark">{window.dayLabel}</p>
                        <button type="button" className="rounded-md bg-gnd-cream p-2 text-gnd-gray hover:text-gnd-red" onClick={() => setEditingWindow(null)} aria-label={t('workspace.schedule.cancelEdit')}>
                          <X size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">
                          {t('workspace.schedule.start')}
                          <input type="time" value={editingWindow.startTime} onChange={(event) => setEditingWindow((current) => ({ ...current, startTime: event.target.value }))} className="rounded-md border border-gnd-cream bg-white px-3 py-2 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red" disabled={!state.data.canEdit || status.saving} />
                        </label>
                        <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">
                          {t('workspace.schedule.end')}
                          <input type="time" value={editingWindow.endTime} onChange={(event) => setEditingWindow((current) => ({ ...current, endTime: event.target.value }))} className="rounded-md border border-gnd-cream bg-white px-3 py-2 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red" disabled={!state.data.canEdit || status.saving} />
                        </label>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" className="rounded-md border border-gnd-cream bg-white px-3 py-2 text-xs font-black text-gnd-gray hover:border-gnd-red hover:text-gnd-red" onClick={() => setEditingWindow(null)} disabled={status.saving}>
                          {t('workspace.schedule.cancelEdit')}
                        </button>
                        <button type="submit" className="rounded-md bg-gnd-red px-3 py-2 text-xs font-black text-white hover:bg-gnd-dark disabled:opacity-50" disabled={!state.data.canEdit || status.saving}>
                          {status.saving ? t('states.saving') : t('workspace.schedule.saveChanges')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div key={window.id} className="group/item flex items-center justify-between gap-3 rounded-lg border border-gnd-cream bg-gnd-cream/5 px-4 py-3 transition-colors hover:bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gnd-dark">{window.dayLabel}</p>
                        <p className="text-xs font-bold text-gnd-gray">{window.startTime}-{window.endTime}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className="rounded-md bg-gnd-cream p-2.5 text-gnd-gray opacity-0 transition-opacity hover:bg-white hover:text-gnd-red group-hover/item:opacity-100 disabled:opacity-40" onClick={() => handleStartEditWindow(window)} disabled={!state.data.canEdit || status.saving} aria-label={t('workspace.schedule.editWindow')}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="rounded-md bg-gnd-cream p-2.5 text-gnd-red opacity-0 transition-opacity hover:bg-red-50 group-hover/item:opacity-100 disabled:opacity-40" onClick={() => handleDeleteWindow(window.id)} disabled={!state.data.canEdit || status.saving} aria-label={t('workspace.schedule.deleteWindow')}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                )) : (
                  <div className="grid place-items-center rounded-lg border border-dashed border-gnd-cream bg-white/50 p-8 text-center">
                    <p className="text-sm font-bold text-gnd-gray">{t('workspace.schedule.noWindows')}</p>
                    <p className="mt-1 text-xs font-bold text-gnd-gray">{t('workspace.schedule.noWindowsHint')}</p>
                  </div>
                )}
              </div>
            </section>

          </aside>
        </div>
      )}
      {selectedDay && (
        <DayScheduleModal cell={selectedDay} onClose={() => setSelectedDay(null)} onSelectBooking={setSelectedBooking} />
      )}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          t={t}
          messagePath={buildLearnerMessagePath(i18n.language, selectedBooking)}
          onUpdated={async () => {
            setSelectedBooking(null);
            setSelectedDay(null);
            loadSchedule();
          }}
        />
      )}
    </InstructorDashboardLayout>
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
    const isPast = value < today;
    const availableWindows = isPast ? [] : availability.filter((window) => Number(window.dayOfWeek) === date.getDay());
    const blockedSlots = bookedSlots.filter((slot) => slot.lessonDate === value && ACTIVE_BOOKING_STATUSES.has(String(slot.status || '')));
    const timeline = buildDayTimeline(availableWindows, blockedSlots);
    return {
      value,
      day: String(index + 1).padStart(2, '0'),
      isPast,
      isToday: value === today,
      availableWindows,
      blockedSlots,
      timeline,
      timelineHiddenCount: Math.max(timeline.length - 4, 0),
    };
  });

  return [...leadingBlanks, ...days];
}

function hasAvailabilityOverlap(availability, candidate, excludeId = null) {
  return (availability || []).some((window) => (
    window.id !== excludeId
    && Number(window.dayOfWeek) === Number(candidate.dayOfWeek)
    && candidate.startTime < window.endTime
    && candidate.endTime > window.startTime
  ));
}

function buildDayTimeline(availableWindows, blockedSlots) {
  const bookingSegments = (blockedSlots || [])
    .filter((slot) => slot.startTime && slot.endTime)
    .map((slot) => ({
      key: `booking-${slot.id}`,
      type: 'booking',
      status: slot.status,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

  const openSegments = [];

  (availableWindows || []).forEach((window) => {
    if (!window.startTime || !window.endTime) return;

    let cursor = window.startTime;
    const overlappingBookings = bookingSegments
      .filter((slot) => slot.startTime < window.endTime && slot.endTime > window.startTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    overlappingBookings.forEach((slot) => {
      const blockedStart = maxTime(slot.startTime, window.startTime);
      const blockedEnd = minTime(slot.endTime, window.endTime);

      if (cursor < blockedStart) {
        openSegments.push({
          key: `open-${window.id}-${cursor}-${blockedStart}`,
          type: 'open',
          startTime: cursor,
          endTime: blockedStart,
        });
      }

      if (cursor < blockedEnd) cursor = blockedEnd;
    });

    if (cursor < window.endTime) {
      openSegments.push({
        key: `open-${window.id}-${cursor}-${window.endTime}`,
        type: 'open',
        startTime: cursor,
        endTime: window.endTime,
      });
    }
  });

  return [...openSegments, ...bookingSegments]
    .filter((segment) => segment.startTime < segment.endTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

function minTime(a, b) {
  return a <= b ? a : b;
}

function maxTime(a, b) {
  return a >= b ? a : b;
}

const ACTIVE_BOOKING_STATUSES = new Set([
  'Pending',
  'Pending instructor confirmation',
  'Pending learner confirmation',
  'Confirmed',
]);

function ScheduleLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
      <LegendItem className="bg-white border border-gnd-red/30" label="Open time" />
      <LegendItem className="bg-gnd-red" label="Needs action" />
      <LegendItem className="bg-green-600" label="Confirmed" />
      <LegendItem className="bg-gray-100 border border-gray-200" label="Past" />
    </div>
  );
}

function LegendItem({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gnd-cream px-2 py-1 text-gnd-gray">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function getTimelineSegmentClass(segment) {
  if (segment.type === 'open') {
    return 'truncate rounded-md border border-gnd-red/20 bg-white px-2 py-1 text-[9px] font-black text-gnd-dark shadow-sm';
  }

  if (segment.status === 'Confirmed') {
    return 'truncate rounded-md bg-green-600 px-2 py-1 text-[9px] font-black text-white shadow-sm shadow-green-600/10';
  }

  return 'truncate rounded-md bg-gnd-red px-2 py-1 text-[9px] font-black text-white shadow-sm shadow-red-600/20';
}

function DateStatusBadge({ cell }) {
  if (cell.isPast) return null;
  if (cell.isToday) return <span className="rounded-full bg-gnd-red px-2 py-0.5 text-[8px] font-black uppercase text-white">Today</span>;
  if (cell.blockedSlots.some((slot) => slot.status === 'Confirmed')) return <span className="h-1.5 w-1.5 rounded-full bg-green-600" />;
  if (cell.blockedSlots.length) return <span className="h-1.5 w-1.5 rounded-full bg-gnd-red" />;
  if (cell.availableWindows.length) return <span className="rounded-full border border-gnd-red/20 bg-white px-1.5 py-0.5 text-[8px] font-black uppercase text-gnd-gray">Open</span>;
  return null;
}

function MonthPicker({ year, selectedMonth, onYearChange, onSelect }) {
  const selected = new Date(`${selectedMonth}T00:00:00`);
  const selectedYear = selected.getFullYear();
  const selectedMonthIndex = selected.getMonth();

  return (
    <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-gnd-cream bg-white p-3 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" className="rounded-md bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark hover:bg-gnd-red hover:text-white" onClick={() => onYearChange(year - 1)}>
          Prev
        </button>
        <p className="text-sm font-black text-gnd-dark">{year}</p>
        <button type="button" className="rounded-md bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark hover:bg-gnd-red hover:text-white" onClick={() => onYearChange(year + 1)}>
          Next
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const value = toDateInputValue(new Date(year, monthIndex, 1));
          const isSelected = selectedYear === year && selectedMonthIndex === monthIndex;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={`rounded-md px-3 py-2 text-xs font-black transition ${
                isSelected
                  ? 'bg-gnd-red text-white'
                  : 'bg-gnd-cream/60 text-gnd-dark hover:bg-gnd-red hover:text-white'
              }`}
            >
              {new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(year, monthIndex, 1))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleAttentionPanel({ upcoming, onSelectBooking, language }) {
  return (
    <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gnd-red">Today / Upcoming</p>
          <h2 className="mt-1 text-xl font-black text-gnd-dark">Action queue</h2>
        </div>
        <CalendarCheck size={20} className="text-gnd-red" />
      </div>

      <div className="mt-5 space-y-4">
        <ScheduleMiniList
          title="Needs confirmation"
          icon={AlertCircle}
          items={upcoming.attention}
          empty="No pending confirmations."
          onSelectBooking={onSelectBooking}
          language={language}
        />
        <ScheduleMiniList
          title="Today"
          icon={Clock}
          items={upcoming.today}
          empty="No sessions today."
          onSelectBooking={onSelectBooking}
          language={language}
        />
        <ScheduleMiniList
          title="Next confirmed"
          icon={CheckCircle2}
          items={upcoming.confirmed}
          empty="No confirmed sessions."
          onSelectBooking={onSelectBooking}
          language={language}
        />
      </div>
    </section>
  );
}

function ScheduleMiniList({ title, icon: Icon, items, empty, onSelectBooking, language }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gnd-gray">
        <Icon size={13} className="text-gnd-red" />
        {title}
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.slice(0, 3).map((item) => (
            <div key={`${title}-${item.id}`} className="flex items-center gap-2 rounded-lg bg-gnd-cream/40 p-2 transition hover:bg-gnd-cream/70">
              <button
                type="button"
                onClick={() => onSelectBooking(item)}
                className="block min-w-0 flex-1 rounded-md px-1 py-1 text-left"
              >
                <p className="truncate text-xs font-black text-gnd-dark">{item.serviceTitle || item.title || 'Session'}</p>
                <p className="mt-0.5 text-[11px] font-bold text-gnd-gray">{formatShortDate(item.lessonDate)} · {item.startTime || '-'} · {formatBookingStatus(item.status)}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-gnd-gray">{item.learnerName || 'Learner'}</p>
              </button>
              {buildLearnerMessagePath(language, item) && (
                <Link
                  to={buildLearnerMessagePath(language, item)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-gnd-red transition hover:bg-gnd-red hover:text-white"
                  aria-label="Chat with requestor"
                >
                  <MessageCircle size={15} />
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gnd-cream px-3 py-2 text-xs font-bold text-gnd-gray">{empty}</p>
      )}
    </div>
  );
}

function DayScheduleModal({ cell, onClose, onSelectBooking }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gnd-dark/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">Day details</p>
            <h3 className="mt-1 text-xl font-black text-gnd-dark">{formatShortDate(cell.value)}</h3>
          </div>
          <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {cell.isPast && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold text-gray-400">
              This date is in the past. Recurring availability is hidden because learners cannot book it.
            </p>
          )}

          <DaySection title="Bookings" items={cell.blockedSlots} render={(slot) => (
            <button
              type="button"
              onClick={() => onSelectBooking(slot)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-white transition hover:scale-[1.01] ${slot.status === 'Confirmed' ? 'bg-green-600' : 'bg-gnd-red'}`}
            >
              <p>{slot.startTime || '-'}-{slot.endTime || '-'} · {formatBookingStatus(slot.status)}</p>
              <p className="mt-0.5 text-xs opacity-80">{slot.serviceTitle || slot.title || 'Session'} · {slot.learnerName || 'Learner'}</p>
            </button>
          )} />

          <DaySection title="Open availability" items={cell.availableWindows} render={(window) => (
            <div className="rounded-lg border border-gnd-cream bg-white px-3 py-2 text-sm font-black text-gnd-dark">
              {window.startTime}-{window.endTime}
            </div>
          )} />
        </div>
      </div>
    </div>
  );
}

function DaySection({ title, items, render }) {
  return (
    <section>
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{title}</p>
      {items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id}>{render(item)}</div>)}</div> : (
        <p className="rounded-lg border border-dashed border-gnd-cream px-3 py-3 text-sm font-bold text-gnd-gray">None</p>
      )}
    </section>
  );
}

function buildUpcomingScheduleItems(bookedSlots) {
  const today = toDateInputValue(new Date());
  const future = (bookedSlots || [])
    .filter((slot) => slot.lessonDate >= today && ACTIVE_BOOKING_STATUSES.has(String(slot.status || '')))
    .sort((a, b) => `${a.lessonDate || ''}${a.startTime || ''}`.localeCompare(`${b.lessonDate || ''}${b.startTime || ''}`));

  return {
    attention: future.filter((slot) => String(slot.status || '').startsWith('Pending')).slice(0, 5),
    today: future.filter((slot) => slot.lessonDate === today).slice(0, 5),
    confirmed: future.filter((slot) => slot.status === 'Confirmed').slice(0, 5),
  };
}

function formatBookingStatus(status) {
  const value = String(status || '');
  if (value === 'Pending instructor confirmation') return 'Needs instructor';
  if (value === 'Pending learner confirmation') return 'Needs learner';
  return value || 'Pending';
}

function formatShortDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}-${month}-${year}` : String(value);
}

function buildLearnerMessagePath(language, booking) {
  const target = booking?.learnerUsername || booking?.learnerId || '';
  return target ? `/${language}/instructor/messages?user=${encodeURIComponent(target)}` : '';
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
