import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, DatabaseZap, ShieldCheck, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchCoaches, fetchLocations, fetchServices } from '../lib/database';

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState({ loading: true, coaches: 0, services: 0, locations: 0, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCoaches(), fetchServices(), fetchLocations()]).then(([coaches, services, locations]) => {
      if (cancelled) return;
      setSummary({
        loading: false,
        coaches: coaches.data.length,
        services: services.data.length,
        locations: locations.data.length,
        error: coaches.error || services.error || locations.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = [
    { key: 'coaches', value: summary.coaches, icon: UsersRound },
    { key: 'services', value: summary.services, icon: Compass },
    { key: 'locations', value: summary.locations, icon: ShieldCheck },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16"
    >
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-gnd-red">{t('home.eyebrow')}</p>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl">{t('home.title')}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gnd-gray">{t('home.subtitle')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={`/${i18n.language}/explore`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-6 py-4 text-sm font-black text-white transition hover:bg-gnd-dark">
              {t('home.primaryAction')}
              <ArrowRight size={18} />
            </Link>
            <Link to={`/${i18n.language}/become-guide`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 text-sm font-black text-gnd-dark transition hover:text-gnd-red">
              {t('home.secondaryAction')}
            </Link>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 md:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-gnd-gray">{t('home.opsLabel')}</p>
              <h2 className="mt-2 text-2xl font-black">{t('home.opsTitle')}</h2>
            </div>
            <DatabaseZap className="text-gnd-red" size={30} />
          </div>

          <div className="grid gap-3">
            {metrics.map(({ key, value, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-gnd-cream p-4">
                <div className="flex items-center gap-3">
                  <Icon className="text-gnd-red" size={20} />
                  <span className="text-sm font-bold text-gnd-gray">{t(`home.metrics.${key}`)}</span>
                </div>
                <span className="text-2xl font-black">{summary.loading ? '...' : value}</span>
              </div>
            ))}
          </div>

          {summary.error && (
            <p className="mt-5 rounded-lg bg-gnd-red/10 p-4 text-sm leading-6 text-gnd-red">{t('states.schemaPendingShort')}</p>
          )}
        </div>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {['discover', 'coordinate', 'verify'].map((key) => (
          <section key={key} className="rounded-lg bg-white p-6">
            <p className="mb-10 text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t(`home.pillars.${key}.eyebrow`)}</p>
            <h2 className="text-2xl font-black">{t(`home.pillars.${key}.title`)}</h2>
            <p className="mt-4 text-sm leading-6 text-gnd-gray">{t(`home.pillars.${key}.body`)}</p>
          </section>
        ))}
      </div>
    </motion.section>
  );
}
