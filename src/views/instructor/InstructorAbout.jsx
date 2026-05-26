import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Briefcase, Clock, MapPin, ShieldCheck, UserCircle } from 'lucide-react';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';

export default function InstructorAbout() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    fetchInstructorSchedule().then((result) => {
      if (!cancelled) {
        setState({ loading: false, data: result.data, error: result.error });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const coach = state.data?.coach;
  const services = state.data?.services || [];

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.about.eyebrow')}
      title={t('workspace.about.title')}
      subtitle={t('workspace.about.subtitle')}
    >
      {state.loading && (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
        </div>
      )}

      {!state.loading && coach && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gnd-cream">
                {coach.avatarUrl ? (
                  <img src={coach.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-gnd-red">
                    <UserCircle size={42} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black text-gnd-dark">{coach.name}</h2>
                  {coach.verified && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-green-600">
                      <ShieldCheck size={13} />
                      {t('explore.verified')}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-gnd-gray">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase size={15} className="text-gnd-red" />
                    {coach.role}
                  </span>
                  {coach.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} className="text-gnd-red" />
                      {coach.location}
                    </span>
                  )}
                  {coach.timezone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={15} className="text-gnd-red" />
                      {coach.timezone}
                    </span>
                  )}
                </div>
                <p className="mt-5 max-w-3xl text-sm font-bold leading-7 text-gnd-gray">
                  {coach.bio || t('workspace.about.bioPending')}
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">
              {t('workspace.about.profileHealth')}
            </p>
            <div className="mt-4 grid gap-3">
              <ProfileItem label={t('workspace.services.title')} value={services.length} />
              <ProfileItem label={t('profile.stats.reviews')} value={coach.stats?.reviewCount || 0} />
              <ProfileItem label={t('profile.stats.likes')} value={coach.stats?.totalLikes || 0} />
              <ProfileItem label={t('profile.stats.sessions')} value={coach.stats?.sessionCount || 0} />
            </div>
          </aside>

          <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-gnd-red" />
              <h2 className="text-lg font-black text-gnd-dark">{t('profile.tabs.credentials')}</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {services.length ? services.map((service) => (
                <article key={service.id} className="rounded-lg border border-gnd-cream bg-gnd-cream/15 p-4">
                  <p className="text-sm font-black text-gnd-dark">{service.title}</p>
                  <p className="mt-1 text-xs font-bold text-gnd-gray">
                    {service.qualification || t('profile.credentials.noQualification')}
                  </p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gnd-red">
                    {service.years || 0} {t('profile.stats.years')}
                  </p>
                </article>
              )) : (
                <p className="text-sm font-bold text-gnd-gray">{t('workspace.about.noServices')}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </InstructorDashboardLayout>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gnd-cream/35 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">{label}</span>
      <span className="text-lg font-black text-gnd-dark">{value}</span>
    </div>
  );
}
