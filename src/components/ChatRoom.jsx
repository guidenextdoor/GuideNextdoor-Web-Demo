import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarDays, CheckCircle2, Clock, Flag, Headphones, Inbox, MessageSquare, Pencil, Save, Send, Users, X } from 'lucide-react';
import {
  ensureDirectConversationWithUser,
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  updateBookingRequest,
} from '../lib/database';
import ReportModal from './ReportModal';

const BOOKING_STATUS = {
  pending: 'Pending',
  pendingInstructor: 'Pending instructor confirmation',
  pendingLearner: 'Pending learner confirmation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

export default function ChatRoom() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUser = searchParams.get('user') || '';
  const searchParamsKey = searchParams.toString();
  const [state, setState] = useState({ loading: true, conversations: [], error: null });
  const [activeId, setActiveId] = useState('');
  const [messageState, setMessageState] = useState({ loading: true, messages: [], error: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attendanceActionId, setAttendanceActionId] = useState('');
  const [compactOpen, setCompactOpen] = useState(false);
  const [messageReloadKey, setMessageReloadKey] = useState(0);
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchConversations()
      .then(async (result) => {
        if (cancelled) return;
        const conversations = mergeConversationsByPerson(result.data || []);
        let requestedConversation = targetUser
          ? conversations.find((conversation) => (
              conversation.otherPartyId === targetUser
              || conversation.otherPartyUsername === targetUser
              || conversation.otherPartyName === targetUser
              || conversation.coachName === targetUser
            ))
          : null;
        let nextConversations = conversations;

        if (targetUser && !requestedConversation) {
          const directResult = await ensureDirectConversationWithUser(targetUser);
          if (directResult.data) {
            requestedConversation = directResult.data;
            nextConversations = mergeTargetConversation(conversations, directResult.data);
          }
        }

        setState({ loading: false, conversations: nextConversations, error: result.error });
        setActiveId((current) => requestedConversation?.id || current || nextConversations[0]?.id || '');
        if (requestedConversation) {
          setCompactOpen(true);
          if (
            requestedConversation.otherPartyUsername
            && targetUser !== requestedConversation.otherPartyUsername
          ) {
            const nextParams = new URLSearchParams(searchParamsKey);
            nextParams.set('user', requestedConversation.otherPartyUsername);
            setSearchParams(nextParams, { replace: true });
          }
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, conversations: [], error: error.message || String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [searchParamsKey, setSearchParams, targetUser]);

  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;
    const selectedConversation = state.conversations.find((conversation) => conversation.id === activeId);
    if (!selectedConversation) return;

    fetchConversationMessages(selectedConversation)
      .then((result) => {
        if (!cancelled) {
          setMessageState({ loading: false, messages: result.data || [], error: result.error });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageState({ loading: false, messages: [], error: error.message || String(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, messageReloadKey, state.conversations]);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, state.conversations],
  );

  const refreshActiveConversation = async () => {
    const result = await fetchConversations();
    const conversations = mergeConversationsByPerson(result.data || []);
    setState({ loading: false, conversations, error: result.error });
    setMessageReloadKey((key) => key + 1);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeConversation || !body || sending) return;

    setSending(true);
    let sendTarget = activeConversation;

    if (!sendTarget.primaryConversationId && sendTarget.pendingDirectUserId) {
      const directResult = await ensureDirectConversationWithUser(sendTarget.pendingDirectUserId);
      if (directResult.error || !directResult.data?.primaryConversationId) {
        setSending(false);
        setMessageState((current) => ({ ...current, error: directResult.error || 'conversation_create_failed' }));
        return;
      }

      sendTarget = directResult.data;
      setState((current) => ({
        ...current,
        conversations: mergeTargetConversation(current.conversations, sendTarget),
      }));
      setActiveId(sendTarget.id);
    }

    const result = await sendConversationMessage({
      conversationId: sendTarget.primaryConversationId,
      text: body,
    });
    setSending(false);

    if (result.error) {
      setMessageState((current) => ({ ...current, error: result.error }));
      return;
    }

    setDraft('');
    const refreshed = await fetchConversationMessages(sendTarget);
    setMessageState({ loading: false, messages: refreshed.data || [], error: refreshed.error });
  };

  const handleAttendanceAction = async (message, action) => {
    if (!activeConversation || attendanceActionId) return;
    const booking = findMessageBooking(activeConversation, message);
    if (!booking?.bookingId || !booking.isLearner) return;

    setAttendanceActionId(`${message.id}:${action}`);
    let result;

    if (action === 'confirm') {
      result = await updateBookingRequest({
        bookingId: booking.bookingId,
        conversationId: activeConversation.primaryConversationId,
        updates: { status: 'Completed' },
        summary: `Session completion confirmed\nService: ${booking.title || 'Session'}\nDate: ${formatBookingDateForChat(booking.lessonDate)}\nConfirmed by: learner`,
      });
    } else {
      result = await updateBookingRequest({
        bookingId: booking.bookingId,
        conversationId: activeConversation.primaryConversationId,
        updates: { status: BOOKING_STATUS.pendingInstructor },
        summary: `Session attendance declined\nService: ${booking.title || 'Session'}\nDate: ${formatBookingDateForChat(booking.lessonDate)}\nLearner response: I did not attend or this session was not completed as expected.`,
      });
    }

    setAttendanceActionId('');
    if (result.error) {
      setMessageState((current) => ({ ...current, error: result.error }));
      return;
    }
    await refreshActiveConversation();
  };

  if (state.loading) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-gnd-cream bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
      </div>
    );
  }

  if (state.error && !state.conversations.length) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('states.error')}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-dark">{state.error}</p>
      </div>
    );
  }

  if (!state.conversations.length) {
    return (
      <div className="grid place-items-center rounded-lg border border-gnd-cream bg-white p-12 text-center shadow-sm sm:p-16">
        <Inbox size={48} className="mb-4 text-gnd-cream" />
        <h2 className="text-2xl font-black text-gnd-dark">{t('chat.emptyTitle')}</h2>
        <p className="mt-2 max-w-md text-sm font-bold leading-6 text-gnd-gray">{t('chat.emptyBody')}</p>
      </div>
    );
  }

  return (
    <section className="grid overflow-hidden rounded-lg border border-gnd-cream bg-white shadow-sm lg:min-h-[680px] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="bg-gnd-cream/20 lg:border-r">
        <div className="border-b border-gnd-cream bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('chat.conversations')}</p>
          <p className="mt-1 text-sm font-bold text-gnd-gray">{t('chat.conversationCount', { count: state.conversations.length })}</p>
        </div>
        <div className="overflow-auto p-2 lg:max-h-[620px]">
          {state.conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition ${
                conversation.id === activeId
                  ? `${compactOpen ? 'bg-white shadow-sm' : 'hover:bg-white/70 lg:bg-white lg:shadow-sm'}`
                  : 'hover:bg-white/70'
              }`}
              onClick={() => {
                setActiveId(conversation.id);
                setMessageState({ loading: true, messages: [], error: null });
                setMessageReloadKey((key) => key + 1);
                setCompactOpen(true);
              }}
            >
              <Avatar conversation={conversation} />
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-2">
                <span className="min-w-0 truncate text-sm font-black text-gnd-dark">{conversation.otherPartyName}</span>
                <span className="max-w-[92px] shrink-0 truncate text-right text-[10px] font-black uppercase tracking-wider text-gnd-gray/60">
                  {conversation.displayDate}
                </span>
                <span className="col-span-2 mt-1 min-w-0 truncate text-xs font-black uppercase tracking-wider text-gnd-red">{conversation.title}</span>
                <span className="col-span-2 mt-1 min-w-0 truncate text-sm font-bold text-gnd-gray">{conversation.lastMessage}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="hidden min-h-0 flex-col lg:flex">
        <ChatPanel
          activeConversation={activeConversation}
          messageState={messageState}
          draft={draft}
          setDraft={setDraft}
          sending={sending}
          handleSend={handleSend}
          onBookingChanged={refreshActiveConversation}
          attendanceActionId={attendanceActionId}
          onAttendanceAction={handleAttendanceAction}
          onReportConversation={() => setReportTarget(buildConversationReportTarget(activeConversation))}
        />
      </div>

      {compactOpen && activeConversation && (
        <div className={`fixed inset-0 z-50 bg-gnd-dark/45 p-3 ${targetUser ? '' : 'lg:hidden'}`}>
          <div className="flex h-full overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex min-w-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => {
                  setCompactOpen(false);
                  if (targetUser) {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('user');
                    setSearchParams(nextParams, { replace: true });
                  }
                }}
                className="absolute right-6 top-6 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-gnd-dark shadow-lg"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
              <ChatPanel
                activeConversation={activeConversation}
                messageState={messageState}
                draft={draft}
                setDraft={setDraft}
                sending={sending}
                handleSend={handleSend}
                onBookingChanged={refreshActiveConversation}
                attendanceActionId={attendanceActionId}
                onAttendanceAction={handleAttendanceAction}
                onReportConversation={() => setReportTarget(buildConversationReportTarget(activeConversation))}
              />
            </div>
          </div>
        </div>
      )}
      <ReportModal reportTarget={reportTarget} onClose={() => setReportTarget(null)} />
    </section>
  );
}

function mergeTargetConversation(conversations, targetConversation) {
  return mergeConversationsByPerson([targetConversation, ...conversations]);
}

function mergeConversationsByPerson(conversations) {
  const byPerson = new Map();
  const keyToPersonKey = new Map();

  conversations.forEach((conversation) => {
    const keys = conversationIdentityKeys(conversation);
    const matchedKey = keys.map((key) => keyToPersonKey.get(key)).find(Boolean);
    const key = matchedKey || conversationPersonKey(conversation);
    const existing = byPerson.get(key);

    if (!existing) {
      byPerson.set(key, cloneConversationCollections(conversation));
    } else {
      byPerson.set(key, mergeConversationRecords(existing, conversation));
    }

    keys.forEach((identityKey) => keyToPersonKey.set(identityKey, key));
  });

  return [...byPerson.values()].sort((a, b) => (
    new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
  ));
}

function conversationPersonKey(conversation) {
  return conversation.otherPartyId
    || normalizeIdentityKey(conversation.otherPartyUsername)
    || normalizeIdentityKey(conversation.otherPartyName)
    || normalizeIdentityKey(conversation.coachName)
    || conversation.pendingDirectUserId
    || conversation.id;
}

function conversationIdentityKeys(conversation) {
  return uniqueValues([
    conversation.otherPartyId,
    normalizeIdentityKey(conversation.otherPartyUsername),
    conversation.pendingDirectUserId,
    normalizeIdentityKey(conversation.otherPartyName),
    normalizeIdentityKey(conversation.coachName),
    ...(conversation.conversationIds || []),
  ]);
}

function normalizeIdentityKey(value) {
  return String(value || '').trim().toLowerCase();
}

function cloneConversationCollections(conversation) {
  return {
    ...conversation,
    conversationIds: [...(conversation.conversationIds || [])],
    bookingIds: [...(conversation.bookingIds || [])],
    bookings: [...(conversation.bookings || [])],
  };
}

function mergeConversationRecords(existing, incoming) {
  const newest = isConversationNewer(incoming, existing) ? incoming : existing;
  const fallback = newest === incoming ? existing : incoming;
  const conversationIds = uniqueValues([...(existing.conversationIds || []), ...(incoming.conversationIds || [])]);
  const bookingIds = uniqueValues([...(existing.bookingIds || []), ...(incoming.bookingIds || [])]);
  const bookings = uniqueBy(
    [...(existing.bookings || []), ...(incoming.bookings || [])],
    (booking) => booking.bookingId || booking.id,
  );

  return {
    ...fallback,
    ...newest,
    id: `person:${newest.otherPartyId || fallback.otherPartyId || newest.pendingDirectUserId || fallback.pendingDirectUserId || newest.id}`,
    conversationIds,
    bookingIds,
    bookings,
    otherPartyUsername: newest.otherPartyUsername || fallback.otherPartyUsername || '',
    primaryConversationId: newest.primaryConversationId || fallback.primaryConversationId || conversationIds[0] || '',
    pendingDirectUserId: newest.pendingDirectUserId || fallback.pendingDirectUserId || '',
    lastMessage: newest.lastMessage || fallback.lastMessage,
    lastMessageAt: newest.lastMessageAt || fallback.lastMessageAt,
    displayDate: newest.displayDate || fallback.displayDate,
  };
}

function isConversationNewer(a, b) {
  return new Date(a.lastMessageAt || 0) >= new Date(b.lastMessageAt || 0);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ChatPanel({ activeConversation, messageState, draft, setDraft, sending, handleSend, onBookingChanged, attendanceActionId, onAttendanceAction, onReportConversation }) {
  const { t } = useTranslation();

  return (
    <>
      {activeConversation ? (
        <>
          <ChatHeader conversation={activeConversation} onReport={onReportConversation} />
          <div className="flex-1 overflow-auto bg-gnd-cream/25 p-4 sm:p-6">
            {messageState.loading && (
              <div className="grid h-full min-h-60 place-items-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
              </div>
            )}

            {!messageState.loading && !messageState.messages.length && (
              <div className="grid h-full min-h-60 place-items-center text-center">
                <div>
                  <MessageSquare size={42} className="mx-auto text-gnd-cream" />
                  <p className="mt-3 text-sm font-bold text-gnd-gray">{t('chat.noMessages')}</p>
                </div>
              </div>
            )}

            {!messageState.loading && messageState.messages.length > 0 && (
              <div className="space-y-3">
                {messageState.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    conversation={activeConversation}
                    attendanceActionId={attendanceActionId}
                    onAttendanceAction={onAttendanceAction}
                  />
                ))}
              </div>
            )}
          </div>

          {messageState.error && (
            <p className="border-t border-gnd-cream bg-red-50 px-4 py-3 text-xs font-bold text-gnd-red">{formatChatError(messageState.error)}</p>
          )}

          <BookingStack conversation={activeConversation} onBookingChanged={onBookingChanged} />

          <form className="flex gap-3 border-t border-gnd-cream bg-white p-3 sm:p-4" onSubmit={handleSend}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('chat.placeholder')}
              className="min-w-0 flex-1 rounded-lg border border-gnd-cream bg-white px-4 py-3 text-sm font-bold text-gnd-dark outline-none focus:border-gnd-red"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-900/10 transition hover:bg-gnd-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              <span className="hidden sm:inline">{sending ? t('states.saving') : t('chat.send')}</span>
            </button>
          </form>
        </>
      ) : (
        <div className="grid flex-1 place-items-center p-10 text-center">
          <p className="text-sm font-bold text-gnd-gray">{t('chat.selectConversation')}</p>
        </div>
      )}
    </>
  );
}

function ChatHeader({ conversation, onReport }) {
  return (
    <header className="border-b border-gnd-cream bg-white p-4">
      <div className="flex min-w-0 items-center justify-between gap-3 pr-12 lg:pr-0">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar conversation={conversation} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-gnd-dark">{conversation.otherPartyName}</h2>
          </div>
        </div>
        <button type="button" onClick={onReport} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark hover:text-gnd-red">
          <Flag size={14} />
          Report
        </button>
      </div>   
    </header>
  );
}

function buildConversationReportTarget(conversation) {
  return {
    title: 'Report chat',
    targetType: 'message',
    targetId: conversation.primaryConversationId || conversation.id,
    reportedUserId: conversation.otherPartyId,
    evidenceMetadata: {
      conversation_id: conversation.primaryConversationId || '',
      other_party_name: conversation.otherPartyName || '',
      last_message: conversation.lastMessage || '',
    },
  };
}

function BookingStack({ conversation, onBookingChanged }) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const bookings = (conversation.bookings || [])
    .filter((booking) => {
      const status = String(booking.status || '').toLowerCase();
      return booking.bookingId && status !== 'completed' && status !== 'cancelled' && status !== 'canceled';
    })
    .filter((booking, index, all) => all.findIndex((item) => item.bookingId === booking.bookingId) === index);

  if (!bookings.length) return null;

  const startEdit = (booking) => {
    setError('');
    setEditingId(booking.bookingId);
    setForm({
      lessonDate: booking.lessonDate || '',
      startTime: booking.startTime || '',
      durationHours: booking.durationHours || 1,
      groupSize: booking.groupSize || 1,
      skillLevel: booking.skillLevel || '',
      locationDetails: booking.locationDetails || '',
    });
  };

  const saveEdit = async (booking) => {
    const validationError = validateBookingEdit(form, booking, bookings);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingId(booking.bookingId);
    setError('');
    const nextStatus = booking.isLearner ? BOOKING_STATUS.pendingInstructor : BOOKING_STATUS.pendingLearner;
    const result = await updateBookingRequest({
      bookingId: booking.bookingId,
      conversationId: conversation.primaryConversationId,
      updates: {
        ...form,
        status: nextStatus,
      },
      summary: buildBookingUpdateSummary(booking, form, nextStatus),
    });
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingId('');
    await onBookingChanged?.();
  };

  const confirmBooking = async (booking) => {
    setSavingId(booking.bookingId);
    setError('');
    const result = await updateBookingRequest({
      bookingId: booking.bookingId,
      conversationId: conversation.primaryConversationId,
      updates: { status: BOOKING_STATUS.confirmed },
      summary: `Booking request confirmed\nService: ${booking.title || 'Session'}\nDate: ${formatBookingDateForChat(booking.lessonDate)}\nStart time: ${booking.startTime || '-'}\nGroup size: ${booking.groupSize || 1} pax`,
    });
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    await onBookingChanged?.();
  };

  const cancelBooking = async (booking, reason) => {
    setSavingId(booking.bookingId);
    setError('');
    const result = await updateBookingRequest({
      bookingId: booking.bookingId,
      conversationId: conversation.primaryConversationId,
      updates: { status: BOOKING_STATUS.cancelled, cancelledAt: new Date().toISOString() },
      summary: `Booking request cancelled\nService: ${booking.title || 'Session'}\nDate: ${formatBookingDateForChat(booking.lessonDate)}\nStart time: ${booking.startTime || '-'}\nGroup size: ${booking.groupSize || 1} pax\nReason: ${reason || '-'}`,
    });
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setCancelTarget(null);
    setCancelReason('');
    await onBookingChanged?.();
  };

  const editingBooking = bookings.find((booking) => booking.bookingId === editingId) || null;

  return (
    <div className="border-t border-gnd-cream bg-white px-3 py-2 sm:px-4">
      <div className="max-h-60 space-y-2 overflow-auto">
        {bookings.map((booking) => (
          (() => {
          const canConfirm = canConfirmBooking(booking);
          return (
          <div
            key={booking.bookingId}
            className="rounded-lg border border-gnd-cream bg-gnd-cream/30 px-3 py-2 text-xs font-black text-gnd-gray"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-[120px] truncate text-gnd-dark">{booking.title}</span>
              {booking.location && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                  <CalendarDays size={13} className="text-gnd-red" />
                  {booking.location}
                </span>
              )}
              {booking.startTime && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                  <Clock size={13} className="text-gnd-red" />
                  {booking.startTime}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1">
                <Users size={13} className="text-gnd-red" />
                {t('workspace.sessions.groupSize', { count: booking.groupSize || 1 })}
              </span>
              {booking.status && (
                <span className="rounded-md bg-gnd-dark px-2 py-1 text-white">{booking.status}</span>
              )}
              {canConfirm && (
                <button type="button" onClick={() => confirmBooking(booking)} disabled={savingId === booking.bookingId} className="inline-flex items-center gap-1 rounded-md bg-gnd-red px-2 py-1 text-white disabled:opacity-60">
                  <CheckCircle2 size={13} />
                  Confirm
                </button>
              )}
              <button type="button" onClick={() => startEdit(booking)} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-gnd-dark">
                <Pencil size={13} />
                Edit
              </button>
              <button type="button" onClick={() => setCancelTarget(booking)} disabled={savingId === booking.bookingId} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-gnd-red disabled:opacity-60">
                <Ban size={13} />
                Cancel
              </button>
            </div>
          </div>
          );
          })()
        ))}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-gnd-red">{error}</p>}
      </div>
      {editingBooking && (
        <BookingEditModal
          booking={editingBooking}
          form={form}
          setForm={setForm}
          onClose={() => setEditingId('')}
          onSave={() => saveEdit(editingBooking)}
          saving={savingId === editingBooking.bookingId}
        />
      )}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          reason={cancelReason}
          setReason={setCancelReason}
          onClose={() => {
            setCancelTarget(null);
            setCancelReason('');
          }}
          onConfirm={() => cancelBooking(cancelTarget, cancelReason)}
          saving={savingId === cancelTarget.bookingId}
        />
      )}
    </div>
  );
}

function canConfirmBooking(booking) {
  const status = String(booking.status || '').toLowerCase();
  if (booking.isLearner) return status === BOOKING_STATUS.pendingLearner.toLowerCase();
  return status === BOOKING_STATUS.pending.toLowerCase() || status === BOOKING_STATUS.pendingInstructor.toLowerCase();
}

function validateBookingEdit(form, booking, bookings) {
  if (!form.lessonDate || !form.startTime) return 'Choose a date and start time before saving.';
  if (form.lessonDate < new Date().toISOString().slice(0, 10)) return 'Booking date cannot be in the past.';

  const start = parseChatTimeToMinutes(form.startTime);
  const end = start + (Math.max(Number(form.durationHours) || 1, 1) * 60);
  if (start === null || end <= start) return 'Choose a valid start time and duration.';

  const hasOverlap = bookings.some((item) => {
    if (item.bookingId === booking.bookingId) return false;
    const status = String(item.status || '').toLowerCase();
    if (['cancelled', 'canceled', 'completed'].includes(status)) return false;
    if (item.lessonDate !== form.lessonDate) return false;

    const otherStart = parseChatTimeToMinutes(item.startTime);
    const otherEnd = otherStart + (Math.max(Number(item.durationHours) || 1, 1) * 60);
    return otherStart !== null && start < otherEnd && end > otherStart;
  });

  return hasOverlap ? 'This time overlaps with another active booking in this chat.' : '';
}

function parseChatTimeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function buildBookingUpdateSummary(booking, form, nextStatus) {
  return [
    'Booking request updated',
    `Service: ${booking.title || 'Session'}`,
    `Date: ${formatBookingDateForChat(form.lessonDate)}`,
    `Start time: ${form.startTime || '-'}`,
    `Duration: ${Number(form.durationHours) || 1} ${Number(form.durationHours) === 1 ? 'hour' : 'hours'}`,
    `Group size: ${Number(form.groupSize) || 1} pax`,
    `Skill level: ${form.skillLevel || '-'}`,
    `Location: ${form.locationDetails || '-'}`,
    `Status: ${nextStatus}`,
  ].join('\n');
}

function BookingEditModal({ booking, form, setForm, onClose, onSave, saving }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gnd-dark/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">Booking request</p>
            <h3 className="mt-1 text-xl font-black text-gnd-dark">Edit details</h3>
            <p className="mt-1 text-sm font-bold text-gnd-gray">{booking.title || 'Session'}</p>
          </div>
          <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black text-gnd-gray">
            Date
            <input type="date" value={form.lessonDate || ''} onChange={(event) => setForm((current) => ({ ...current, lessonDate: event.target.value }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark" />
          </label>
          <label className="grid gap-1 text-xs font-black text-gnd-gray">
            Start time
            <input type="time" value={form.startTime || ''} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark" />
          </label>
          <label className="grid gap-1 text-xs font-black text-gnd-gray">
            Duration
            <select value={form.durationHours || 1} onChange={(event) => setForm((current) => ({ ...current, durationHours: Number(event.target.value) }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark">
              {[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{hours}h</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-gnd-gray">
            Group size
            <select value={form.groupSize || 1} onChange={(event) => setForm((current) => ({ ...current, groupSize: Number(event.target.value) }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark">
              {[1, 2, 3, 4].map((size) => <option key={size} value={size}>{size} pax</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-gnd-gray">
            Skill level
            <input value={form.skillLevel || ''} onChange={(event) => setForm((current) => ({ ...current, skillLevel: event.target.value }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark" />
          </label>
          <label className="grid gap-1 text-xs font-black text-gnd-gray sm:col-span-2">
            Location
            <input value={form.locationDetails || ''} onChange={(event) => setForm((current) => ({ ...current, locationDetails: event.target.value }))} className="rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark" placeholder="-" />
          </label>
        </div>

        <p className="mt-4 rounded-lg bg-gnd-cream px-3 py-2 text-xs font-bold text-gnd-gray">
          Saving an edit sends the request back to the other party for confirmation.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-2 text-xs font-black text-gnd-dark">Close</button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-4 py-2 text-xs font-black text-white disabled:opacity-60">
            <Save size={14} />
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelBookingModal({ booking, reason, setReason, onClose, onConfirm, saving }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gnd-dark/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">Cancel request</p>
            <h3 className="mt-1 text-xl font-black text-gnd-dark">{booking.title || 'Session'}</h3>
          </div>
          <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <label className="mt-5 grid gap-2 text-xs font-black text-gnd-gray">
          Reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="resize-none rounded-lg border border-gnd-cream px-3 py-2 text-sm text-gnd-dark" placeholder="-" />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-2 text-xs font-black text-gnd-dark">Close</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-4 py-2 text-xs font-black text-white disabled:opacity-60">
            <Ban size={14} />
            {saving ? 'Cancelling' : 'Cancel request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBookingDateForChat(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}-${month}-${year}` : String(value);
}

function MessageBubble({ message, conversation, attendanceActionId, onAttendanceAction }) {
  if (isLifecycleSystemMessage(message)) {
    const booking = findMessageBooking(conversation, message);
    const isCompletionPrompt = isCompletionPromptMessage(message);
    const canRespond = Boolean(isCompletionPrompt && booking?.isLearner && booking.status === BOOKING_STATUS.confirmed);
    const contactHref = buildCsContactHref(booking, message);
    const body = formatCompletionPromptBody(message, booking);

    return (
      <div className="flex justify-center">
        <div className="w-full max-w-xl rounded-xl border border-gnd-cream bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-gnd-cream px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-red">
              <MessageSquare size={13} />
              GuideNextdoor system
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-gnd-gray/60">{message.displayTime}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-gnd-dark">{body}</p>
          {isCompletionPrompt && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canRespond || attendanceActionId === `${message.id}:confirm`}
                onClick={() => onAttendanceAction?.(message, 'confirm')}
                className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                {attendanceActionId === `${message.id}:confirm` ? 'Saving' : 'Confirm completed'}
              </button>
              <button
                type="button"
                disabled={!canRespond || attendanceActionId === `${message.id}:decline`}
                onClick={() => onAttendanceAction?.(message, 'decline')}
                className="inline-flex items-center gap-2 rounded-lg border border-gnd-cream bg-white px-3 py-2 text-xs font-black text-gnd-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban size={14} />
                {attendanceActionId === `${message.id}:decline` ? 'Saving' : 'Decline attendance'}
              </button>
              <a
                href={contactHref}
                className="inline-flex items-center gap-2 rounded-lg bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark hover:text-gnd-red"
              >
                <Headphones size={14} />
                Contact CS
              </a>
            </div>
          )}
          {isCompletionPrompt && !canRespond && (
            <p className="mt-3 text-xs font-bold text-gnd-gray">This completion check has already been answered or is not assigned to your account.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-lg px-4 py-3 shadow-sm ${
        message.isMine ? 'bg-gnd-red text-white' : 'border border-gnd-cream bg-white text-gnd-dark'
      }`}>
        {!message.isMine && <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{message.senderName}</p>}
        <p className="whitespace-pre-wrap text-sm font-bold leading-6">{message.body}</p>
        <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${message.isMine ? 'text-white/70' : 'text-gnd-gray/60'}`}>
          {message.displayTime}
        </p>
      </div>
    </div>
  );
}

function formatCompletionPromptBody(message, booking) {
  const learnerName = message.metadata?.learner_name || booking?.learnerName || 'there';
  return String(message.body || '').replace(/^Learner,/m, `Hi ${learnerName},`);
}

function isCompletionPromptMessage(message) {
  return message.messageType === 'booking_completion_prompt'
    || message.metadata?.lifecycle_event === 'booking_completion_prompt'
    || String(message.body || '').startsWith('Session completion check');
}

function isLifecycleSystemMessage(message) {
  return isCompletionPromptMessage(message)
    || message.messageType === 'booking_auto_completed'
    || message.metadata?.lifecycle_event === 'booking_auto_completed'
    || String(message.body || '').startsWith('Session marked as completed automatically');
}

function findMessageBooking(conversation, message) {
  const bookingId = message?.bookingId || message?.metadata?.booking_id;
  return (conversation?.bookings || []).find((booking) => booking.bookingId === bookingId) || null;
}

function buildCsContactHref(booking, message) {
  const subject = encodeURIComponent(`GuideNextdoor session support ${booking?.bookingId ? `#${booking.bookingId.slice(0, 8)}` : ''}`);
  const body = encodeURIComponent([
    'Hi GuideNextdoor CS,',
    '',
    'I need help with this session completion check.',
    `Booking ID: ${booking?.bookingId || message?.bookingId || '-'}`,
    `Service: ${booking?.title || '-'}`,
    `Date: ${formatBookingDateForChat(booking?.lessonDate)}`,
    '',
    'Issue:',
  ].join('\n'));
  return `mailto:support@guidenextdoor.com?subject=${subject}&body=${body}`;
}

function formatChatError(error) {
  if (error === 'account_suspended') {
    return 'Your account is currently read-only. You can still message GuideNextdoor support.';
  }
  return error;
}

function Avatar({ conversation }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gnd-cream text-gnd-red">
      {conversation.avatarUrl ? (
        <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <MessageSquare size={20} />
      )}
    </span>
  );
}
