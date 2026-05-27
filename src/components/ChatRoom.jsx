import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, Inbox, MessageSquare, Send, Users, X } from 'lucide-react';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from '../lib/database';

export default function ChatRoom() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, conversations: [], error: null });
  const [activeId, setActiveId] = useState('');
  const [messageState, setMessageState] = useState({ loading: true, messages: [], error: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [messageReloadKey, setMessageReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchConversations()
      .then((result) => {
        if (cancelled) return;
        const conversations = result.data || [];
        setState({ loading: false, conversations, error: result.error });
        setActiveId((current) => current || conversations[0]?.id || '');
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, conversations: [], error: error.message || String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeConversation || !body || sending) return;

    setSending(true);
    const result = await sendConversationMessage({
      conversationId: activeConversation.primaryConversationId,
      bookingId: activeConversation.bookingId,
      text: body,
    });
    setSending(false);

    if (result.error) {
      setMessageState((current) => ({ ...current, error: result.error }));
      return;
    }

    setDraft('');
    const refreshed = await fetchConversationMessages(activeConversation);
    setMessageState({ loading: false, messages: refreshed.data || [], error: refreshed.error });
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
              className={`flex w-full gap-3 rounded-lg p-3 text-left transition ${
                conversation.id === activeId ? 'bg-white shadow-sm' : 'hover:bg-white/70'
              }`}
              onClick={() => {
                setActiveId(conversation.id);
                setMessageState({ loading: true, messages: [], error: null });
                setMessageReloadKey((key) => key + 1);
                setCompactOpen(true);
              }}
            >
              <Avatar conversation={conversation} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-gnd-dark">{conversation.otherPartyName}</span>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-gnd-gray/60">{conversation.displayDate}</span>
                </span>
                <span className="mt-1 block truncate text-xs font-black uppercase tracking-wider text-gnd-red">{conversation.title}</span>
                <span className="mt-1 block truncate text-sm font-bold text-gnd-gray">{conversation.lastMessage}</span>
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
        />
      </div>

      {compactOpen && activeConversation && (
        <div className="fixed inset-0 z-50 bg-gnd-dark/45 p-3 lg:hidden">
          <div className="flex h-full overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex min-w-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => setCompactOpen(false)}
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
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChatPanel({ activeConversation, messageState, draft, setDraft, sending, handleSend }) {
  const { t } = useTranslation();

  return (
    <>
      {activeConversation ? (
        <>
          <ChatHeader conversation={activeConversation} />
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
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>

          {messageState.error && (
            <p className="border-t border-gnd-cream bg-red-50 px-4 py-3 text-xs font-bold text-gnd-red">{messageState.error}</p>
          )}

          <BookingStack conversation={activeConversation} />

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

function ChatHeader({ conversation }) {
  return (
    <header className="border-b border-gnd-cream bg-white p-4">
      <div className="flex min-w-0 items-center gap-3 pr-12 lg:pr-0">
        <Avatar conversation={conversation} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black text-gnd-dark">{conversation.otherPartyName}</h2>
        </div>
      </div>   
    </header>
  );
}

function BookingStack({ conversation }) {
  const { t } = useTranslation();
  const bookings = (conversation.bookings || [])
    .filter((booking) => {
      const status = String(booking.status || '').toLowerCase();
      return booking.bookingId && status !== 'completed' && status !== 'cancelled' && status !== 'canceled';
    })
    .filter((booking, index, all) => all.findIndex((item) => item.bookingId === booking.bookingId) === index);

  if (!bookings.length) return null;

  return (
    <div className="border-t border-gnd-cream bg-white px-3 py-2 sm:px-4">
      <div className="max-h-32 space-y-2 overflow-auto">
        {bookings.map((booking) => (
          <div
            key={booking.bookingId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-gnd-cream bg-gnd-cream/30 px-3 py-2 text-xs font-black text-gnd-gray"
          >
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
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
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

function Avatar({ conversation }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gnd-cream text-gnd-red">
      {conversation.avatarUrl ? (
        <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <MessageSquare size={20} />
      )}
    </span>
  );
}
