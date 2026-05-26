import { Link } from 'react-router-dom';
import { DatabaseZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { databaseStatus } from '../lib/database';

export default function Footer() {
  const { t, i18n } = useTranslation();

  return (
    <footer className="bg-gnd-dark px-5 py-10 text-white md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-black text-gnd-dark">GN</span>
            <span className="text-lg font-black">GuideNextdoor</span>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/62">{t('footer.desc')}</p>
        </div>

        <div className="flex flex-col gap-4 text-sm text-white/62 md:items-end">
          <div className="flex flex-wrap gap-4">
            <Link to={`/${i18n.language}/explore`} className="transition hover:text-white">{t('nav.explore')}</Link>
            <Link to={`/${i18n.language}/sessions`} className="transition hover:text-white">{t('nav.sessions')}</Link>
            <Link to={`/${i18n.language}/messages`} className="transition hover:text-white">{t('nav.messages')}</Link>
          </div>
          <div className="flex items-center gap-2">
            <DatabaseZap size={16} />
            <span>{databaseStatus.hasConfig ? t('footer.databaseReady') : t('footer.databaseMissing')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
