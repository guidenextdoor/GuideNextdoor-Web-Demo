import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCurrentSession } from '../../lib/database';

export default function DashboardView() {
  const { i18n } = useTranslation();
  const session = getCurrentSession();

  if (!session) {
    return <Navigate to={`/${i18n.language}/login`} replace />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gnd-cream/35">
      <main>
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
