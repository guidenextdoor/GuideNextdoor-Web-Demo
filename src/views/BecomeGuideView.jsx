import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, IdCard, Loader2, MapPin, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchLanguages, fetchServiceLocations, fetchRefActivities, fetchRefQualifications, submitGuideApplication, uploadApplicationPhoto } from '../lib/database';
import { compressImage } from '../lib/image-utils';

const defaultPricingTier = { skillLevel: 'All Levels', currency: 'HKD', price1: '', extraPersonFee: '' };

const initialForm = {
  legalName: '',
  publicName: '',
  email: '',
  phone: '',
  languageIds: [],
  bio: '',
  profilePhotoUrl: '',
  activityId: '',
  qualificationId: '',
  activityType: '',
  credentialName: '',
  attainmentYear: '',
  certificateUrl: '',
  proofNotes: '',
  serviceTitle: '',
  locationIds: [],
  manualLocation: '',
  serviceLocation: '',
  meetingPoint: '',
  serviceDescription: '',
  minDurationHours: 1,
  skillLevels: [],
  duration: '',
  maxGroupSize: '',
  price: '',
  currency: 'HKD',
  pricing: [defaultPricingTier],
  pricingLater: false,
  availability: '',
  consentReview: false,
};

const steps = [
  { key: 'identity', icon: IdCard },
  { key: 'expertise', icon: Award },
  { key: 'service', icon: MapPin },
  { key: 'review', icon: CalendarDays },
];

export default function BecomeGuideView() {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [allLanguages, setAllLanguages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [languageSearch, setLanguageSearch] = useState('');
  const [qualificationSearch, setQualificationSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showQualificationDropdown, setShowQualificationDropdown] = useState(false);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [certificateUploading, setCertificateUploading] = useState(false);
  const fileInputRef = useRef(null);
  const certificateInputRef = useRef(null);
  const languageDropdownRef = useRef(null);
  const qualificationDropdownRef = useRef(null);

  const currentStep = steps[stepIndex];
  const isFinalStep = stepIndex === steps.length - 1;
  const summaryItems = useMemo(() => buildSummaryItems(form, t), [form, t]);
  const selectedLanguages = allLanguages.filter((language) => form.languageIds.includes(language.id));
  const selectedLocationObjects = allLocations.filter((location) => form.locationIds.includes(location.id));
  const filteredQualifications = qualifications.filter((qualification) => {
    const matchesActivity = !form.activityId || qualification.activity_id === form.activityId;
    const label = qualification.qualification_name || qualification.qualification || '';
    return matchesActivity && label.toLowerCase().includes(qualificationSearch.toLowerCase());
  });
  const filteredLocations = allLocations.filter((location) => {
    const haystack = [
      location.displayName,
      location.name,
      location.district,
      location.region,
      location.country,
      location.countryCode,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(locationSearch.toLowerCase());
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLanguages(),
      fetchServiceLocations(),
      fetchRefActivities(),
      fetchRefQualifications(),
    ]).then(([languageResult, locationResult, activityResult, qualificationResult]) => {
      if (cancelled) return;
      setAllLanguages(languageResult.data || []);
      setAllLocations(locationResult.data || []);
      setActivities(activityResult.data || []);
      setQualifications(qualificationResult.data || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
      if (qualificationDropdownRef.current && !qualificationDropdownRef.current.contains(event.target)) {
        setShowQualificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidation('');
  };

  const updateManualLocation = (value) => {
    setForm((current) => ({ ...current, manualLocation: value }));
    setValidation('');
  };

  const updateActivity = (activityId) => {
    const activity = activities.find((item) => item.id === activityId);
    setForm((current) => ({
      ...current,
      activityId,
      activityType: formatActivityLabel(activity, t),
      qualificationId: '',
      credentialName: '',
    }));
    setQualificationSearch('');
    setValidation('');
  };

  const selectQualification = (qualification) => {
    if (qualification === 'other') {
      setForm((current) => ({ ...current, qualificationId: 'other', credentialName: '' }));
      setQualificationSearch('');
      setShowQualificationDropdown(false);
      setValidation('');
      return;
    }

    const name = qualification.qualification_name || qualification.qualification || '';
    setForm((current) => ({ ...current, qualificationId: qualification.id, credentialName: name }));
    setQualificationSearch(name);
    setShowQualificationDropdown(false);
    setValidation('');
  };

  const toggleLanguage = (id) => {
    setForm((current) => ({
      ...current,
      languageIds: current.languageIds.includes(id)
        ? current.languageIds.filter((languageId) => languageId !== id)
        : [...current.languageIds, id],
    }));
    setValidation('');
  };

  const toggleLocation = (locationId) => {
    const location = allLocations.find((item) => item.id === locationId);
    setForm((current) => {
      const nextLocationIds = current.locationIds.includes(locationId)
        ? current.locationIds.filter((id) => id !== locationId)
        : [...current.locationIds, locationId];
      const nextLocationNames = allLocations
        .filter((item) => nextLocationIds.includes(item.id))
        .map((item) => item.displayName || item.name)
        .filter(Boolean);
      const locationLabel = location?.displayName || location?.name || '';
      if (locationLabel && !nextLocationNames.includes(locationLabel) && nextLocationIds.includes(locationId)) {
        nextLocationNames.push(locationLabel);
      }
      return {
        ...current,
        locationIds: nextLocationIds,
        serviceLocation: nextLocationNames.join(', '),
      };
    });
    setLocationSearch('');
    setShowLocationResults(false);
    setValidation('');
  };

  const addPricingTier = () => {
    setForm((current) => ({
      ...current,
      pricing: [...current.pricing, { skillLevel: 'New Level', currency: current.currency || 'HKD', price1: '', extraPersonFee: '' }],
    }));
    setValidation('');
  };

  const removePricingTier = (index) => {
    setForm((current) => normalizePricingFields({
      ...current,
      pricing: current.pricing.filter((_, itemIndex) => itemIndex !== index),
    }));
    setValidation('');
  };

  const updatePricingTier = (index, field, value) => {
    setForm((current) => normalizePricingFields({
      ...current,
      pricing: current.pricing.map((tier, itemIndex) => (
        itemIndex === index ? { ...tier, [field]: value } : tier
      )),
    }));
    setValidation('');
  };

  const togglePricingLater = (checked) => {
    setForm((current) => normalizePricingFields({ ...current, pricingLater: checked }));
    setValidation('');
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(previewUrl);
    setPhotoUploading(true);
    setValidation('');

    try {
      const compressed = await compressImage(file, { maxWidth: 700, maxHeight: 700, quality: 0.82 });
      const result = await uploadApplicationPhoto(compressed);
      if (result.data) {
        updateField('profilePhotoUrl', result.data);
      } else {
        setValidation(t('becomeGuide.validation.photoUpload'));
      }
    } catch {
      setValidation(t('becomeGuide.validation.photoUpload'));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleCertificatePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setCertificatePreviewUrl(previewUrl);
    setCertificateUploading(true);
    setValidation('');

    try {
      const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 1400, quality: 0.86 });
      const result = await uploadApplicationPhoto(compressed, 'certificates');
      if (result.data) {
        updateField('certificateUrl', result.data);
      } else {
        setValidation(t('becomeGuide.validation.certificateUpload'));
      }
    } catch {
      setValidation(t('becomeGuide.validation.certificateUpload'));
    } finally {
      setCertificateUploading(false);
    }
  };

  const goNext = () => {
    const message = validateStep(stepIndex, form, t);
    if (message) {
      setValidation(message);
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    setValidation('');
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
    setValidation('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = validateStep(stepIndex, form, t);
    if (message) {
      setValidation(message);
      return;
    }

    setStatus('submitting');
    setError('');
    const languageLabels = selectedLanguages.map((language) => t(`languages.${language.code}`) || language.native_name || language.name);
    const servicePayload = normalizeServiceApplication(form, allLocations);
    const result = await submitGuideApplication({
      ...servicePayload,
      languageLabels,
      source: 'platform_homepage',
      submitted_at: new Date().toISOString(),
    });

    if (result.error) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setStatus('success');
    setForm(initialForm);
    setPhotoPreviewUrl('');
    setCertificatePreviewUrl('');
    setQualificationSearch('');
    setLocationSearch('');
    setStepIndex(0);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14"
    >
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('becomeGuide.eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t('becomeGuide.title')}</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-gnd-gray">{t('becomeGuide.subtitle')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-lg bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-gnd-red shadow-sm shadow-red-900/5">{t('becomeGuide.timeEstimate')}</span>
          <span className="rounded-lg bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-gnd-gray shadow-sm shadow-red-900/5">{t('becomeGuide.reviewExpectation')}</span>
        </div>

        <div className="mt-8 grid gap-2 md:grid-cols-4">
          {steps.map((step, index) => (
            <StepButton
              key={step.key}
              step={step}
              index={index}
              stepIndex={stepIndex}
              onSelect={() => {
                if (index <= stepIndex) setStepIndex(index);
              }}
              t={t}
            />
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-white px-4 py-3 text-sm font-bold leading-6 text-gnd-gray shadow-sm shadow-red-900/5">
          {t(`becomeGuide.steps.${currentStep.key}.body`)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 rounded-lg bg-white p-5 shadow-xl shadow-red-900/5 md:p-7">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-gnd-cream pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">
              {t('becomeGuide.stepCounter', { current: stepIndex + 1, total: steps.length })}
            </p>
            <h2 className="mt-1 text-2xl font-black">{t(`becomeGuide.steps.${currentStep.key}.title`)}</h2>
          </div>
        </div>

        {currentStep.key === 'identity' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('becomeGuide.form.legalName')} value={form.legalName} onChange={(value) => updateField('legalName', value)} required privateNote={t('becomeGuide.form.private')} />
            <Field label={t('becomeGuide.form.publicName')} value={form.publicName} onChange={(value) => updateField('publicName', value)} required />
            <Field label={t('becomeGuide.form.email')} type="email" value={form.email} onChange={(value) => updateField('email', value)} required />
            <Field label={t('becomeGuide.form.phone')} value={form.phone} onChange={(value) => updateField('phone', value)} />
            <LanguageMultiSelect
              allLanguages={allLanguages}
              languageSearch={languageSearch}
              selectedLanguages={selectedLanguages}
              selectedIds={form.languageIds}
              showDropdown={showLanguageDropdown}
              dropdownRef={languageDropdownRef}
              setLanguageSearch={setLanguageSearch}
              setShowDropdown={setShowLanguageDropdown}
              toggleLanguage={toggleLanguage}
              t={t}
            />
            <PhotoUpload
              fileInputRef={fileInputRef}
              previewUrl={photoPreviewUrl || form.profilePhotoUrl}
              uploading={photoUploading}
              onChange={handlePhotoChange}
              t={t}
            />
            <TextArea label={t('becomeGuide.form.bio')} value={form.bio} onChange={(value) => updateField('bio', value)} className="md:col-span-2" />
          </div>
        )}

        {currentStep.key === 'expertise' && (
          <div className="grid gap-4 md:grid-cols-2">
            <ActivitySelect
              activities={activities}
              value={form.activityId}
              onChange={updateActivity}
              t={t}
            />
            <QualificationSelect
              dropdownRef={qualificationDropdownRef}
              search={qualificationSearch}
              setSearch={setQualificationSearch}
              showDropdown={showQualificationDropdown}
              setShowDropdown={setShowQualificationDropdown}
              qualifications={filteredQualifications}
              selectedId={form.qualificationId}
              selectedName={form.credentialName}
              onSelect={selectQualification}
              t={t}
            />
            <p className="rounded-lg bg-gnd-cream/60 px-4 py-3 text-xs font-bold leading-5 text-gnd-gray md:col-span-2">
              {t('becomeGuide.form.credentialHelp')}
            </p>
            {form.qualificationId === 'other' && (
              <Field
                label={t('becomeGuide.form.otherCredential')}
                value={form.credentialName}
                onChange={(value) => updateField('credentialName', value)}
                placeholder={t('becomeGuide.form.otherCredentialPlaceholder')}
                required
              />
            )}
            <Field label={t('becomeGuide.form.attainmentYear')} type="number" value={form.attainmentYear} onChange={(value) => updateField('attainmentYear', value)} placeholder="2021" />
            <CertificateUpload
              fileInputRef={certificateInputRef}
              previewUrl={certificatePreviewUrl || form.certificateUrl}
              uploading={certificateUploading}
              onChange={handleCertificatePhotoChange}
              t={t}
            />
            <p className="rounded-lg bg-gnd-cream/60 px-4 py-3 text-xs font-bold leading-5 text-gnd-gray md:col-span-2">
              {t('becomeGuide.form.certificatePrivacy')}
            </p>
            <TextArea label={t('becomeGuide.form.proofNotes')} value={form.proofNotes} onChange={(value) => updateField('proofNotes', value)} className="md:col-span-2" />
          </div>
        )}

        {currentStep.key === 'service' && (
          <div className="grid gap-8">
            <section className="grid gap-4 md:grid-cols-2">
              <h3 className="border-b border-gnd-cream pb-2 text-lg font-black text-gnd-dark md:col-span-2">{t('becomeGuide.form.basicDetails')}</h3>
              <Field label={t('becomeGuide.form.serviceTitle')} value={form.serviceTitle} onChange={(value) => updateField('serviceTitle', value)} placeholder={t('becomeGuide.form.serviceTitlePlaceholder')} required />
              <Field label={t('becomeGuide.form.minDurationHours')} type="number" value={form.minDurationHours} onChange={(value) => updateField('minDurationHours', value)} placeholder="1" />
              <TextArea label={t('becomeGuide.form.serviceDescription')} value={form.serviceDescription} onChange={(value) => updateField('serviceDescription', value)} className="md:col-span-2" />
            </section>

            <CoverageAreas
              selectedLocations={selectedLocationObjects}
              locationSearch={locationSearch}
              setLocationSearch={setLocationSearch}
              showLocationResults={showLocationResults}
              setShowLocationResults={setShowLocationResults}
              filteredLocations={filteredLocations}
              selectedIds={form.locationIds}
              onToggle={toggleLocation}
              manualLocation={form.manualLocation}
              onManualLocationChange={updateManualLocation}
              t={t}
            />

            <PricingTiers
              pricing={form.pricing}
              pricingLater={form.pricingLater}
              onPricingLaterChange={togglePricingLater}
              onAdd={addPricingTier}
              onRemove={removePricingTier}
              onChange={updatePricingTier}
              t={t}
            />
          </div>
        )}

        {currentStep.key === 'review' && (
          <div className="grid gap-5">
            <div className="grid gap-4">
              {summaryItems.map((section) => (
                <section key={section.title} className="grid gap-3 rounded-lg bg-gnd-cream p-4">
                  <h3 className="text-sm font-black text-gnd-dark">{section.title}</h3>
                  {section.items.map((item) => (
                    <div key={item.label} className="grid gap-1 sm:grid-cols-[180px_1fr]">
                      <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">{item.label}</span>
                      <span className="text-sm font-bold text-gnd-dark">{item.value || t('becomeGuide.review.notProvided')}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <label className="flex gap-3 rounded-lg border border-gnd-cream p-4 text-sm font-bold leading-6 text-gnd-gray">
              <input
                type="checkbox"
                checked={form.consentReview}
                onChange={(event) => updateField('consentReview', event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-gnd-red"
              />
              <span>{t('becomeGuide.form.consentReview')}</span>
            </label>
          </div>
        )}

        {validation && <p className="mt-5 rounded-lg bg-gnd-red/10 p-4 text-sm font-bold text-gnd-red">{validation}</p>}
        {status === 'error' && <p className="mt-5 rounded-lg bg-gnd-red/10 p-4 text-sm leading-6 text-gnd-red">{t('becomeGuide.form.schemaPending')}</p>}
        {error && <p className="mt-3 max-h-24 overflow-auto text-xs text-gnd-gray">{error}</p>}
        {status === 'success' && <p className="mt-5 rounded-lg bg-gnd-cream p-4 text-sm font-bold text-gnd-red">{t('becomeGuide.form.success')}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || status === 'submitting'}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gnd-cream px-5 py-3 text-sm font-black text-gnd-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={17} />
            {t('becomeGuide.form.back')}
          </button>

          {isFinalStep ? (
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              <Send size={18} />
              {status === 'submitting' ? t('states.saving') : t('becomeGuide.form.submit')}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white"
            >
              {t('becomeGuide.form.continue')}
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </form>
    </motion.section>
  );
}

function StepButton({ step, index, stepIndex, onSelect, t }) {
  const Icon = step.icon;
  const isActive = index === stepIndex;
  const isDone = index < stepIndex;
  const isLocked = index > stepIndex;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLocked}
      aria-current={isActive ? 'step' : undefined}
      className={`group flex min-h-[72px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
        isActive
          ? 'border-gnd-red bg-gnd-red text-white shadow-lg shadow-red-900/10'
          : 'border-transparent bg-white text-gnd-dark shadow-sm shadow-red-900/5'
      } ${isLocked ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-0.5 hover:border-gnd-red/30 hover:shadow-lg hover:shadow-red-900/10'}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${isActive ? 'bg-white/15' : 'bg-gnd-cream text-gnd-red group-hover:bg-gnd-red/10'}`}>
        {isDone ? <Check size={18} /> : <Icon size={18} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[10px] font-black uppercase tracking-[0.14em] ${isActive ? 'text-white/70' : 'text-gnd-gray/70'}`}>
          {index + 1 < 10 ? `0${index + 1}` : index + 1}
        </span>
        <span className="block truncate text-sm font-black">{t(`becomeGuide.steps.${step.key}.title`)}</span>
        <span className={`mt-2 block h-1.5 rounded-full transition ${isActive || isDone ? 'bg-current opacity-80' : 'bg-gnd-cream'}`}>
          <span className={`block h-full rounded-full ${isActive || isDone ? 'bg-current' : 'bg-transparent'}`} />
        </span>
      </span>
    </button>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '', privateNote = '' }) {
  return (
    <label className="grid gap-2">
      <span className="flex flex-wrap items-center gap-2 text-sm font-black">
        {label}
        {required && <span className="text-gnd-red">*</span>}
        {privateNote && <span className="rounded-full bg-gnd-cream px-2 py-0.5 text-[10px] uppercase tracking-widest text-gnd-gray">{privateNote}</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, className = '' }) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-sm font-black">{label}</span>
      <textarea
        rows="4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
      />
    </label>
  );
}

function PhotoUpload({ fileInputRef, previewUrl, uploading, onChange, t }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-black">{t('becomeGuide.form.profilePhoto')}</span>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[112px] items-center gap-4 rounded-lg border border-dashed border-gnd-cream bg-gnd-cream/30 p-4 text-left transition hover:border-gnd-red/40 hover:bg-gnd-cream/50"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-gnd-red shadow-sm">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={24} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-gnd-dark">{t('becomeGuide.form.photoAction')}</span>
          <span className="mt-1 block text-xs font-bold leading-5 text-gnd-gray">{t('becomeGuide.form.photoHelp')}</span>
          {uploading && (
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-black text-gnd-red">
              <Loader2 size={13} className="animate-spin" />
              {t('states.saving')}
            </span>
          )}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={onChange}
      />
    </div>
  );
}

function CertificateUpload({ fileInputRef, previewUrl, uploading, onChange, t }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-black">
        {t('becomeGuide.form.certificatePhoto')} <span className="text-gnd-red">*</span>
      </span>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[112px] items-center gap-4 rounded-lg border border-dashed border-gnd-cream bg-gnd-cream/30 p-4 text-left transition hover:border-gnd-red/40 hover:bg-gnd-cream/50"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-gnd-red shadow-sm">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={24} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-gnd-dark">{t('becomeGuide.form.certificateAction')}</span>
          <span className="mt-1 block text-xs font-bold leading-5 text-gnd-gray">{t('becomeGuide.form.certificateHelp')}</span>
          {uploading && (
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-black text-gnd-red">
              <Loader2 size={13} className="animate-spin" />
              {t('states.saving')}
            </span>
          )}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onChange}
      />
    </div>
  );
}

function ActivitySelect({ activities, value, onChange, t }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{t('becomeGuide.form.activityType')} <span className="text-gnd-red">*</span></span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
      >
        <option value="">{t('becomeGuide.form.activitySelectPlaceholder')}</option>
        {activities.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {formatActivityLabel(activity, t)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CoverageAreas({
  selectedLocations,
  locationSearch,
  setLocationSearch,
  showLocationResults,
  setShowLocationResults,
  filteredLocations,
  selectedIds,
  onToggle,
  manualLocation,
  onManualLocationChange,
  t,
}) {
  return (
    <section className="grid gap-4">
      <h3 className="border-b border-gnd-cream pb-2 text-lg font-black text-gnd-dark">{t('becomeGuide.form.coverageAreas')}</h3>
      <div className="flex flex-wrap gap-2">
        {selectedLocations.map((location) => (
          <div key={location.id} className="flex items-center gap-1.5 rounded-lg border border-gnd-red bg-gnd-red/5 px-3 py-1.5">
            <MapPin size={12} className="text-gnd-red" />
            <span className="text-xs font-bold text-gnd-dark">{location.displayName || location.name}</span>
            <button type="button" onClick={() => onToggle(location.id)} className="ml-1 text-gnd-red hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={locationSearch}
          onChange={(event) => {
            setLocationSearch(event.target.value);
            setShowLocationResults(true);
          }}
          onFocus={() => setShowLocationResults(true)}
          placeholder={t('becomeGuide.form.locationSearch')}
          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/10 px-3 py-3 text-sm font-bold text-gnd-dark outline-none focus:ring-1 focus:ring-gnd-red"
        />
        {showLocationResults && locationSearch.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gnd-cream bg-white shadow-xl">
            {filteredLocations.length > 0 ? filteredLocations.map((location) => (
              <button
                type="button"
                key={location.id}
                onClick={() => onToggle(location.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gnd-cream/30"
              >
                <MapPin size={14} className="text-gnd-gray" />
                <span>
                  <span className="block text-sm font-black text-gnd-dark">{location.displayName || location.name}</span>
                  <span className="block text-[10px] font-bold uppercase text-gnd-gray">
                    {[location.district, location.region, location.country].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {selectedIds.includes(location.id) && <span className="ml-auto text-xs font-bold text-gnd-red">{t('becomeGuide.form.locationAdded')}</span>}
              </button>
            )) : (
              <div className="px-4 py-6 text-center text-xs font-bold text-gnd-gray">{t('becomeGuide.form.noLocations', { query: locationSearch })}</div>
            )}
          </div>
        )}
      </div>
      {!selectedIds.length && !manualLocation.trim() && <p className="text-sm font-bold text-gnd-red">{t('becomeGuide.validation.coverageArea')}</p>}
      <label className="grid gap-2">
        <span className="text-sm font-black">{t('becomeGuide.form.manualLocation')}</span>
        <input
          value={manualLocation}
          onChange={(event) => onManualLocationChange(event.target.value)}
          placeholder={t('becomeGuide.form.manualLocationPlaceholder')}
          className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
        />
      </label>
    </section>
  );
}

function PricingTiers({ pricing, pricingLater, onPricingLaterChange, onAdd, onRemove, onChange, t }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between border-b border-gnd-cream pb-2">
        <h3 className="text-lg font-black text-gnd-dark">{t('becomeGuide.form.pricingTiers')}</h3>
        <button type="button" onClick={onAdd} className="flex items-center gap-1 text-sm font-bold text-gnd-red hover:text-red-700">
          <Plus size={16} />
          {t('becomeGuide.form.addTier')}
        </button>
      </div>
      <label className="flex gap-3 rounded-lg border border-gnd-cream bg-white p-4 text-sm font-bold leading-6 text-gnd-gray">
        <input
          type="checkbox"
          checked={pricingLater}
          onChange={(event) => onPricingLaterChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-gnd-red"
        />
        <span>{t('becomeGuide.form.pricingLater')}</span>
      </label>

      <div className="grid gap-4">
        {pricing.map((tier, index) => (
          <div key={index} className="relative rounded-xl border border-gnd-cream bg-gnd-cream/10 p-4 pt-6">
            {pricing.length > 1 && (
              <button type="button" onClick={() => onRemove(index)} className="absolute right-2 top-2 p-1 text-gnd-gray hover:text-gnd-red">
                <Trash2 size={16} />
              </button>
            )}
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gnd-gray">{t('becomeGuide.form.skillLevelLabel')}</span>
                <input
                  required
                  disabled={pricingLater}
                  value={tier.skillLevel}
                  onChange={(event) => onChange(index, 'skillLevel', event.target.value)}
                  placeholder={t('becomeGuide.form.skillLevelPlaceholder')}
                  className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gnd-gray">{t('becomeGuide.form.currency')}</span>
                <select
                  value={tier.currency}
                  disabled={pricingLater}
                  onChange={(event) => onChange(index, 'currency', event.target.value)}
                  className="w-full rounded-md border border-gnd-cream bg-white px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                >
                  {['HKD', 'USD', 'JPY', 'IDR'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-gnd-gray">{t('becomeGuide.form.basePrice')}</span>
                <input
                  required
                  type="number"
                  min="0"
                  disabled={pricingLater}
                  value={tier.price1}
                  onChange={(event) => onChange(index, 'price1', event.target.value)}
                  placeholder={t('becomeGuide.form.basePricePlaceholder')}
                  className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-gnd-gray">{t('becomeGuide.form.extraPersonFee')}</span>
                <input
                  required
                  type="number"
                  min="0"
                  disabled={pricingLater}
                  value={tier.extraPersonFee}
                  onChange={(event) => onChange(index, 'extraPersonFee', event.target.value)}
                  placeholder={t('becomeGuide.form.extraPersonFeePlaceholder')}
                  className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QualificationSelect({
  dropdownRef,
  search,
  setSearch,
  showDropdown,
  setShowDropdown,
  qualifications,
  selectedId,
  selectedName,
  onSelect,
  t,
}) {
  return (
    <div className="relative grid gap-2" ref={dropdownRef}>
      <span className="text-sm font-black">{t('becomeGuide.form.credentialName')}</span>
      <button
        type="button"
        onClick={() => setShowDropdown((current) => !current)}
        className={`flex h-12 items-center gap-2 rounded-lg px-4 text-left text-sm font-semibold outline-none transition ${
          showDropdown ? 'bg-white ring-2 ring-gnd-red/20' : 'bg-gnd-cream'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedName ? 'text-gnd-dark' : 'text-gnd-gray/60'}`}>
          {selectedName || t('becomeGuide.form.credentialPlaceholder')}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gnd-gray transition ${showDropdown ? 'rotate-180 text-gnd-red' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[320px] w-full overflow-hidden rounded-2xl border border-gnd-cream bg-white shadow-2xl shadow-red-900/10">
          <div className="border-b border-gnd-cream p-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('becomeGuide.form.credentialSearch')}
                className="w-full rounded-lg bg-gnd-cream/40 py-2 pl-9 pr-4 text-xs font-bold outline-none focus:bg-gnd-cream/60"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {qualifications.map((qualification) => {
              const label = qualification.qualification_name || qualification.qualification || '';
              const isSelected = selectedId === qualification.id;
              return (
                <button
                  key={qualification.id}
                  type="button"
                  onClick={() => onSelect(qualification)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-gnd-cream/40 ${isSelected ? 'bg-gnd-red/5' : ''}`}
                >
                  <span className={`block truncate text-sm font-bold ${isSelected ? 'text-gnd-red' : 'text-gnd-dark'}`}>{label}</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${isSelected ? 'border-gnd-red bg-gnd-red text-white' : 'border-gnd-cream text-transparent group-hover:border-gnd-red/30'}`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
            {!qualifications.length && (
              <div className="py-6 text-center text-xs font-bold text-gnd-gray">{t('becomeGuide.form.noCredentials')}</div>
            )}
            <button
              type="button"
              onClick={() => onSelect('other')}
              className={`mt-1 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition hover:bg-gnd-cream/40 ${
                selectedId === 'other' ? 'border-gnd-red bg-gnd-red/5 text-gnd-red' : 'border-gnd-cream text-gnd-dark'
              }`}
            >
              <span className="text-sm font-black">{t('becomeGuide.form.otherCredentialOption')}</span>
              <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selectedId === 'other' ? 'border-gnd-red bg-gnd-red text-white' : 'border-gnd-cream text-transparent'}`}>
                <Check size={12} strokeWidth={3} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageMultiSelect({
  allLanguages,
  languageSearch,
  selectedLanguages,
  selectedIds,
  showDropdown,
  dropdownRef,
  setLanguageSearch,
  setShowDropdown,
  toggleLanguage,
  t,
}) {
  const filteredLanguages = allLanguages.filter((language) => {
    const label = t(`languages.${language.code}`) || '';
    return label.toLowerCase().includes(languageSearch.toLowerCase())
      || language.native_name?.toLowerCase().includes(languageSearch.toLowerCase());
  });

  return (
    <div className="relative grid gap-2" ref={dropdownRef}>
      <span className="text-sm font-black">{t('becomeGuide.form.languages')}</span>
      <button
        type="button"
        onClick={() => setShowDropdown((current) => !current)}
        className={`flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-bold outline-none transition ${
          showDropdown ? 'bg-white ring-2 ring-gnd-red/20' : 'bg-gnd-cream'
        }`}
      >
        {selectedLanguages.length ? (
          selectedLanguages.map((language) => (
            <span key={language.id} className="inline-flex items-center gap-1 rounded-lg bg-gnd-red px-2.5 py-1 text-[10px] font-black text-white">
              {t(`languages.${language.code}`) || language.native_name}
              <X
                size={12}
                className="opacity-70 hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLanguage(language.id);
                }}
              />
            </span>
          ))
        ) : (
          <span className="text-gnd-gray/60">{t('becomeGuide.form.languagesPlaceholder')}</span>
        )}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-gnd-gray transition ${showDropdown ? 'rotate-180 text-gnd-red' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[320px] w-full overflow-hidden rounded-2xl border border-gnd-cream bg-white shadow-2xl shadow-red-900/10">
          <div className="border-b border-gnd-cream p-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray" />
              <input
                type="text"
                value={languageSearch}
                onChange={(event) => setLanguageSearch(event.target.value)}
                placeholder={t('becomeGuide.form.languageSearch')}
                className="w-full rounded-lg bg-gnd-cream/40 py-2 pl-9 pr-4 text-xs font-bold outline-none focus:bg-gnd-cream/60"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredLanguages.map((language) => {
              const isSelected = selectedIds.includes(language.id);
              return (
                <button
                  key={language.id}
                  type="button"
                  onClick={() => toggleLanguage(language.id)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-gnd-cream/40 ${isSelected ? 'bg-gnd-red/5' : ''}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-bold ${isSelected ? 'text-gnd-red' : 'text-gnd-dark'}`}>
                      {t(`languages.${language.code}`) || language.native_name}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-gnd-gray/60">{language.native_name}</span>
                  </span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${isSelected ? 'border-gnd-red bg-gnd-red text-white' : 'border-gnd-cream text-transparent group-hover:border-gnd-red/30'}`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
            {!filteredLanguages.length && (
              <div className="py-8 text-center text-xs font-bold text-gnd-gray">{t('becomeGuide.form.noLanguages')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function validateStep(stepIndex, form, t) {
  if (stepIndex === 0 && (!form.legalName.trim() || !form.publicName.trim() || !form.email.trim())) {
    return t('becomeGuide.validation.identity');
  }
  if (stepIndex === 1 && (!form.activityId || (!form.credentialName.trim() && !form.proofNotes.trim()))) {
    return t('becomeGuide.validation.expertise');
  }
  if (stepIndex === 1 && form.credentialName.trim() && !form.certificateUrl) {
    return t('becomeGuide.validation.certificateRequired');
  }
  if (stepIndex === 2 && (!form.serviceTitle.trim() || (!form.locationIds.length && !form.manualLocation.trim()) || (!form.pricingLater && (!form.pricing.length || !form.pricing[0].price1)))) {
    return t('becomeGuide.validation.service');
  }
  if (stepIndex === 3 && !form.consentReview) {
    return t('becomeGuide.validation.review');
  }
  return '';
}

function normalizePricingFields(form) {
  const firstTier = form.pricing[0] || defaultPricingTier;
  return {
    ...form,
    skillLevels: form.pricing.map((tier) => tier.skillLevel).filter(Boolean),
    currency: firstTier.currency || form.currency || 'HKD',
    price: form.pricingLater ? 'Confirm later' : (firstTier.price1 || ''),
    duration: form.minDurationHours ? `${form.minDurationHours} ${Number(form.minDurationHours) === 1 ? 'hour' : 'hours'}` : '',
  };
}

function normalizeServiceApplication(form, allLocations) {
  const normalized = normalizePricingFields(form);
  const locationNames = allLocations
    .filter((location) => normalized.locationIds.includes(location.id))
    .map((location) => location.displayName || location.name)
    .filter(Boolean);

  const manualLocation = normalized.manualLocation?.trim();
  const allLocationNames = [...locationNames, manualLocation].filter(Boolean);

  return {
    ...normalized,
    serviceLocation: allLocationNames.join(', '),
  };
}

function formatActivityLabel(activity, t) {
  if (!activity) return '';
  const key = activity.translation_key || activity.category_key || '';
  if (!key) return activity.name || 'Activity';
  return t(key, {
    defaultValue: key.replace(/^activity\./, '').split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
  });
}

function buildSummaryItems(form, t) {
  return [
    {
      title: t('becomeGuide.review.identitySection'),
      items: [
        { label: t('becomeGuide.review.legalName'), value: form.legalName },
        { label: t('becomeGuide.review.publicName'), value: form.publicName },
      ],
    },
    {
      title: t('becomeGuide.review.expertiseSection'),
      items: [
        { label: t('becomeGuide.review.activity'), value: form.activityType },
        { label: t('becomeGuide.review.credential'), value: [form.credentialName, form.attainmentYear].filter(Boolean).join(' / ') },
      ],
    },
    {
      title: t('becomeGuide.review.serviceSection'),
      items: [
        { label: t('becomeGuide.review.service'), value: form.serviceTitle },
        { label: t('becomeGuide.review.location'), value: form.serviceLocation || form.manualLocation },
        { label: t('becomeGuide.review.levels'), value: form.skillLevels.join(', ') },
        { label: t('becomeGuide.review.price'), value: form.pricingLater ? t('becomeGuide.review.pricingLater') : [form.currency, form.price].filter(Boolean).join(' ') },
      ],
    },
  ];
}
