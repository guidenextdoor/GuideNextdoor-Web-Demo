import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Briefcase, Plus, Clock, MapPin, Edit, Trash2 } from 'lucide-react';
import { fetchInstructorSchedule, deleteInstructorService, createInstructorService, updateInstructorService, createInstructorCredential } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import ServiceModal from '../../components/instructor/ServiceModal';
import CredentialModal from '../../components/instructor/CredentialModal';

const getServiceStatusMeta = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') {
    return {
      label: 'Approved',
      className: 'border-green-100 bg-green-50 text-green-600',
    };
  }
  if (normalized === 'rejected') {
    return {
      label: 'Rejected',
      className: 'border-red-100 bg-red-50 text-gnd-red',
    };
  }
  if (normalized === 'needs info' || normalized === 'needs_info' || normalized === 'needs_information') {
    return {
      label: 'Needs info',
      className: 'border-purple-100 bg-purple-50 text-purple-700',
    };
  }
  return {
    label: 'Submitted',
    className: 'border-amber-100 bg-amber-50 text-amber-700',
  };
};

export default function InstructorServices() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], credentials: [], error: null, coach: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [feedback, setFeedback] = useState({ error: '', notice: '' });

  const load = async () => {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchInstructorSchedule();
    setState({ 
      loading: false, 
      data: result.data?.services || [], 
      credentials: result.data?.credentials || [],
      coach: result.data?.coach || null,
      error: result.error 
    });
  };

  useEffect(() => {
    let cancelled = false;

    fetchInstructorSchedule().then((result) => {
      if (cancelled) return;
      setState({
        loading: false,
        data: result.data?.services || [],
        credentials: result.data?.credentials || [],
        coach: result.data?.coach || null,
        error: result.error,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const formatCurrency = (amount, currency = 'USD') => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
    return `${currency} ${formatted}`;
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setFeedback({ error: '', notice: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service) => {
    setEditingService(service);
    setFeedback({ error: '', notice: '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      await deleteInstructorService(serviceId);
      load();
    }
  };

  const handleSave = async (formData) => {
    setFeedback({ error: '', notice: '' });
    let result;
    if (editingService) {
      result = await updateInstructorService(editingService.id, formData);
    } else {
      result = await createInstructorService(formData);
    }
    if (result?.error) {
      setFeedback({ error: 'We could not submit the service. Please try again.', notice: '' });
      return result;
    }
    setFeedback({
      error: '',
      notice: editingService
        ? 'Service changes submitted. GuideNextdoor staff will review the updated details before the service is shown publicly.'
        : 'Service application submitted. GuideNextdoor staff will review it before it is shown publicly.',
    });
    load();
    return result;
  };

  const handleCredentialSave = async (formData) => {
    setFeedback({ error: '', notice: '' });
    const result = await createInstructorCredential({
      ...formData,
      instructorId: state.coach?.id,
    });
    if (result?.error) {
      setFeedback({ error: 'We could not submit the credential. Please check the details and try again.', notice: '' });
      return result;
    }
    setFeedback({
      error: '',
      notice: 'Credential submitted. GuideNextdoor staff will review it before it appears on your public profile.',
    });
    await load();
    return result;
  };

  const credentialsByActivity = groupCredentialsByActivity(state.credentials || []);

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.services.eyebrow')}
      title={t('workspace.services.title')}
      subtitle={t('workspace.services.subtitle')}
    >
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setFeedback({ error: '', notice: '' });
            setIsCredentialModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-gnd-dark px-5 py-3 text-sm font-black text-white shadow-xl shadow-slate-900/10 transition-all hover:bg-black active:scale-[0.98]"
        >
          <Award size={18} />
          Add credential
        </button>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98]"
        >
          <Plus size={20} />
          {t('workspace.services.addService')}
        </button>
      </div>

      {feedback.error && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">
          {feedback.error}
        </p>
      )}
      {feedback.notice && (
        <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          {feedback.notice}
        </p>
      )}

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
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${getServiceStatusMeta(service.status).className}`}>
                      {getServiceStatusMeta(service.status).label}
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

      <section className="mt-8 rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-gnd-dark">Credentials</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-gnd-gray">Add more qualifications under each activity. Approved credentials appear on your public profile.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCredentialModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark hover:text-gnd-red"
          >
            <Plus size={16} />
            Add credential
          </button>
        </div>

        {(state.credentials || []).length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {credentialsByActivity.map((group) => (
              <article key={group.key} className="rounded-lg border border-gnd-cream">
                <div className="flex items-center justify-between gap-3 border-b border-gnd-cream bg-gnd-cream/40 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-gnd-dark">{group.title}</h3>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{group.items.length} credential{group.items.length === 1 ? '' : 's'}</p>
                  </div>
                  <Award className="shrink-0 text-gnd-red" size={18} />
                </div>
                <div className="divide-y divide-gnd-cream">
                  {group.items.map((credential) => {
                    const meta = getServiceStatusMeta(credential.status);
                    return (
                      <div key={credential.id} className="grid gap-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black leading-5 text-gnd-dark">{credential.qualification || 'Credential'}</p>
                          <span className={`shrink-0 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${meta.className}`}>{meta.label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gnd-gray">
                          {credential.attainmentYear && <span>{credential.attainmentYear}</span>}
                          {credential.rawCertificateUrl && <span>Certificate uploaded</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-gnd-cream bg-gnd-cream/30 p-6 text-center">
            <Award className="mx-auto text-gnd-gray" size={30} />
            <p className="mt-3 text-sm font-black text-gnd-dark">No extra credentials submitted yet.</p>
            <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Your service credential is already reviewed with each service. Add extra credentials here when you have more qualifications for the same activity.</p>
          </div>
        )}
      </section>

      <ServiceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        service={editingService}
        instructorId={state.coach?.id}
      />
      <CredentialModal
        isOpen={isCredentialModalOpen}
        onClose={() => setIsCredentialModalOpen(false)}
        onSave={handleCredentialSave}
        instructorId={state.coach?.id}
      />
    </InstructorDashboardLayout>
  );
}

function groupCredentialsByActivity(credentials) {
  const groups = new Map();
  credentials.forEach((credential) => {
    const key = credential.activityId || credential.activityKey || credential.title || 'Other';
    if (!groups.has(key)) groups.set(key, { key, title: credential.title || 'Other', items: [] });
    groups.get(key).items.push(credential);
  });
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
