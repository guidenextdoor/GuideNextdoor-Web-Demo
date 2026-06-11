import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Globe2, LayoutDashboard, LogIn, LogOut, Menu, Search, Shield, UserCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchCurrentInstructorProfile, fetchCurrentStaffContext, getCurrentSession, signOut } from '../lib/database';

const publicNavItems = [
  { key: 'home', path: '', icon: LayoutDashboard },
  { key: 'explore', path: 'explore', icon: Compass },
  { key: 'sessions', path: 'sessions', icon: Search },
];

const instructorNavItem = { key: 'instructor', path: 'instructor', icon: LayoutDashboard };
const profileNavItem = { key: 'profile', path: 'profile', icon: UserCircle };
const staffNavItem = { key: 'staffPortal', path: 'staff', icon: Shield };

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasInstructorProfile, setHasInstructorProfile] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = getCurrentSession();

  useEffect(() => {
    let cancelled = false;
    const currentSession = getCurrentSession();

    if (!currentSession) {
      Promise.resolve().then(() => {
        if (!cancelled) setHasInstructorProfile(false);
        if (!cancelled) setIsStaff(false);
      });
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      fetchCurrentInstructorProfile(),
      fetchCurrentStaffContext(),
    ]).then(([instructorResult, staffResult]) => {
      if (cancelled) return;
      setHasInstructorProfile(Boolean(instructorResult.data));
      setIsStaff(Boolean(staffResult.data?.isStaff));
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const basePath = `/${i18n.language}`;
  const toPath = (path) => `${basePath}${path ? `/${path}` : ''}`;

  const handleLanguageChange = (newLang) => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    pathSegments[0] = newLang;
    navigate(`/${pathSegments.join('/')}${location.search}`);
  };

  const handleSignOut = () => {
    signOut();
    setHasInstructorProfile(false);
    setIsStaff(false);
    setIsMobileMenuOpen(false);
    navigate(toPath('login'));
  };

  const visibleNavItems = [
    ...publicNavItems,
    ...(session && !hasInstructorProfile ? [profileNavItem] : []),
    ...(isStaff ? [staffNavItem] : []),
    ...(hasInstructorProfile ? [instructorNavItem] : []),
  ];

  const navLabel = (key) => {
    const translated = t(`nav.${key}`);
    return translated === `nav.${key}` ? (key === 'staffPortal' ? 'Staff portal' : key) : translated;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-gnd-cream/92 backdrop-blur-xl border-b border-gnd-dark/5">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link to={basePath} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gnd-red text-sm font-black text-white">GN</span>
            <span className="text-base font-black tracking-tight text-gnd-dark">GuideNextdoor</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map(({ key, path, icon: Icon }) => (
              <Link
                key={key}
                to={toPath(path)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  location.pathname === toPath(path)
                    ? 'bg-gnd-red/10 text-gnd-red'
                    : 'text-gnd-gray hover:bg-white hover:text-gnd-red'
                }`}
              >
                <Icon size={16} />
                {navLabel(key)}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => handleLanguageChange(i18n.language === 'en' ? 'zh-HK' : 'en')}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
            >
              <Globe2 size={16} />
              {i18n.language.toUpperCase()}
            </button>
            {session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
              >
                <LogOut size={16} />
                {t('auth.signOut')}
              </button>
            ) : (
              <Link
                to={toPath('login')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gnd-gray transition hover:bg-white hover:text-gnd-red"
              >
                <LogIn size={16} />
                {t('nav.login')}
              </Link>
            )}
          </div>

          <button
            type="button"
            className="flex items-center justify-center rounded-lg bg-white p-2 text-gnd-dark shadow-sm border border-gnd-dark/5 md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <Menu size={22} />
          </button>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] flex justify-end md:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gnd-dark/60 backdrop-blur-sm transition-opacity duration-300" 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <div 
            className="relative h-full w-[85vw] max-w-sm bg-[#FAF7F4] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-5 border-b border-gnd-dark/5">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gnd-red text-xs font-black text-white">GN</span>
                <span className="text-lg font-black tracking-tight text-gnd-dark">Menu</span>
              </div>
              <button
                type="button"
                className="rounded-full bg-white p-2 text-gnd-gray shadow-sm border border-gnd-dark/5 hover:text-gnd-red transition"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={t('nav.closeMenu')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gnd-gray/60 px-2 mb-3">
                {t('nav.navigation')}
              </div>
              {visibleNavItems.map(({ key, path, icon: Icon }) => (
                <Link
                  key={key}
                  to={toPath(path)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-bold transition ${
                    location.pathname === toPath(path)
                      ? 'bg-gnd-red text-white shadow-lg shadow-gnd-red/20'
                      : 'bg-white text-gnd-dark border border-gnd-dark/5 hover:border-gnd-red/20 hover:bg-gnd-red/5'
                  }`}
                >
                  <Icon size={20} className={location.pathname === toPath(path) ? 'text-white' : 'text-gnd-gray'} />
                  {navLabel(key)}
                </Link>
              ))}

              <div className="h-px bg-gnd-dark/5 my-6" />

              <div className="text-[10px] font-bold uppercase tracking-widest text-gnd-gray/60 px-2 mb-3">
                {t('nav.preferences')}
              </div>
              <button
                onClick={() => handleLanguageChange(i18n.language === 'en' ? 'zh-HK' : 'en')}
                className="w-full flex items-center gap-4 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-gnd-dark border border-gnd-dark/5 transition hover:border-gnd-red/20 hover:bg-gnd-red/5"
              >
                <Globe2 size={20} className="text-gnd-gray" />
                {i18n.language === 'en' ? '繁體中文 (HK)' : 'English (EN)'}
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="p-5 bg-white border-t border-gnd-dark/5 space-y-3">
              {session ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gnd-dark/10 px-4 py-4 text-sm font-bold text-gnd-dark transition hover:bg-gnd-dark/5"
                >
                  <LogOut size={20} />
                  {t('auth.signOut')}
                </button>
              ) : (
                <Link
                  to={toPath('login')}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-3 rounded-xl border-2 border-gnd-dark/10 px-4 py-4 text-sm font-bold text-gnd-dark transition hover:bg-gnd-dark/5"
                >
                  <LogIn size={20} />
                  {t('nav.login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
