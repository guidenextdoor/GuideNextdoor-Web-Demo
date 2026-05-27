import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Plus, Clock, MapPin, Edit, Trash2 } from 'lucide-react';
import { fetchInstructorSchedule, deleteInstructorService, createInstructorService, updateInstructorService } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import ServiceModal from '../../components/instructor/ServiceModal';

export default function InstructorServices() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null, coach: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const load = async () => {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchInstructorSchedule();
    setState({ 
      loading: false, 
      data: result.data?.services || [], 
      coach: result.data?.coach || null,
      error: result.error 
    });
  };

  useEffect(() => {
    load();
  }, []);

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleDelete = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      await deleteInstructorService(serviceId);
      load();
    }
  };

  const handleSave = async (formData) => {
    if (editingService) {
      await updateInstructorService(editingService.id, formData);
    } else {
      await createInstructorService(formData);
    }
    load();
  };

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.services.eyebrow')}
      title={t('workspace.services.title')}
      subtitle={t('workspace.services.subtitle')}
    >
      <div className="flex justify-end">
        <button 
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98]"
        >
          <Plus size={20} />
          {t('workspace.services.addService')}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {state.loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg border border-gnd-cream bg-white" />
        ))}

        {!state.loading && state.data.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-lg border border-gnd-cream bg-white p-12 shadow-sm sm:p-16">
            <Briefcase size={48} className="text-gnd-cream mb-4" />
            <h2 className="text-2xl font-black text-gnd-dark">{t('profile.empty.sessionsTitle')}</h2>
            <p className="mt-2 text-gnd-gray font-bold text-center max-w-sm">{t('profile.empty.sessionsBody')}</p>
          </div>
        )}

        {!state.loading && state.data.map((service) => (
          <article key={service.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-gnd-cream bg-white transition-all hover:shadow-xl hover:shadow-red-900/5">
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

            <div className="flex border-t border-gnd-cream bg-gnd-cream/10">
               <button
                type="button"
                onClick={() => handleOpenEdit(service)}
                className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black text-gnd-dark transition-colors hover:bg-gnd-cream"
              >
                <Edit size={16} />
                Edit
              </button>
              <div className="w-px bg-gnd-cream"></div>
              <button
                type="button"
                onClick={() => handleDelete(service.id)}
                className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black text-gnd-red transition-colors hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <ServiceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        service={editingService}
        instructorId={state.coach?.id}
      />
    </InstructorDashboardLayout>
  );
}
