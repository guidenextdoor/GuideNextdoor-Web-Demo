import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Plus, Inbox, Clock, CheckCircle2, ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchInstructorSchedule } from '../../lib/database';

export default function InstructorServices() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null });

  useEffect(() => {
    async function load() {
      const result = await fetchInstructorSchedule();
      setState({ 
        loading: false, 
        data: result.data?.services || [], 
        error: result.error 
      });
    }
    load();
  }, []);

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">
            {t('profile.tabs.sessions')}
          </h1>
          <p className="mt-2 text-lg font-bold text-gnd-gray">
            {t('becomeGuide.subtitle')}
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-2xl bg-gnd-red px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98]">
          <Plus size={20} />
          {t('becomeGuide.checklist.profile.title')}
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-3xl bg-white border border-gnd-cream/30" />
        ))}

        {!state.loading && state.data.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-3xl bg-white p-16 border border-gnd-cream/30 shadow-sm">
            <Briefcase size={48} className="text-gnd-cream mb-4" />
            <h2 className="text-2xl font-black text-gnd-dark">{t('profile.empty.sessionsTitle')}</h2>
            <p className="mt-2 text-gnd-gray font-bold text-center max-w-sm">{t('profile.empty.sessionsBody')}</p>
          </div>
        )}

        {!state.loading && state.data.map((service) => (
          <article key={service.id} className="group relative flex flex-col overflow-hidden rounded-3xl bg-white transition-all hover:shadow-xl hover:shadow-red-900/5 border border-gnd-cream/30">
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-green-600 border border-green-100">
                      {service.status === 'approved' ? t('explore.verified') : service.status}
                    </span>
                    {service.qualification && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-600 border border-blue-100">
                        {t('profile.tabs.credentials')}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <h2 className="text-xl font-black tracking-tight text-gnd-dark group-hover:text-gnd-red transition-colors truncate">{service.title}</h2>
                    {service.locations.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0 text-[10px] font-black text-gnd-gray/60 uppercase tracking-widest bg-gnd-cream/30 px-2 py-0.5 rounded-md">
                        <MapPin size={10} className="text-gnd-red" />
                        {service.locations[0].name}
                        {service.locations.length > 1 && <span>+{service.locations.length - 1}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gnd-gray">
                {service.description || t('profile.sessions.descriptionPending')}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-gnd-cream/40 pt-6">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{t('profile.sessions.from')}</p>
                  <p className="text-xl font-black text-gnd-dark leading-none">
                    {service.minPrice ? formatCurrency(service.minPrice, service.currency) : t('profile.sessions.pricePending')}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/50">{t('profile.booking.duration')}</p>
                  <div className="flex items-center justify-end gap-1.5 text-sm font-black text-gnd-dark">
                    <Clock size={14} className="text-gnd-red" />
                    {t('profile.sessions.requestBased')}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                type="button"
                className="group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gnd-red py-4 text-sm font-black text-white shadow-lg shadow-red-600/10 transition-all hover:bg-gnd-dark active:scale-[0.98]"
              >
                <Briefcase size={16} />
                {t('workspace.overview.viewAll')}
                <ChevronRight size={16} className="transition-transform group-hover/btn:translate-x-0.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
