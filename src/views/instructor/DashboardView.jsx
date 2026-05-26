import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  CalendarDays, 
  MessageSquare, 
  Briefcase, 
  Image as ImageIcon, 
  UserCircle,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getCurrentSession, signOut } from '../lib/database';

export default function DashboardView() {
  const { t } = useTranslation();
  const session = getCurrentSession();

  if (!session) {
    return <Navigate to="/en/login" replace />;
  }

  const navItems = [
    { to: '', icon: LayoutDashboard, label: t('workspace.overview.title'), end: true },
    { to: 'bookings', icon: CalendarDays, label: t('workspace.sessions.title') },
    { to: 'messages', icon: MessageSquare, label: t('workspace.messages.title') },
    { to: 'services', icon: Briefcase, label: t('profile.tabs.sessions') },
    { to: 'schedule', icon: CalendarDays, label: t('workspace.schedule.title') },
    { to: 'posts', icon: ImageIcon, label: t('profile.tabs.posts') },
    { to: 'profile', icon: UserCircle, label: t('profile.aboutTitle') },
  ];

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-white">
      {/* Sidebar - Hidden on mobile, fixed on md+ */}
      <aside className="hidden w-64 shrink-0 border-r border-gnd-cream bg-white md:block">
        <div className="sticky top-16 flex h-[calc(100vh-64px)] flex-col p-4">
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-black transition-all ${
                    isActive
                      ? 'bg-gnd-red text-white shadow-lg shadow-red-600/20'
                      : 'text-gnd-gray hover:bg-gnd-cream hover:text-gnd-dark'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} />
                  {item.label}
                </div>
                <ChevronRight 
                  size={14} 
                  className={({ isActive }) => isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40 transition-opacity'} 
                />
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-gnd-cream pt-4">
            <button
              onClick={() => {
                signOut();
                window.location.href = '/en/login';
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-gnd-gray transition-colors hover:bg-red-50 hover:text-gnd-red"
            >
              <LogOut size={18} />
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-gnd-cream/30">
        <div className="mx-auto max-w-6xl p-5 md:p-8 lg:p-12">
          <Outlet />
        </div>
      </main>

      {/* Mobile Nav - Fixed bottom */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gnd-cream bg-white px-2 py-3 md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 text-[10px] font-black transition-colors ${
                isActive ? 'text-gnd-red' : 'text-gnd-gray'
              }`
            }
          >
            <item.icon size={20} />
            <span className="truncate max-w-[60px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
