import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { fetchRefActivities, fetchRefQualifications } from '../../lib/database';

export default function CredentialModal({ isOpen, onClose, onSave, instructorId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [form, setForm] = useState({
    activityId: '',
    qualificationId: '',
    customQualification: '',
    attainmentYear: '',
    certFile: null,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    Promise.all([
      fetchRefActivities(),
      fetchRefQualifications(instructorId),
    ]).then(([activityResult, qualificationResult]) => {
      if (cancelled) return;
      const loadedActivities = activityResult.data || [];
      setActivities(loadedActivities);
      setQualifications(qualificationResult.data || []);
      setForm({
        activityId: loadedActivities[0]?.id || '',
        qualificationId: '',
        customQualification: '',
        attainmentYear: '',
        certFile: null,
      });
      setError('');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, instructorId]);

  if (!isOpen) return null;

  const filteredQualifications = qualifications.filter((qualification) => !form.activityId || qualification.activity_id === form.activityId);
  const isCustom = form.qualificationId === 'custom';

  const submit = async (event) => {
    event.preventDefault();
    if (!form.activityId) {
      setError('Select an activity.');
      return;
    }
    if (!form.qualificationId) {
      setError('Select a credential or choose Other.');
      return;
    }
    if (isCustom && !form.customQualification.trim()) {
      setError('Enter the credential name.');
      return;
    }
    if (!form.attainmentYear) {
      setError('Enter the attainment year.');
      return;
    }
    if (!form.certFile) {
      setError('Upload the certificate photo.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await onSave(form);
      if (!result?.error) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gnd-dark/45 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gnd-cream px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-gnd-dark">Add credential</h2>
            <p className="mt-1 text-sm font-bold text-gnd-gray">Submitted credentials are reviewed by GuideNextdoor before appearing publicly.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream p-2 text-gnd-dark hover:text-gnd-red">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid h-48 place-items-center">
              <Loader2 className="animate-spin text-gnd-red" size={28} />
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-gnd-dark">Activity</span>
                <select
                  value={form.activityId}
                  onChange={(event) => setForm((current) => ({ ...current, activityId: event.target.value, qualificationId: '', customQualification: '' }))}
                  className="h-11 rounded-lg border border-gnd-cream bg-gnd-cream/40 px-3 text-sm font-bold outline-none focus:border-gnd-red"
                >
                  <option value="" disabled>Select activity</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {t(activity.translation_key, {
                        defaultValue: activity.translation_key?.replace('activity.', '').split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || activity.category_key || 'Activity',
                      })}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-gnd-dark">Credential</span>
                <select
                  value={form.qualificationId}
                  onChange={(event) => setForm((current) => ({ ...current, qualificationId: event.target.value, customQualification: event.target.value === 'custom' ? current.customQualification : '' }))}
                  className="h-11 rounded-lg border border-gnd-cream bg-gnd-cream/40 px-3 text-sm font-bold outline-none focus:border-gnd-red"
                >
                  <option value="" disabled>Select credential</option>
                  {filteredQualifications.map((qualification) => (
                    <option key={qualification.id} value={qualification.id}>{qualification.qualification_name || qualification.qualification}</option>
                  ))}
                  <option value="custom">Other</option>
                </select>
              </label>

              {isCustom && (
                <label className="grid gap-2">
                  <span className="text-sm font-black text-gnd-dark">Other credential name</span>
                  <input
                    value={form.customQualification}
                    onChange={(event) => setForm((current) => ({ ...current, customQualification: event.target.value }))}
                    className="h-11 rounded-lg border border-gnd-cream bg-gnd-cream/40 px-3 text-sm font-bold outline-none focus:border-gnd-red"
                    placeholder="Enter credential name"
                  />
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-gnd-dark">Attainment year</span>
                  <input
                    type="number"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={form.attainmentYear}
                    onChange={(event) => setForm((current) => ({ ...current, attainmentYear: event.target.value }))}
                    className="h-11 rounded-lg border border-gnd-cream bg-gnd-cream/40 px-3 text-sm font-bold outline-none focus:border-gnd-red"
                    placeholder={`${new Date().getFullYear() - 1}`}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-black text-gnd-dark">Certificate photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setForm((current) => ({ ...current, certFile: event.target.files?.[0] || null }))}
                    className="w-full rounded-lg border border-gnd-cream bg-white p-2 text-sm text-gnd-gray file:mr-3 file:rounded-md file:border-0 file:bg-gnd-red/10 file:px-3 file:py-2 file:text-sm file:font-bold file:text-gnd-red"
                  />
                </label>
              </div>

              {form.certFile && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700">Ready to upload: {form.certFile.name}</p>}
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-gnd-red">{error}</p>}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-gnd-cream px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark">Cancel</button>
          <button type="submit" disabled={loading || saving} className="rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit for review'}
          </button>
        </footer>
      </form>
    </div>
  );
}
