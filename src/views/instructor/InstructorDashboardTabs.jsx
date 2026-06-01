import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  UserCircle,
} from 'lucide-react';

export default function InstructorDashboardTabs() {
  const { t, i18n } = useTranslation();
  const basePath = `/${i18n.language}/instructor`;
  const navItems = [
    { to: '', icon: LayoutDashboard, label: t('workspace.overview.title'), end: true },
    { to: 'profile', icon: UserCircle, label: t('profile.aboutTitle') },
    { to: 'posts', icon: ImageIcon, label: t('profile.tabs.posts') },
    { to: 'messages', icon: MessageSquare, label: t('workspace.messages.title') },
    { to: 'schedule', icon: CalendarClock, label: t('workspace.schedule.title') },
  ];

  return (
    <nav aria-label="Instructor workspace">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-gnd-cream/60 p-1 sm:grid-cols-3 xl:grid-cols-5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to ? `${basePath}/${item.to}` : basePath}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black transition sm:text-sm ${
                isActive
                  ? 'bg-white text-gnd-red shadow-sm'
                  : 'text-gnd-gray hover:bg-white/60 hover:text-gnd-dark'
              }`
            }
          >
            {() => (
              <>
                <item.icon size={17} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
