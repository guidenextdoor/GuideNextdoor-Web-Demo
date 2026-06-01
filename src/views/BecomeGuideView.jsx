import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, IdCard, Loader2, MapPin, Search, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchLanguages, submitGuideApplication, uploadApplicationPhoto } from '../lib/database';
import { compressImage } from '../lib/image-utils';

const skillLevelOptions = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];

const initialForm = {
  legalName: '',
  publicName: '',
  email: '',
  phone: '',
  languageIds: [],
  bio: '',
  profilePhotoUrl: '',
  activityType: '',
  credentialName: '',
  attainmentYear: '',
  certificateUrl: '',
  proofNotes: '',
  serviceTitle: '',
  serviceLocation: '',
  meetingPoint: '',
  serviceDescription: '',
  skillLevels: [],
  duration: '',
  maxGroupSize: '',
  price: '',
  currency: 'HKD',
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
  const [languageSearch, setLanguageSearch] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef(null);
  const languageDropdownRef = useRef(null);

  const currentStep = steps[stepIndex];
  const isFinalStep = stepIndex === steps.length - 1;
  const summaryItems = useMemo(() => buildSummaryItems(form, t), [form, t]);
  const selectedLanguages = allLanguages.filter((language) => form.languageIds.includes(language.id));

  useEffect(() => {
    let cancelled = false;
    fetchLanguages().then((result) => {
      if (!cancelled) setAllLanguages(result.data || []);
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidation('');
  };

  const toggleSkillLevel = (level) => {
    setForm((current) => ({
      ...current,
      skillLevels: current.skillLevels.includes(level)
        ? current.skillLevels.filter((item) => item !== level)
        : [...current.skillLevels, level],
    }));
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
    const result = await submitGuideApplication({
      ...form,
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
    setStepIndex(0);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[0.82fr_1.18fr]"
    >
      <aside>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('becomeGuide.eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t('becomeGuide.title')}</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-gnd-gray">{t('becomeGuide.subtitle')}</p>

        <div className="mt-10 grid gap-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === stepIndex;
            const isDone = index < stepIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  if (index <= stepIndex) setStepIndex(index);
                }}
                className={`flex gap-3 rounded-lg p-4 text-left transition ${
                  isActive ? 'bg-gnd-red text-white shadow-lg shadow-red-900/10' : 'bg-white text-gnd-dark'
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isActive ? 'bg-white/15' : 'bg-gnd-cream text-gnd-red'}`}>
                  {isDone ? <Check size={18} /> : <Icon size={18} />}
                </span>
                <span>
                  <span className="block text-sm font-black">{t(`becomeGuide.steps.${step.key}.title`)}</span>
                  <span className={`mt-1 block text-xs font-bold leading-5 ${isActive ? 'text-white/75' : 'text-gnd-gray'}`}>
                    {t(`becomeGuide.steps.${step.key}.body`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-5 shadow-xl shadow-red-900/5 md:p-7">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-gnd-cream pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">
              {t('becomeGuide.stepCounter', { current: stepIndex + 1, total: steps.length })}
            </p>
            <h2 className="mt-1 text-2xl font-black">{t(`becomeGuide.steps.${currentStep.key}.title`)}</h2>
          </div>
          <span className="rounded-full bg-gnd-cream px-3 py-1 text-xs font-black text-gnd-red">
            {t(`becomeGuide.steps.${currentStep.key}.badge`)}
          </span>
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
            <Field label={t('becomeGuide.form.activityType')} value={form.activityType} onChange={(value) => updateField('activityType', value)} placeholder={t('becomeGuide.form.activityPlaceholder')} required />
            <Field label={t('becomeGuide.form.credentialName')} value={form.credentialName} onChange={(value) => updateField('credentialName', value)} placeholder={t('becomeGuide.form.credentialPlaceholder')} />
            <Field label={t('becomeGuide.form.attainmentYear')} type="number" value={form.attainmentYear} onChange={(value) => updateField('attainmentYear', value)} placeholder="2021" />
            <Field label={t('becomeGuide.form.certificateUrl')} value={form.certificateUrl} onChange={(value) => updateField('certificateUrl', value)} placeholder="https://..." />
            <TextArea label={t('becomeGuide.form.proofNotes')} value={form.proofNotes} onChange={(value) => updateField('proofNotes', value)} className="md:col-span-2" />
          </div>
        )}

        {currentStep.key === 'service' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('becomeGuide.form.serviceTitle')} value={form.serviceTitle} onChange={(value) => updateField('serviceTitle', value)} placeholder={t('becomeGuide.form.serviceTitlePlaceholder')} required />
            <Field label={t('becomeGuide.form.serviceLocation')} value={form.serviceLocation} onChange={(value) => updateField('serviceLocation', value)} placeholder={t('becomeGuide.form.serviceLocationPlaceholder')} required />
            <Field label={t('becomeGuide.form.meetingPoint')} value={form.meetingPoint} onChange={(value) => updateField('meetingPoint', value)} />
            <Field label={t('becomeGuide.form.duration')} value={form.duration} onChange={(value) => updateField('duration', value)} placeholder={t('becomeGuide.form.durationPlaceholder')} />
            <Field label={t('becomeGuide.form.maxGroupSize')} type="number" value={form.maxGroupSize} onChange={(value) => updateField('maxGroupSize', value)} />
            <div className="grid gap-2">
              <span className="text-sm font-black">{t('becomeGuide.form.price')}</span>
              <div className="grid grid-cols-[92px_1fr] gap-2">
                <select
                  value={form.currency}
                  onChange={(event) => updateField('currency', event.target.value)}
                  className="h-12 rounded-lg bg-gnd-cream px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
                >
                  {['HKD', 'USD', 'JPY', 'IDR'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
                <input
                  value={form.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  placeholder={t('becomeGuide.form.pricePlaceholder')}
                  className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
                />
              </div>
            </div>
            <fieldset className="grid gap-2 md:col-span-2">
              <legend className="text-sm font-black">{t('becomeGuide.form.skillLevels')}</legend>
              <div className="flex flex-wrap gap-2">
                {skillLevelOptions.map((level) => (
                  <label key={level} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-black ${form.skillLevels.includes(level) ? 'border-gnd-red bg-gnd-red text-white' : 'border-gnd-cream bg-white text-gnd-dark'}`}>
                    <input type="checkbox" className="sr-only" checked={form.skillLevels.includes(level)} onChange={() => toggleSkillLevel(level)} />
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextArea label={t('becomeGuide.form.serviceDescription')} value={form.serviceDescription} onChange={(value) => updateField('serviceDescription', value)} className="md:col-span-2" />
            <TextArea label={t('becomeGuide.form.availability')} value={form.availability} onChange={(value) => updateField('availability', value)} className="md:col-span-2" />
          </div>
        )}

        {currentStep.key === 'review' && (
          <div className="grid gap-5">
            <div className="grid gap-3 rounded-lg bg-gnd-cream p-4">
              {summaryItems.map((item) => (
                <div key={item.label} className="grid gap-1 sm:grid-cols-[180px_1fr]">
                  <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">{item.label}</span>
                  <span className="text-sm font-bold text-gnd-dark">{item.value || t('becomeGuide.review.notProvided')}</span>
                </div>
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
  if (stepIndex === 1 && (!form.activityType.trim() || (!form.credentialName.trim() && !form.proofNotes.trim()))) {
    return t('becomeGuide.validation.expertise');
  }
  if (stepIndex === 2 && (!form.serviceTitle.trim() || !form.serviceLocation.trim())) {
    return t('becomeGuide.validation.service');
  }
  if (stepIndex === 3 && !form.consentReview) {
    return t('becomeGuide.validation.review');
  }
  return '';
}

function buildSummaryItems(form, t) {
  return [
    { label: t('becomeGuide.review.legalName'), value: form.legalName },
    { label: t('becomeGuide.review.publicName'), value: form.publicName },
    { label: t('becomeGuide.review.activity'), value: form.activityType },
    { label: t('becomeGuide.review.credential'), value: [form.credentialName, form.attainmentYear].filter(Boolean).join(' / ') },
    { label: t('becomeGuide.review.service'), value: form.serviceTitle },
    { label: t('becomeGuide.review.location'), value: form.serviceLocation },
    { label: t('becomeGuide.review.levels'), value: form.skillLevels.join(', ') },
    { label: t('becomeGuide.review.price'), value: [form.currency, form.price].filter(Boolean).join(' ') },
  ];
}
