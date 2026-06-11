import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { fetchCurrentInstructorProfile, getCurrentSession } from '../lib/database';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [hasInstructorProfile, setHasInstructorProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const session = getCurrentSession();

    if (!session) {
      Promise.resolve().then(() => {
        if (!cancelled) setHasInstructorProfile(false);
      });
      return () => {
        cancelled = true;
      };
    }

    fetchCurrentInstructorProfile().then((result) => {
      if (!cancelled) setHasInstructorProfile(Boolean(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <footer className="bg-white border-t border-gnd-cream px-5 py-16 text-gnd-dark md:px-8 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gnd-red text-xs font-black text-white">GN</span>
            <span className="text-xl font-black tracking-tighter uppercase italic">GuideNextdoor</span>
          </div>
          <p className="max-w-sm text-sm font-bold leading-relaxed text-gnd-gray">
            {t('footer.desc')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 md:gap-24">
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-red">{t('nav.navigation') || 'Navigation'}</p>
            <nav className="flex flex-col gap-3 text-sm font-black text-gnd-dark">
              <Link to={`/${i18n.language}/explore`} className="transition hover:text-gnd-red">{t('nav.explore')}</Link>
              <Link to={`/${i18n.language}/sessions`} className="transition hover:text-gnd-red">{t('nav.sessions')}</Link>
              <Link to={`/${i18n.language}/become-guide`} className="transition hover:text-gnd-red">{t('nav.becomeGuide')}</Link>
            </nav>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-red">Legal</p>
            <nav className="flex flex-col gap-3 text-sm font-black text-gnd-dark">
              <Link to={`/${i18n.language}/terms`} className="transition hover:text-gnd-red">{t('nav.terms')}</Link>
              <Link to={`/${i18n.language}/privacy`} className="transition hover:text-gnd-red">{t('nav.privacy')}</Link>
            </nav>
          </div>
          {hasInstructorProfile && (
            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-red">{t('nav.instructor') || 'Instructor'}</p>
              <nav className="flex flex-col gap-3 text-sm font-black text-gnd-dark">
                <Link to={`/${i18n.language}/instructor`} className="transition hover:text-gnd-red">{t('nav.instructor')}</Link>
                <Link to={`/${i18n.language}/messages`} className="transition hover:text-gnd-red">{t('nav.messages')}</Link>
              </nav>
            </div>
          )}
        </div>
      </div>
      
      <div className="mx-auto mt-20 max-w-7xl border-t border-gnd-cream pt-8 flex flex-col items-center justify-between gap-6 md:flex-row md:mt-32">
        <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">
          © {new Date().getFullYear()} GuideNextdoor. {t('footer.rights') || 'All rights reserved.'}
        </p>
      </div>
    </footer>
  );
}
