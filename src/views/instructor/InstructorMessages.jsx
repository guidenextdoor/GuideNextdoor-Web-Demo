import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Inbox, ChevronRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchUserMessages } from '../../lib/database';

export default function InstructorMessages() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null });

  useEffect(() => {
    async function load() {
      const result = await fetchUserMessages();
      setState({ 
        loading: false, 
        data: result.data || [], 
        error: result.error 
      });
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">
          {t('workspace.messages.title')}
        </h1>
        <p className="mt-2 text-lg font-bold text-gnd-gray">
          {t('workspace.messages.subtitle')}
        </p>
      </header>

      <div className="grid gap-4">
        {state.loading && (
          <div className="grid h-64 place-items-center rounded-3xl bg-white border border-gnd-cream/30">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
          </div>
        )}

        {!state.loading && state.data.length === 0 && (
          <div className="grid place-items-center rounded-3xl bg-white p-16 border border-gnd-cream/30 shadow-sm">
            <MessageSquare size={48} className="text-gnd-cream mb-4" />
            <h2 className="text-2xl font-black text-gnd-dark">{t('workspace.messages.emptyTitle')}</h2>
            <p className="mt-2 text-gnd-gray font-bold text-center max-w-sm">{t('workspace.messages.emptyBody')}</p>
          </div>
        )}

        {!state.loading && state.data.map((chat) => (
          <article key={chat.id} className="group flex items-center gap-4 rounded-3xl bg-white p-4 border border-gnd-cream/30 shadow-sm transition-all hover:shadow-md md:p-5">
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-gnd-cream grid place-items-center overflow-hidden">
                {chat.avatarUrl ? (
                  <img src={chat.avatarUrl} alt={chat.coachName} className="h-full w-full object-cover" />
                ) : (
                  <MessageSquare size={24} className="text-gnd-red" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-black text-gnd-dark truncate">{chat.coachName}</h2>
                <span className="text-[10px] font-black text-gnd-gray/50 uppercase tracking-widest">{chat.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gnd-cream px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-gnd-red">
                  {chat.title}
                </span>
                <p className="text-sm font-bold text-gnd-gray truncate">{chat.lastMessage}</p>
              </div>
            </div>

            <ChevronRight size={20} className="text-gnd-cream group-hover:text-gnd-red transition-colors" />
          </article>
        ))}
      </div>
    </div>
  );
}
