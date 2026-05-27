import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChatRoom from '../components/ChatRoom';
import { getCurrentSession } from '../lib/database';

export default function MessagesView() {
  const { t, i18n } = useTranslation();
  const session = getCurrentSession();

  if (!session) {
    return <Navigate to={`/${i18n.language}/login`} replace />;
  }

  return (
    <div className="bg-gnd-cream/35">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        <section className="mb-6 rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('chat.eyebrow')}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gnd-dark sm:text-3xl">{t('chat.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-gnd-gray sm:text-base">{t('chat.subtitle')}</p>
        </section>
        <ChatRoom />
      </main>
    </div>
  );
}
