import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { fetchCurrentInstructorProfile, getCurrentSession } from '../../lib/database';

const instructorGateCache = new Map();

export default function DashboardView() {
  const { i18n, t } = useTranslation();
  const session = getCurrentSession();
  const sessionUserId = session?.user?.id || '';
  const cachedGate = sessionUserId ? instructorGateCache.get(sessionUserId) : null;
  const [state, setState] = useState({
    loading: Boolean(session) && !cachedGate,
    hasInstructorProfile: Boolean(cachedGate?.hasInstructorProfile),
  });

  useEffect(() => {
    let cancelled = false;

    if (!sessionUserId) return undefined;

    fetchCurrentInstructorProfile().then((result) => {
      if (cancelled) return;
      const hasInstructorProfile = Boolean(result.data);
      instructorGateCache.set(sessionUserId, { hasInstructorProfile });
      setState({ loading: false, hasInstructorProfile });
    });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  if (!session) {
    return <Navigate to={`/${i18n.language}/login`} replace />;
  }

  if (state.loading) {
    return <div className="mx-auto max-w-7xl px-5 py-20 text-gnd-gray md:px-8">{t('states.loadingDatabase')}</div>;
  }

  if (!state.hasInstructorProfile) {
    return <Navigate to={`/${i18n.language}/explore`} replace />;
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
