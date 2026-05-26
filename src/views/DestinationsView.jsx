import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, DatabaseZap, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchLocations } from '../lib/database';

export default function DestinationsView() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null, tableName: '' });

  useEffect(() => {
    let cancelled = false;
    fetchLocations().then((result) => {
      if (!cancelled) setState({ loading: false, data: result.data, error: result.error, tableName: result.tableName });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14"
    >
      <div className="mb-9 max-w-3xl">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('destinations.eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t('destinations.title')}</h1>
        <p className="mt-4 text-base leading-7 text-gnd-gray">{t('destinations.subtitle')}</p>
      </div>

      {state.error && (
        <div className="mb-6 rounded-lg bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-gnd-red">
            <DatabaseZap size={18} />
            <span className="text-sm font-black">{t('states.schemaPending')}</span>
          </div>
          <p className="text-sm leading-6 text-gnd-gray">{t('states.schemaPendingBody', { table: state.tableName })}</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {state.loading && [1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-lg bg-white" />)}
        {!state.loading && !state.error && state.data.map((location) => (
          <Link key={location.id} to={`/${i18n.language}/explore?location=${location.id}`} className="group rounded-lg bg-white p-6">
            <MapPin className="mb-12 text-gnd-red" size={30} />
            <h2 className="text-3xl font-black group-hover:text-gnd-red">{location.name}</h2>
            <p className="mt-2 text-sm font-bold text-gnd-gray">{location.country || t('destinations.countryPending')}</p>
            <div className="mt-8 flex items-center justify-between text-sm font-black">
              <span>{t('destinations.counts', { coaches: location.coachCount, services: location.serviceCount })}</span>
              <ArrowRight size={18} />
            </div>
          </Link>
        ))}
      </div>

      {!state.loading && !state.error && state.data.length === 0 && (
        <div className="rounded-lg bg-white p-10">
          <h2 className="text-2xl font-black">{t('destinations.emptyTitle')}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gnd-gray">{t('destinations.emptyBody')}</p>
        </div>
      )}
    </motion.section>
  );
}
