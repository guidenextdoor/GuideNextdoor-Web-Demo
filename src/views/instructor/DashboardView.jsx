import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { fetchCurrentInstructorProfile, getCurrentSession } from '../../lib/database';

const instructorGateCache = new Map();

export default function DashboardView() {
  const { i18n } = useTranslation();
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
    return <InstructorDashboardGateSkeleton />;
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

function InstructorDashboardGateSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gnd-cream/35">
      <main>
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
          <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-28 animate-pulse rounded-full bg-gnd-cream" />
                <div className="mt-3 h-8 w-56 animate-pulse rounded-full bg-gnd-cream/80" />
                <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-full bg-gnd-cream/60" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-gnd-cream/60 p-1 sm:grid-cols-3 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="h-10 animate-pulse rounded-md bg-white/80" />
              ))}
            </div>
          </section>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-lg border border-gnd-cream bg-white shadow-sm" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
