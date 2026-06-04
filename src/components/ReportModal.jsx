import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { createComplaintReport } from '../lib/database';

const reportReasons = [
  { value: 'spam_or_scam', label: 'Spam or scam' },
  { value: 'harassment_or_abuse', label: 'Harassment or abusive behavior' },
  { value: 'fake_identity_or_credential', label: 'Fake identity or credential' },
  { value: 'unsafe_activity', label: 'Unsafe activity' },
  { value: 'booking_or_payment_issue', label: 'Booking or payment issue' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ reportTarget, onClose, onSubmitted }) {
  const [form, setForm] = useState({ reasonCategory: reportReasons[0].value, description: '', evidenceUrl: '' });
  const [state, setState] = useState({ saving: false, error: '', notice: '' });

  if (!reportTarget) return null;

  const submit = async (event) => {
    event.preventDefault();
    setState({ saving: true, error: '', notice: '' });
    const result = await createComplaintReport({
      ...reportTarget,
      reasonCategory: form.reasonCategory,
      description: form.description,
      evidenceUrl: form.evidenceUrl,
    });
    if (result.error) {
      setState({ saving: false, error: formatReportError(result.error), notice: '' });
      return;
    }
    setState({ saving: false, error: '', notice: 'Report submitted. GuideNextdoor staff will review it.' });
    onSubmitted?.(result.data);
    window.setTimeout(() => onClose?.(), 700);
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-gnd-dark/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gnd-red">
              <AlertTriangle size={15} />
              Report
            </p>
            <h2 className="mt-2 text-2xl font-black text-gnd-dark">{reportTarget.title || 'Report an issue'}</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-gnd-gray">Your report is sent to GuideNextdoor staff with the related content attached.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md bg-gnd-cream p-2 text-gnd-gray hover:text-gnd-red" aria-label="Close report form">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Reason</span>
            <select value={form.reasonCategory} onChange={(event) => setForm((current) => ({ ...current, reasonCategory: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
              {reportReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">What happened?</span>
            <textarea rows={5} required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Evidence link</span>
            <input value={form.evidenceUrl} onChange={(event) => setForm((current) => ({ ...current, evidenceUrl: event.target.value }))} placeholder="Optional URL to screenshot or supporting evidence" className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none" />
          </label>
        </div>

        {state.error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{state.error}</p>}
        {state.notice && <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{state.notice}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark">Cancel</button>
          <button type="submit" disabled={state.saving || !form.description.trim()} className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
            {state.saving && <Loader2 size={16} className="animate-spin" />}
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}

function formatReportError(error) {
  if (error === 'auth_required') return 'Please log in to submit a report.';
  if (error === 'account_suspended') return 'Your account is currently read-only. Please contact GuideNextdoor support.';
  return 'We could not submit the report. Please try again.';
}
