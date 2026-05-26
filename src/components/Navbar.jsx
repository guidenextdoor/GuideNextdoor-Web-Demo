import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Compass, Globe2, LayoutDashboard, LogIn, Menu, MessageSquare, UserRoundPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const navItems = [
  { key: 'home', path: '', icon: LayoutDashboard },
  { key: 'explore', path: 'explore', icon: Compass },
  { key: 'destinations', path: 'destinations', icon: Globe2 },
  { key: 'sessions', path: 'sessions', icon: CalendarDays },
  { key: 'messages', path: 'messages', icon: MessageSquare },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const basePath = `/${i18n.language}`;
  const toPath = (path) => `${basePath}${path ? `/${path}` : ''}`;

  const handleLanguageChange = (newLang) => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    pathSegments[0] = newLang;
    navigate(`/${pathSegments.join('/')}${location.search}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-gnd-cream/92 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to={basePath} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gnd-red text-sm font-black text-white">GN</span>
          <span className="text-base font-black tracking-tight text-gnd-dark">GuideNextdoor</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map(({ key, path, icon: Icon }) => (
            <Link
              key={key}
              to={toPath(path)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
            >
              <Icon size={16} />
              {t(`nav.${key}`)}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
          >
            <Globe2 size={16} />
            {t('nav.language')}
          </button>
          <Link
            to={toPath('login')}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
          >
            <LogIn size={16} />
            {t('nav.login')}
          </Link>
          <Link
            to={toPath('become-guide')}
            className="flex items-center gap-2 rounded-lg bg-gnd-dark px-4 py-2 text-sm font-bold text-white transition hover:bg-gnd-red"
          >
            <UserRoundPlus size={16} />
            {t('nav.becomeGuide')}
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg bg-white p-2 text-gnd-dark md:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label={t('nav.openMenu')}
        >
          <Menu size={22} />
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-gnd-dark/40 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-[84vw] max-w-sm bg-gnd-cream p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between">
              <span className="text-lg font-black">{t('nav.menu')}</span>
              <button
                type="button"
                className="rounded-lg bg-white p-2"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={t('nav.closeMenu')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {[...navItems, { key: 'login', path: 'login', icon: LogIn }, { key: 'becomeGuide', path: 'become-guide', icon: UserRoundPlus }].map(({ key, path, icon: Icon }) => (
                <Link
                  key={key}
                  to={toPath(path)}
                  className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-bold text-gnd-dark"
                >
                  <Icon size={18} />
                  {t(`nav.${key}`)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
