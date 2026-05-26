import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { submitGuideApplication } from '../lib/database';

const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  role: 'coach',
  bio: '',
};

export default function BecomeGuideView() {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    setError('');
    const result = await submitGuideApplication({
      ...form,
      source: 'platform_skeleton',
      submitted_at: new Date().toISOString(),
    });

    if (result.error) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setStatus('success');
    setForm(initialForm);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('becomeGuide.eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t('becomeGuide.title')}</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-gnd-gray">{t('becomeGuide.subtitle')}</p>
        <div className="mt-10 grid gap-3">
          {['profile', 'coverage', 'verification'].map((key) => (
            <div key={key} className="flex gap-3 rounded-lg bg-white p-4">
              <Check className="text-gnd-red" size={20} />
              <div>
                <h2 className="text-sm font-black">{t(`becomeGuide.checklist.${key}.title`)}</h2>
                <p className="mt-1 text-sm leading-6 text-gnd-gray">{t(`becomeGuide.checklist.${key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-5 md:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('becomeGuide.form.name')} value={form.full_name} onChange={(value) => updateField('full_name', value)} required />
          <Field label={t('becomeGuide.form.email')} type="email" value={form.email} onChange={(value) => updateField('email', value)} required />
          <Field label={t('becomeGuide.form.phone')} value={form.phone} onChange={(value) => updateField('phone', value)} />
          <Field label={t('becomeGuide.form.location')} value={form.location} onChange={(value) => updateField('location', value)} required />
          <label className="grid gap-2">
            <span className="text-sm font-black">{t('becomeGuide.form.role')}</span>
            <select
              value={form.role}
              onChange={(event) => updateField('role', event.target.value)}
              className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
            >
              <option value="coach">{t('explore.roles.coach')}</option>
              <option value="guide">{t('explore.roles.guide')}</option>
              <option value="companion">{t('explore.roles.companion')}</option>
            </select>
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-black">{t('becomeGuide.form.bio')}</span>
            <textarea
              rows="5"
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
            />
          </label>
        </div>

        {status === 'error' && (
          <p className="mt-5 rounded-lg bg-gnd-red/10 p-4 text-sm leading-6 text-gnd-red">
            {t('becomeGuide.form.schemaPending')}
          </p>
        )}
        {error && <p className="mt-3 max-h-24 overflow-auto text-xs text-gnd-gray">{error}</p>}
        {status === 'success' && (
          <p className="mt-5 rounded-lg bg-gnd-cream p-4 text-sm font-bold text-gnd-red">{t('becomeGuide.form.success')}</p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-4 text-sm font-black text-white disabled:opacity-60"
        >
          <Send size={18} />
          {status === 'submitting' ? t('states.saving') : t('becomeGuide.form.submit')}
        </button>
      </form>
    </motion.section>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-gnd-red/20"
      />
    </label>
  );
}
