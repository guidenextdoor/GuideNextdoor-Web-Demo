import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, FileCheck, Inbox, Loader2, MessageSquare, Plus, RefreshCw, Shield, UserLock, Users, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  approveCoachApplication,
  createUserBlock,
  createStaffInstructorService,
  fetchCurrentStaffContext,
  fetchStaffAuditLogs,
  fetchStaffApplications,
  fetchUserBlocks,
  getCurrentSession,
  hasStaffPermission,
  liftUserBlock,
  updateCoachApplicationReview,
} from '../../lib/database';

const statusLabels = {
  new: 'New',
  in_review: 'In review',
  needs_info: 'Needs info',
  approved: 'Approved',
  rejected: 'Rejected',
};

const statusStyles = {
  new: 'bg-blue-50 text-blue-600 border-blue-100',
  in_review: 'bg-amber-50 text-amber-600 border-amber-100',
  needs_info: 'bg-purple-50 text-purple-600 border-purple-100',
  approved: 'bg-green-50 text-green-600 border-green-100',
  rejected: 'bg-red-50 text-gnd-red border-red-100',
};

const staffTabs = [
  { key: 'applications', label: 'Applications', icon: FileCheck, permission: 'application.view' },
  { key: 'services', label: 'Services', icon: Plus, permission: 'service.create' },
  { key: 'users', label: 'User blocks', icon: UserLock, permission: 'user.block' },
  { key: 'staff', label: 'Staff admin', icon: Users, permission: 'staff.manage' },
  { key: 'audit', label: 'Audit', icon: Shield, permission: 'audit.view' },
];

export default function StaffDashboardView() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const session = getCurrentSession();
  const [staffState, setStaffState] = useState({ loading: true, context: null, error: '' });
  const [state, setState] = useState({ loading: true, applications: [], error: '' });
  const [auditState, setAuditState] = useState({ loading: false, data: [], error: '' });
  const [blocksState, setBlocksState] = useState({ loading: false, data: [], error: '' });
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState('applications');
  const [reviewState, setReviewState] = useState({ saving: false, error: '', notice: '' });
  const [decisionMessage, setDecisionMessage] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [serviceForm, setServiceForm] = useState({ description: '', minDurationHours: 1, price1: '', extraPersonFee: '', currency: 'HKD' });
  const [blockForm, setBlockForm] = useState({ userId: '', status: 'temporary', blockedUntil: '', reason: '' });

  const selectedApplication = useMemo(
    () => state.applications.find((application) => application.id === selectedId) || state.applications[0] || null,
    [selectedId, state.applications],
  );
  const visibleTabs = useMemo(
    () => staffTabs.filter((tab) => hasStaffPermission(staffState.context, tab.permission)),
    [staffState.context],
  );
  const can = (permission) => hasStaffPermission(staffState.context, permission);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentStaffContext().then(async (contextResult) => {
      if (cancelled) return;
      setStaffState({ loading: false, context: contextResult.data, error: contextResult.error || '' });
      const firstTab = staffTabs.find((tab) => hasStaffPermission(contextResult.data, tab.permission))?.key || '';
      setActiveTab(firstTab);
      if (hasStaffPermission(contextResult.data, 'application.view')) {
        const result = await fetchStaffApplications();
        if (cancelled) return;
        setState({ loading: false, applications: result.data || [], error: result.error || '' });
        const firstApplication = result.data?.[0] || null;
        setSelectedId((current) => current || firstApplication?.id || '');
        if (firstApplication) applyApplicationDraft(firstApplication);
      } else {
        setState({ loading: false, applications: [], error: '' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return <Navigate to={`/${i18n.language}/login?redirect=${encodeURIComponent(`/${i18n.language}/staff`)}`} replace />;
  if (staffState.loading) return <div className="mx-auto max-w-7xl px-5 py-20 text-gnd-gray md:px-8">Loading staff permissions.</div>;
  if (!staffState.context?.isStaff) return <Navigate to={`/${i18n.language}/explore`} replace />;

  function applyApplicationDraft(application) {
    setDecisionMessage(defaultDecisionMessage(application.status, application));
    setStaffNote(application.reviewNotes || '');
    setServiceForm({
      description: application.serviceDescription || application.serviceTitle || '',
      minDurationHours: application.minDurationHours || 1,
      price1: application.pricing?.[0]?.price1 || '',
      extraPersonFee: application.pricing?.[0]?.extraPersonFee || '',
      currency: application.pricing?.[0]?.currency || application.currency || 'HKD',
    });
  }

  const reload = async () => {
    if (activeTab === 'applications' && can('application.view')) await reloadApplications();
    if (activeTab === 'users' && can('user.block')) await reloadBlocks();
    if (activeTab === 'audit' && can('audit.view')) await reloadAudit();
  };

  const reloadApplications = async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    const result = await fetchStaffApplications();
    setState({ loading: false, applications: result.data || [], error: result.error || '' });
    const nextSelected = result.data?.find((application) => application.id === selectedId) || result.data?.[0] || null;
    setSelectedId(nextSelected?.id || '');
    if (nextSelected) applyApplicationDraft(nextSelected);
  };

  const reloadBlocks = async () => {
    setBlocksState({ loading: true, data: [], error: '' });
    const result = await fetchUserBlocks();
    setBlocksState({ loading: false, data: result.data || [], error: result.error || '' });
  };

  const reloadAudit = async () => {
    setAuditState({ loading: true, data: [], error: '' });
    const result = await fetchStaffAuditLogs();
    setAuditState({ loading: false, data: result.data || [], error: result.error || '' });
  };

  const handleDecision = async (status) => {
    if (!selectedApplication) return;
    setReviewState({ saving: true, error: '', notice: '' });
    const action = status === 'approved' ? approveCoachApplication : updateCoachApplicationReview;
    const result = await action({
      applicationId: selectedApplication.id,
      status,
      staffNote,
      applicantMessage: decisionMessage,
    });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Application updated and applicant message sent.' });
    await reload();
  };

  const handleCreateBlock = async (event) => {
    event.preventDefault();
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await createUserBlock(blockForm);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'User block created.' });
    setBlockForm({ userId: '', status: 'temporary', blockedUntil: '', reason: '' });
    await reloadBlocks();
  };

  const handleLiftBlock = async (blockId) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await liftUserBlock(blockId);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'User block lifted.' });
    await reloadBlocks();
  };

  const handleCreateService = async () => {
    if (!selectedApplication?.instructorProfileId) {
      setReviewState({ saving: false, error: 'Approve the application before creating another service for this coach.', notice: '' });
      return;
    }
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await createStaffInstructorService({
      applicationId: selectedApplication.id,
      instructorId: selectedApplication.instructorProfileId,
      description: serviceForm.description,
      minDurationHours: serviceForm.minDurationHours,
      pricing: [{
        skillLevel: 'All Levels',
        currency: serviceForm.currency,
        price1: serviceForm.price1,
        extraPersonFee: serviceForm.extraPersonFee,
      }],
    });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'New service created for this coach.' });
    await reload();
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">
            <Shield size={15} />
            Staff portal
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">Coach applications</h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-gnd-gray">
            One staff workspace with role-based tabs for applications, services, user blocks, staff access, and audit history.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {staffState.context.roles?.map((role) => (
              <span key={role.key} className="rounded-md bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray shadow-sm">{role.name || role.key}</span>
            ))}
            {staffState.context.source === 'env_fallback' && (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">local env access</span>
            )}
          </div>
        </div>
        <button type="button" onClick={reload} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-gnd-dark shadow-sm hover:text-gnd-red">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {state.error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{state.error}</p>}
      {reviewState.error && <p className="mb-4 max-h-28 overflow-auto rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{reviewState.error}</p>}
      {reviewState.notice && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-600">{reviewState.notice}</p>}

      <div className="mb-5 overflow-x-auto rounded-lg bg-white p-1 shadow-sm">
        <div className="flex min-w-max gap-1">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={async () => {
                setActiveTab(key);
                if (key === 'users' && !blocksState.data.length) await reloadBlocks();
                if (key === 'audit' && !auditState.data.length) await reloadAudit();
              }}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-black transition ${activeTab === key ? 'bg-gnd-red text-white' : 'text-gnd-gray hover:bg-gnd-cream hover:text-gnd-red'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'applications' ? (state.loading ? (
        <div className="grid h-72 place-items-center rounded-lg bg-white">
          <Loader2 className="animate-spin text-gnd-red" size={32} />
        </div>
      ) : !state.applications.length ? (
        <div className="grid h-72 place-items-center rounded-lg bg-white text-center">
          <div>
            <Inbox className="mx-auto text-gnd-gray" size={36} />
            <p className="mt-3 text-lg font-black text-gnd-dark">No coach applications yet</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="grid gap-3 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
            {state.applications.map((application) => (
              <button
                key={application.id}
                type="button"
                onClick={() => {
                  setSelectedId(application.id);
                  applyApplicationDraft(application);
                }}
                className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-gnd-red/30 ${application.id === selectedApplication?.id ? 'border-gnd-red ring-2 ring-gnd-red/10' : 'border-transparent'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gnd-dark">{application.publicName || application.legalName || 'Unnamed applicant'}</p>
                    <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{application.email}</p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-gnd-gray">{application.activityType || application.serviceTitle || application.credentialName}</p>
              </button>
            ))}
          </aside>

          {selectedApplication && (
            <ApplicationDetail
              application={selectedApplication}
              decisionMessage={decisionMessage}
              setDecisionMessage={setDecisionMessage}
              staffNote={staffNote}
              setStaffNote={setStaffNote}
              serviceForm={serviceForm}
              setServiceForm={setServiceForm}
              saving={reviewState.saving}
              permissions={staffState.context.permissions}
              onDecision={handleDecision}
              onCreateService={handleCreateService}
              onOpenMessages={() => navigate(`/${i18n.language}/messages?user=${encodeURIComponent(selectedApplication.applicantUserId || selectedApplication.email)}`)}
            />
          )}
        </div>
      )) : null}

      {activeTab === 'services' && (
        <ServiceOpsPanel
          application={selectedApplication}
          serviceForm={serviceForm}
          setServiceForm={setServiceForm}
          saving={reviewState.saving}
          onCreateService={handleCreateService}
        />
      )}

      {activeTab === 'users' && (
        <UserBlocksPanel
          blocksState={blocksState}
          blockForm={blockForm}
          setBlockForm={setBlockForm}
          saving={reviewState.saving}
          canUnblock={can('user.unblock')}
          onCreateBlock={handleCreateBlock}
          onLiftBlock={handleLiftBlock}
        />
      )}

      {activeTab === 'staff' && (
        <StaffAdminPanel staffContext={staffState.context} />
      )}

      {activeTab === 'audit' && (
        <AuditPanel auditState={auditState} />
      )}
    </section>
  );
}

function ApplicationDetail({
  application,
  decisionMessage,
  setDecisionMessage,
  staffNote,
  setStaffNote,
  serviceForm,
  setServiceForm,
  saving,
  permissions,
  onDecision,
  onCreateService,
  onOpenMessages,
}) {
  const canMessage = Boolean(application.applicantUserId || application.email);
  const canRequestInfo = permissions?.includes('application.request_info');
  const canApprove = permissions?.includes('application.approve');
  const canReject = permissions?.includes('application.reject');
  const canCreateService = permissions?.includes('service.create');

  return (
    <article className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-gnd-cream pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <StatusBadge status={application.status} />
          <h2 className="mt-3 text-2xl font-black text-gnd-dark">{application.publicName || application.legalName}</h2>
          <p className="mt-1 text-sm font-bold text-gnd-gray">{application.email} {application.phone ? ` / ${application.phone}` : ''}</p>
          {!application.applicantUserId && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
              No applicant user id is stored. Staff messaging will try to match by email; if no user account exists, ask the applicant to register first.
            </p>
          )}
        </div>
        <button type="button" onClick={onOpenMessages} disabled={!canMessage} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark hover:text-gnd-red disabled:opacity-40">
          <MessageSquare size={16} />
          Open chat
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoPanel title="Private verification">
          <Detail label="Legal name" value={application.legalName} />
          <Detail label="Public name" value={application.publicName} />
          <Detail label="Languages" value={(application.languages || []).join(', ')} />
          <Detail label="Submitted" value={formatDate(application.submittedAt)} />
        </InfoPanel>
        <InfoPanel title="Credential">
          <Detail label="Activity" value={application.activityType} />
          <Detail label="Qualification" value={application.credentialName} />
          <Detail label="Attainment year" value={application.attainmentYear} />
          <Detail label="Notes" value={application.proofNotes} />
        </InfoPanel>
        <InfoPanel title="Service">
          <Detail label="Title" value={application.serviceTitle} />
          <Detail label="Location" value={application.serviceLocation || application.manualLocation} />
          <Detail label="Duration" value={`${application.minDurationHours || 1} hour(s)`} />
          <Detail label="Description" value={application.serviceDescription} />
        </InfoPanel>
        <InfoPanel title="Pricing">
          {(application.pricing || []).length ? application.pricing.map((tier, index) => (
            <Detail key={index} label={tier.skillLevel || `Tier ${index + 1}`} value={`${tier.currency || application.currency} ${tier.price1 || '-'} / extra ${tier.extraPersonFee || 0}`} />
          )) : <Detail label="Pricing" value={application.pricingLater ? 'Applicant will provide pricing later' : ''} />}
        </InfoPanel>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ImagePanel title="Profile photo" url={application.profilePhotoUrl} />
        <ImagePanel title="Certificate photo" url={application.certificateUrl} />
      </div>

      {(canRequestInfo || canApprove || canReject) && (
      <section className="mt-6 rounded-lg border border-gnd-cream p-4">
        <h3 className="text-lg font-black text-gnd-dark">Review decision</h3>
        <label className="mt-4 grid gap-2">
          <span className="text-sm font-black text-gnd-dark">Internal note</span>
          <textarea rows={3} value={staffNote} onChange={(event) => setStaffNote(event.target.value)} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20" />
        </label>
        <label className="mt-4 grid gap-2">
          <span className="text-sm font-black text-gnd-dark">Applicant chat message</span>
          <textarea rows={4} value={decisionMessage} onChange={(event) => setDecisionMessage(event.target.value)} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {canApprove && <DecisionButton icon={CheckCircle2} label="Approve" disabled={saving} onClick={() => onDecision('approved')} tone="approve" />}
          {canRequestInfo && <DecisionButton icon={MessageSquare} label="Need info" disabled={saving} onClick={() => onDecision('needs_info')} />}
          {canReject && <DecisionButton icon={XCircle} label="Reject" disabled={saving} onClick={() => onDecision('rejected')} tone="reject" />}
        </div>
      </section>
      )}

      {canCreateService && (
      <section className="mt-6 rounded-lg border border-gnd-cream p-4">
        <h3 className="text-lg font-black text-gnd-dark">Create another service</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Uses the same activity, credential, certificate, and coverage areas from this application.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-black text-gnd-dark">Service description</span>
            <textarea rows={3} value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
          </label>
          <Field label="Minimum hours" type="number" value={serviceForm.minDurationHours} onChange={(value) => setServiceForm((current) => ({ ...current, minDurationHours: value }))} />
          <Field label="Currency" value={serviceForm.currency} onChange={(value) => setServiceForm((current) => ({ ...current, currency: value }))} />
          <Field label="Base price" type="number" value={serviceForm.price1} onChange={(value) => setServiceForm((current) => ({ ...current, price1: value }))} />
          <Field label="Extra person fee" type="number" value={serviceForm.extraPersonFee} onChange={(value) => setServiceForm((current) => ({ ...current, extraPersonFee: value }))} />
        </div>
        <button type="button" onClick={onCreateService} disabled={saving || !application.instructorProfileId} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gnd-dark px-4 py-3 text-sm font-black text-white hover:bg-gnd-red disabled:opacity-40">
          <Plus size={16} />
          Create service
        </button>
      </section>
      )}
    </article>
  );
}

function ServiceOpsPanel({ application, serviceForm, setServiceForm, saving, onCreateService }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <div className="flex flex-col gap-2 border-b border-gnd-cream pb-5">
        <h2 className="text-2xl font-black text-gnd-dark">Service operations</h2>
        <p className="max-w-2xl text-sm font-bold leading-6 text-gnd-gray">
          Create additional services for approved coaches. Select an approved application from the Applications tab first so the service can inherit its coach, activity, credential, certificate, and coverage areas.
        </p>
      </div>
      {!application?.instructorProfileId && (
        <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Select an approved application before creating a service.</p>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-black text-gnd-dark">Service description</span>
          <textarea rows={4} value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
        </label>
        <Field label="Minimum hours" type="number" value={serviceForm.minDurationHours} onChange={(value) => setServiceForm((current) => ({ ...current, minDurationHours: value }))} />
        <Field label="Currency" value={serviceForm.currency} onChange={(value) => setServiceForm((current) => ({ ...current, currency: value }))} />
        <Field label="Base price" type="number" value={serviceForm.price1} onChange={(value) => setServiceForm((current) => ({ ...current, price1: value }))} />
        <Field label="Extra person fee" type="number" value={serviceForm.extraPersonFee} onChange={(value) => setServiceForm((current) => ({ ...current, extraPersonFee: value }))} />
      </div>
      <button type="button" onClick={onCreateService} disabled={saving || !application?.instructorProfileId} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gnd-dark px-4 py-3 text-sm font-black text-white hover:bg-gnd-red disabled:opacity-40">
        <Plus size={16} />
        Create service
      </button>
    </section>
  );
}

function UserBlocksPanel({ blocksState, blockForm, setBlockForm, saving, canUnblock, onCreateBlock, onLiftBlock }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={onCreateBlock} className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5">
        <h2 className="text-2xl font-black text-gnd-dark">Block user</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">Temporarily or permanently block a user from normal learner/social actions.</p>
        <div className="mt-5 grid gap-3">
          <Field label="User ID" value={blockForm.userId} onChange={(value) => setBlockForm((current) => ({ ...current, userId: value }))} />
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Block type</span>
            <select value={blockForm.status} onChange={(event) => setBlockForm((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
              <option value="temporary">Temporary</option>
              <option value="permanent">Permanent</option>
            </select>
          </label>
          {blockForm.status === 'temporary' && (
            <Field label="Blocked until" type="datetime-local" value={blockForm.blockedUntil} onChange={(value) => setBlockForm((current) => ({ ...current, blockedUntil: value }))} />
          )}
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Reason</span>
            <textarea rows={4} value={blockForm.reason} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
          </label>
          <button type="submit" disabled={saving || !blockForm.userId} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
            <UserLock size={16} />
            Block user
          </button>
        </div>
      </form>

      <div className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5">
        <h2 className="text-2xl font-black text-gnd-dark">Recent blocks</h2>
        {blocksState.loading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-gnd-red" /></div>
        ) : blocksState.error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{blocksState.error}</p>
        ) : !blocksState.data.length ? (
          <p className="mt-4 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No user blocks recorded.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {blocksState.data.map((block) => (
              <div key={block.id} className="rounded-lg border border-gnd-cream p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gnd-dark">{block.userName}</p>
                    <p className="mt-1 text-xs font-bold text-gnd-gray">{block.userEmail || block.userId}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${block.liftedAt ? 'bg-gnd-cream text-gnd-gray' : 'bg-red-50 text-gnd-red'}`}>{block.liftedAt ? 'lifted' : block.status}</span>
                </div>
                {block.reason && <p className="mt-3 text-sm font-bold text-gnd-gray">{block.reason}</p>}
                {!block.liftedAt && canUnblock && (
                  <button type="button" onClick={() => onLiftBlock(block.id)} className="mt-3 text-xs font-black uppercase tracking-widest text-gnd-red hover:underline">Lift block</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StaffAdminPanel({ staffContext }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <h2 className="text-2xl font-black text-gnd-dark">Staff administration</h2>
      <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-gnd-gray">
        Staff creation should be database-backed through <code className="rounded bg-gnd-cream px-1">staff_members</code>, <code className="rounded bg-gnd-cream px-1">staff_roles</code>, and role assignments. The next UI step is an invite form for IT admins to add a user email, choose department, and assign roles.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoPanel title="Current staff member">
          <Detail label="Name" value={staffContext.member?.displayName} />
          <Detail label="Email" value={staffContext.member?.email} />
          <Detail label="Department" value={staffContext.member?.department} />
          <Detail label="Source" value={staffContext.source} />
        </InfoPanel>
        <InfoPanel title="Permissions">
          <Detail label="Roles" value={(staffContext.roles || []).map((role) => role.name || role.key).join(', ')} />
          <Detail label="Permission keys" value={(staffContext.permissions || []).join(', ')} />
        </InfoPanel>
      </div>
    </section>
  );
}

function AuditPanel({ auditState }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <h2 className="text-2xl font-black text-gnd-dark">Audit history</h2>
      {auditState.loading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-gnd-red" /></div>
      ) : auditState.error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{auditState.error}</p>
      ) : !auditState.data.length ? (
        <p className="mt-4 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No audit events yet.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {auditState.data.map((event) => (
            <div key={event.id} className="rounded-lg border border-gnd-cream p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-black text-gnd-dark">{event.action}</p>
                <p className="text-xs font-bold text-gnd-gray">{formatDateTime(event.createdAt)}</p>
              </div>
              <p className="mt-2 text-xs font-bold text-gnd-gray">{event.targetType} {event.targetId}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoPanel({ title, children }) {
  return (
    <section className="rounded-lg bg-gnd-cream/50 p-4">
      <h3 className="text-sm font-black text-gnd-dark">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">{label}</span>
      <span className="break-words text-sm font-bold text-gnd-dark">{value || 'Not provided'}</span>
    </div>
  );
}

function ImagePanel({ title, url }) {
  return (
    <section className="rounded-lg border border-gnd-cream p-4">
      <h3 className="text-sm font-black text-gnd-dark">{title}</h3>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg bg-gnd-cream">
          <img src={url} alt="" className="max-h-80 w-full object-contain" />
        </a>
      ) : (
        <p className="mt-3 text-sm font-bold text-gnd-gray">No image uploaded</p>
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[status] || statusStyles.new}`}>
      {statusLabels[status] || statusLabels.new}
    </span>
  );
}

function DecisionButton({ icon: Icon, label, onClick, disabled, tone = 'default' }) {
  const toneClass = tone === 'approve'
    ? 'bg-green-600 text-white hover:bg-green-700'
    : tone === 'reject'
      ? 'bg-gnd-red text-white hover:bg-gnd-dark'
      : 'bg-gnd-cream text-gnd-dark hover:text-gnd-red';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:opacity-50 ${toneClass}`}>
      <Icon size={16} />
      {label}
    </button>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-gnd-dark">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none" />
    </label>
  );
}

function defaultDecisionMessage(status, application) {
  const name = application.publicName || application.legalName || 'there';
  if (status === 'approved') return `Hi ${name}, your GuideNextdoor coach application has been approved. Your coach profile and first service are being prepared for public listing.`;
  if (status === 'rejected') return `Hi ${name}, we reviewed your GuideNextdoor coach application and cannot approve it at this stage. You can reply here if you would like our team to clarify the decision.`;
  if (status === 'needs_info') return `Hi ${name}, we need a bit more information before we can continue reviewing your GuideNextdoor coach application. Please reply in this chat with the requested details.`;
  return `Hi ${name}, your GuideNextdoor coach application is now under review.`;
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateTime(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
