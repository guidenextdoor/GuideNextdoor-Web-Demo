import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, FileCheck, Inbox, Loader2, MessageSquare, Plus, RefreshCw, Search, Shield, Trash2, UserLock, Users, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  approveCoachApplication,
  createStaffMemberAccount,
  createUserBlock,
  escalateComplaintToSuspension,
  fetchCurrentStaffContext,
  fetchStaffComplaints,
  fetchSuspensionReviewQueue,
  fetchStaffAuditLogs,
  fetchStaffApplications,
  fetchStaffDirectory,
  fetchStaffPostModerationQueue,
  fetchStaffRoleCatalog,
  fetchStaffServiceRequests,
  fetchUserBlocks,
  getCurrentSession,
  hasStaffPermission,
  hasStaffRole,
  liftUserBlock,
  searchSuspensionAccounts,
  sendComplaintSupportMessage,
  updateCoachApplicationPublicCertificate,
  updateStaffMemberAccount,
  updateStaffServiceRequestReview,
  updateCoachApplicationReview,
  updateComplaintReview,
  updateStaffPostModeration,
} from '../../lib/database';

const statusLabels = {
  new: 'New',
  in_review: 'In review',
  needs_info: 'Needs info',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending',
};

const statusStyles = {
  new: 'bg-blue-50 text-blue-600 border-blue-100',
  in_review: 'bg-amber-50 text-amber-600 border-amber-100',
  needs_info: 'bg-purple-50 text-purple-600 border-purple-100',
  approved: 'bg-green-50 text-green-600 border-green-100',
  rejected: 'bg-red-50 text-gnd-red border-red-100',
  pending: 'bg-amber-50 text-amber-600 border-amber-100',
};

const staffTabs = [
  { key: 'applications', label: 'Coach applications', icon: FileCheck, permission: 'application.view' },
  { key: 'services', label: 'Service approval', icon: Plus, permission: 'service.approve' },
  { key: 'complaints', label: 'Complaints', icon: MessageSquare, permission: 'user.block' },
  { key: 'users', label: 'Suspension', icon: UserLock, permission: 'user.block' },
  { key: 'posts', label: 'Post deletion', icon: Trash2, permission: 'user.block' },
  { key: 'audit', label: 'Audit', icon: Shield, permission: 'audit.view' },
  { key: 'staff', label: 'Account creation', icon: Users, role: 'super_admin' },
];

export default function StaffDashboardView() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const session = getCurrentSession();
  const [staffState, setStaffState] = useState({ loading: true, context: null, error: '' });
  const [state, setState] = useState({ loading: true, applications: [], error: '' });
  const [serviceState, setServiceState] = useState({ loading: false, data: [], error: '' });
  const [complaintsState, setComplaintsState] = useState({ loading: false, data: [], error: '' });
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [complaintQueueFilter, setComplaintQueueFilter] = useState('open');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQueueFilter, setServiceQueueFilter] = useState('pending');
  const [postModerationState, setPostModerationState] = useState({ loading: false, data: [], error: '' });
  const [selectedPostId, setSelectedPostId] = useState('');
  const [postQueueFilter, setPostQueueFilter] = useState('recent');
  const [directoryState, setDirectoryState] = useState({ loading: false, members: [], roles: [], error: '' });
  const [auditState, setAuditState] = useState({ loading: false, data: [], error: '' });
  const [blocksState, setBlocksState] = useState({ loading: false, data: [], error: '' });
  const [suspensionQueueState, setSuspensionQueueState] = useState({ loading: false, data: [], error: '' });
  const [suspensionSearchState, setSuspensionSearchState] = useState({ loading: false, query: '', data: [], error: '' });
  const [selectedSuspensionAccount, setSelectedSuspensionAccount] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState('applications');
  const [applicationQueueFilter, setApplicationQueueFilter] = useState('active');
  const [reviewState, setReviewState] = useState({ saving: false, error: '', notice: '' });
  const [decisionMessage, setDecisionMessage] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [serviceForm, setServiceForm] = useState({ description: '', minDurationHours: 1, price1: '', extraPersonFee: '', currency: 'HKD' });
  const [certificateMaskApplication, setCertificateMaskApplication] = useState(null);
  const [blockForm, setBlockForm] = useState({
    userId: '',
    status: 'temporary',
    blockedUntil: '',
    reasonCategory: 'policy_violation',
    reason: '',
    userMessage: '',
    internalNote: '',
  });
  const [staffFilters, setStaffFilters] = useState({ query: '', department: 'all', role: 'all', status: 'all', sensitiveOnly: false });
  const [staffModal, setStaffModal] = useState({ type: '', member: null });

  const selectedApplication = useMemo(
    () => state.applications.find((application) => application.id === selectedId) || state.applications[0] || null,
    [selectedId, state.applications],
  );
  const selectedComplaint = useMemo(
    () => complaintsState.data.find((complaint) => complaint.id === selectedComplaintId) || complaintsState.data[0] || null,
    [complaintsState.data, selectedComplaintId],
  );
  const selectedService = useMemo(
    () => serviceState.data.find((service) => service.id === selectedServiceId) || serviceState.data[0] || null,
    [serviceState.data, selectedServiceId],
  );
  const selectedPost = useMemo(
    () => postModerationState.data.find((post) => post.id === selectedPostId) || postModerationState.data[0] || null,
    [postModerationState.data, selectedPostId],
  );
  const visibleTabs = useMemo(
    () => staffTabs.filter((tab) => (tab.role ? hasStaffRole(staffState.context, tab.role) : hasStaffPermission(staffState.context, tab.permission))),
    [staffState.context],
  );
  const can = (permission) => hasStaffPermission(staffState.context, permission);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentStaffContext().then(async (contextResult) => {
        if (cancelled) return;
      try {
        setStaffState({ loading: false, context: contextResult.data, error: contextResult.error || '' });
        const firstTab = staffTabs.find((tab) => (tab.role ? hasStaffRole(contextResult.data, tab.role) : hasStaffPermission(contextResult.data, tab.permission)))?.key || '';
        setActiveTab(firstTab);
        if (hasStaffPermission(contextResult.data, 'application.view')) {
          setState((current) => ({ ...current, loading: true, error: '' }));
          const result = await fetchStaffApplications();
          if (cancelled) return;
          setState({ loading: false, applications: result.data || [], error: result.error || '' });
          const firstApplication = result.data?.[0] || null;
          setSelectedId((current) => current || firstApplication?.id || '');
          if (firstApplication) applyApplicationDraft(firstApplication);
        } else {
          setState({ loading: false, applications: [], error: '' });
        }
        if (hasStaffPermission(contextResult.data, 'service.approve') || hasStaffPermission(contextResult.data, 'service.create')) {
          setServiceState({ loading: true, data: [], error: '' });
          const serviceResult = await fetchStaffServiceRequests();
          if (cancelled) return;
          setServiceState({ loading: false, data: serviceResult.data || [], error: serviceResult.error || '' });
          setSelectedServiceId((current) => current || serviceResult.data?.[0]?.id || '');
        }
      } catch (error) {
        if (cancelled) return;
        const message = error?.message || String(error);
        setStaffState((current) => ({ ...current, loading: false, error: message }));
        setState((current) => ({ ...current, loading: false, error: message }));
        setServiceState((current) => ({ ...current, loading: false, error: message }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return <Navigate to={`/${i18n.language}/staff/login`} replace />;
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
    if (activeTab === 'complaints' && can('user.block')) await reloadComplaints();
    if (activeTab === 'services' && (can('service.approve') || can('service.create'))) await reloadServices();
    if (activeTab === 'staff' && hasStaffRole(staffState.context, 'super_admin')) await reloadDirectory();
    if (activeTab === 'users' && can('user.block')) await reloadSuspensionWorkspace();
    if (activeTab === 'posts' && can('user.block')) await reloadPostModeration();
    if (activeTab === 'audit' && can('audit.view')) await reloadAudit();
  };

  const reloadApplications = async () => {
    await loadApplications(false);
  };

  const loadApplications = async (cancelled) => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    const result = await fetchStaffApplications();
    if (cancelled) return;
    setState({ loading: false, applications: result.data || [], error: result.error || '' });
    const nextSelected = result.data?.find((application) => application.id === selectedId) || result.data?.[0] || null;
    setSelectedId(nextSelected?.id || '');
    if (nextSelected) applyApplicationDraft(nextSelected);
  };

  const reloadServices = async () => {
    await loadServices(false);
  };

  const reloadComplaints = async () => {
    setComplaintsState({ loading: true, data: [], error: '' });
    const result = await fetchStaffComplaints();
    setComplaintsState({ loading: false, data: result.data || [], error: result.error || '' });
    setSelectedComplaintId((current) => current || result.data?.[0]?.id || '');
  };

  const loadServices = async (cancelled) => {
    setServiceState({ loading: true, data: [], error: '' });
    const result = await fetchStaffServiceRequests();
    if (cancelled) return;
    setServiceState({ loading: false, data: result.data || [], error: result.error || '' });
    setSelectedServiceId((current) => result.data?.find((service) => service.id === current)?.id || result.data?.[0]?.id || '');
  };

  const reloadDirectory = async () => {
    await loadDirectory(false);
  };

  const loadDirectory = async (cancelled) => {
    setDirectoryState((current) => ({ ...current, loading: true, error: '' }));
    const [membersResult, rolesResult] = await Promise.all([
      fetchStaffDirectory(),
      fetchStaffRoleCatalog(),
    ]);
    if (cancelled) return;
    setDirectoryState({
      loading: false,
      members: membersResult.data || [],
      roles: rolesResult.data || [],
      error: membersResult.error || rolesResult.error || '',
    });
  };

  const reloadBlocks = async () => {
    setBlocksState({ loading: true, data: [], error: '' });
    const result = await fetchUserBlocks();
    setBlocksState({ loading: false, data: result.data || [], error: result.error || '' });
  };

  const reloadSuspensionWorkspace = async () => {
    setBlocksState({ loading: true, data: [], error: '' });
    setSuspensionQueueState({ loading: true, data: [], error: '' });
    const [blocksResult, queueResult] = await Promise.all([
      fetchUserBlocks(),
      fetchSuspensionReviewQueue(),
    ]);
    setBlocksState({ loading: false, data: blocksResult.data || [], error: blocksResult.error || '' });
    setSuspensionQueueState({ loading: false, data: queueResult.data || [], error: queueResult.error || '' });
  };

  const reloadPostModeration = async () => {
    setPostModerationState({ loading: true, data: [], error: '' });
    const result = await fetchStaffPostModerationQueue();
    setPostModerationState({ loading: false, data: result.data || [], error: result.error || '' });
    setSelectedPostId((current) => result.data?.find((post) => post.id === current)?.id || result.data?.[0]?.id || '');
  };

  const handleSuspensionSearch = async (event) => {
    event.preventDefault();
    const query = suspensionSearchState.query.trim();
    if (query.length < 2) {
      setSuspensionSearchState((current) => ({ ...current, error: 'Enter at least 2 characters.', data: [] }));
      return;
    }
    setSuspensionSearchState((current) => ({ ...current, loading: true, error: '' }));
    const result = await searchSuspensionAccounts(query);
    setSuspensionSearchState((current) => ({
      ...current,
      loading: false,
      data: result.data || [],
      error: result.error || '',
    }));
  };

  const selectSuspensionAccount = (account) => {
    setSelectedSuspensionAccount(account);
    setBlockForm((current) => ({ ...current, userId: account.id }));
  };

  const reloadAudit = async () => {
    setAuditState({ loading: true, data: [], error: '' });
    const result = await fetchStaffAuditLogs();
    setAuditState({ loading: false, data: result.data || [], error: result.error || '' });
  };

  const handleDecision = async (status, application = selectedApplication) => {
    if (!application) return;
    setReviewState({ saving: true, error: '', notice: '' });
    const action = status === 'approved' ? approveCoachApplication : updateCoachApplicationReview;
    const result = await action({
      applicationId: application.id,
      status,
      staffNote,
      applicantMessage: decisionMessage,
      serviceOverride: status === 'approved' ? {
        description: serviceForm.description,
        minDurationHours: serviceForm.minDurationHours,
        pricing: [{
          skillLevel: 'All Levels',
          currency: serviceForm.currency || application.currency || 'HKD',
          price1: serviceForm.price1,
          extraPersonFee: serviceForm.extraPersonFee,
        }],
        maskedCertUrl: application.publicCertificateUrl,
      } : undefined,
    });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Application updated and applicant message sent.' });
    await reload();
  };

  const handleSavePublicCertificate = async ({ applicationId, file }) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await updateCoachApplicationPublicCertificate({ applicationId, file });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Public certificate preview saved.' });
    setCertificateMaskApplication(null);
    await reloadApplications();
  };

  const handleCreateBlock = async (event) => {
    event.preventDefault();
    if (!selectedSuspensionAccount || blockForm.userId !== selectedSuspensionAccount.id) {
      setReviewState({ saving: false, error: 'Confirm the account before entering suspension details.', notice: '' });
      return;
    }
    if (selectedSuspensionAccount.isStaff) {
      setReviewState({ saving: false, error: 'Staff accounts must be managed from Account creation, not user suspension.', notice: '' });
      return;
    }
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await createUserBlock(blockForm);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Account suspended and support notice sent.' });
    setBlockForm({
      userId: '',
      status: 'temporary',
      blockedUntil: '',
      reasonCategory: 'policy_violation',
      reason: '',
      userMessage: '',
      internalNote: '',
    });
    setSelectedSuspensionAccount(null);
    setSuspensionSearchState((current) => ({ ...current, data: [] }));
    await reloadBlocks();
    const queueResult = await fetchSuspensionReviewQueue();
    setSuspensionQueueState({ loading: false, data: queueResult.data || [], error: queueResult.error || '' });
  };

  const handleLiftBlock = async (blockId) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await liftUserBlock(blockId);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Suspension lifted.' });
    await reloadSuspensionWorkspace();
  };

  const handleServiceDecision = async (serviceId, status) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await updateStaffServiceRequestReview({ serviceId, status });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: `Service ${status.toLowerCase()}.` });
    await reloadServices();
  };

  const handlePostModeration = async ({ postId, action, reasonCategory, staffNote, authorMessage }) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await updateStaffPostModeration({ postId, action, reasonCategory, staffNote, authorMessage });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({
      saving: false,
      error: '',
      notice: action === 'remove' ? 'Post removed and author notice sent.' : action === 'approve' ? 'Post marked as reviewed.' : 'Post restored.',
    });
    await reloadPostModeration();
  };

  const handleComplaintDecision = async ({ complaintId, status, severity, staffNote, priority, assignedTeam, slaDueAt }) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await updateComplaintReview({ complaintId, status, severity, staffNote, priority, assignedTeam, slaDueAt });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Complaint updated.' });
    await reloadComplaints();
  };

  const handleComplaintMessage = async ({ complaintId, recipientRole, body }) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await sendComplaintSupportMessage({ complaintId, recipientRole, body });
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Message sent as GuideNextdoor Support.' });
    await reloadComplaints();
  };

  const handleSendComplaintToSuspension = async (complaintId) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await escalateComplaintToSuspension(complaintId);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    const complaint = result.data;
    setSelectedSuspensionAccount({
      id: complaint.reportedUserId,
      displayName: complaint.reportedName,
      email: complaint.reportedEmail,
      avatarUrl: complaint.reportedAvatarUrl,
      accountType: 'reported account',
      signals: [{ label: complaint.reasonLabel, detail: complaint.description }],
      riskScore: complaint.severity === 'critical' ? 5 : 4,
    });
    setBlockForm((current) => ({
      ...current,
      ...complaint.suspensionDraft,
      status: 'temporary',
      blockedUntil: current.blockedUntil,
    }));
    setActiveTab('users');
    setReviewState({ saving: false, error: '', notice: 'Complaint sent to Suspension. Review the suspension details before submitting.' });
    await reloadSuspensionWorkspace();
  };

  const handleCreateStaff = async (payload) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await createStaffMemberAccount(payload);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Staff access updated.' });
    setStaffModal({ type: '', member: null });
    await reloadDirectory();
  };

  const handleUpdateStaff = async (payload) => {
    setReviewState({ saving: true, error: '', notice: '' });
    const result = await updateStaffMemberAccount(payload);
    if (result.error) {
      setReviewState({ saving: false, error: result.error, notice: '' });
      return;
    }
    setReviewState({ saving: false, error: '', notice: 'Staff member updated.' });
    setStaffModal({ type: '', member: null });
    await reloadDirectory();
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {staffState.context.roles?.map((role) => (
            <span key={role.key} className="rounded-md bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray shadow-sm">{role.name || role.key}</span>
          ))}
          {staffState.context.source === 'env_fallback' && (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">local env access</span>
          )}
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
                if (key === 'complaints' && !complaintsState.data.length) await reloadComplaints();
                if (key === 'staff' && hasStaffRole(staffState.context, 'super_admin') && !directoryState.members.length && !directoryState.roles.length) await reloadDirectory();
                if (key === 'users' && !blocksState.data.length && !suspensionQueueState.data.length) await reloadSuspensionWorkspace();
                if (key === 'posts' && !postModerationState.data.length) await reloadPostModeration();
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

      {activeTab === 'applications' && (
        <ApplicationsPanel
          applicationState={state}
          selectedApplication={selectedApplication}
          selectedApplicationId={selectedId}
          setSelectedApplicationId={setSelectedId}
          queueFilter={applicationQueueFilter}
          setQueueFilter={setApplicationQueueFilter}
          applyApplicationDraft={applyApplicationDraft}
          decisionMessage={decisionMessage}
          setDecisionMessage={setDecisionMessage}
          staffNote={staffNote}
          setStaffNote={setStaffNote}
          serviceForm={serviceForm}
          setServiceForm={setServiceForm}
          saving={reviewState.saving}
          permissions={staffState.context.permissions}
          onDecision={handleDecision}
          onOpenMessages={(application) => application && navigate(`/${i18n.language}/messages?user=${encodeURIComponent(application.applicantUserId || application.email)}`)}
          onMaskCertificate={(application) => application && setCertificateMaskApplication(application)}
        />
      )}

      {activeTab === 'complaints' && (
        <ComplaintsPanel
          complaintsState={complaintsState}
          selectedComplaint={selectedComplaint}
          selectedComplaintId={selectedComplaintId}
          setSelectedComplaintId={setSelectedComplaintId}
          queueFilter={complaintQueueFilter}
          setQueueFilter={setComplaintQueueFilter}
          saving={reviewState.saving}
          onDecision={handleComplaintDecision}
          onMessage={handleComplaintMessage}
          onSendToSuspension={handleSendComplaintToSuspension}
        />
      )}

      {activeTab === 'services' && (
        <ServiceOpsPanel
          serviceState={serviceState}
          selectedService={selectedService}
          selectedServiceId={selectedServiceId}
          setSelectedServiceId={setSelectedServiceId}
          queueFilter={serviceQueueFilter}
          setQueueFilter={setServiceQueueFilter}
          saving={reviewState.saving}
          onDecision={handleServiceDecision}
        />
      )}

      {activeTab === 'users' && (
        <UserBlocksPanel
          blocksState={blocksState}
          queueState={suspensionQueueState}
          searchState={suspensionSearchState}
          setSearchState={setSuspensionSearchState}
          selectedAccount={selectedSuspensionAccount}
          blockForm={blockForm}
          setBlockForm={setBlockForm}
          saving={reviewState.saving}
          canUnblock={can('user.unblock')}
          onSearch={handleSuspensionSearch}
          onSelectAccount={selectSuspensionAccount}
          onCreateBlock={handleCreateBlock}
          onLiftBlock={handleLiftBlock}
        />
      )}

      {activeTab === 'staff' && (
        <StaffAdminPanel
          staffContext={staffState.context}
          directoryState={directoryState}
          filters={staffFilters}
          setFilters={setStaffFilters}
          onInvite={() => setStaffModal({ type: 'invite', member: null })}
          onOpenMember={(member) => setStaffModal({ type: 'detail', member })}
        />
      )}

      {activeTab === 'posts' && (
        <PostModerationPanel
          postState={postModerationState}
          selectedPost={selectedPost}
          selectedPostId={selectedPostId}
          setSelectedPostId={setSelectedPostId}
          queueFilter={postQueueFilter}
          setQueueFilter={setPostQueueFilter}
          saving={reviewState.saving}
          onModerate={handlePostModeration}
        />
      )}

      {activeTab === 'audit' && (
        <AuditPanel auditState={auditState} />
      )}

      {staffModal.type === 'invite' && (
        <StaffInviteModal
          roles={directoryState.roles}
          saving={reviewState.saving}
          onClose={() => setStaffModal({ type: '', member: null })}
          onSubmit={handleCreateStaff}
        />
      )}

      {staffModal.type === 'detail' && staffModal.member && (
        <StaffDetailModal
          member={staffModal.member}
          roles={directoryState.roles}
          saving={reviewState.saving}
          onClose={() => setStaffModal({ type: '', member: null })}
          onSubmit={handleUpdateStaff}
        />
      )}

      {certificateMaskApplication && (
        <CertificateMaskModal
          application={certificateMaskApplication}
          saving={reviewState.saving}
          onClose={() => setCertificateMaskApplication(null)}
          onSave={handleSavePublicCertificate}
        />
      )}
    </section>
  );
}

function ApplicationsPanel({
  applicationState,
  selectedApplication,
  selectedApplicationId,
  setSelectedApplicationId,
  queueFilter,
  setQueueFilter,
  applyApplicationDraft,
  decisionMessage,
  setDecisionMessage,
  staffNote,
  setStaffNote,
  serviceForm,
  setServiceForm,
  saving,
  permissions,
  onDecision,
  onOpenMessages,
  onMaskCertificate,
}) {
  const applications = applicationState.applications || [];
  const filteredApplications = filterApplicationsByQueue(applications, queueFilter);
  const effectiveSelected = filteredApplications.find((application) => application.id === selectedApplicationId)
    || (filteredApplications.some((application) => application.id === selectedApplication?.id) ? selectedApplication : null);
  const queueCounts = {
    active: applications.filter((application) => ['new', 'in_review', 'needs_info'].includes(application.status)).length,
    new: applications.filter((application) => application.status === 'new').length,
    in_review: applications.filter((application) => application.status === 'in_review').length,
    needs_info: applications.filter((application) => application.status === 'needs_info').length,
    approved: applications.filter((application) => application.status === 'approved').length,
    rejected: applications.filter((application) => application.status === 'rejected').length,
  };
  const queueOptions = [
    ['active', 'Active review'],
    ['new', 'New applications'],
    ['in_review', 'In review'],
    ['needs_info', 'Needs more info'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
  ];

  useEffect(() => {
    if (applicationState.loading || !filteredApplications.length) return;
    if (effectiveSelected?.id) return;
    setSelectedApplicationId(filteredApplications[0].id);
    applyApplicationDraft(filteredApplications[0]);
  }, [applicationState.loading, effectiveSelected?.id, filteredApplications, setSelectedApplicationId, applyApplicationDraft]);

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="rounded-lg bg-white p-4 shadow-lg shadow-red-900/5">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Application queue</span>
          <select
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
            className="h-12 w-full rounded-lg border border-gnd-cream bg-gnd-cream px-3 text-sm font-black text-gnd-dark outline-none transition focus:border-gnd-red focus:bg-white"
          >
            {queueOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({queueCounts[key] || 0})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid gap-3 lg:max-h-[calc(100vh-245px)] lg:overflow-y-auto">
          {applicationState.loading && (
            <div className="grid h-48 place-items-center rounded-lg bg-gnd-cream">
              <Loader2 className="animate-spin text-gnd-red" size={28} />
            </div>
          )}
          {!applicationState.loading && applicationState.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{applicationState.error}</p>
          )}
          {!applicationState.loading && !applicationState.error && filteredApplications.map((application) => (
            <button
              key={application.id}
              type="button"
              onClick={() => {
                setSelectedApplicationId(application.id);
                applyApplicationDraft(application);
              }}
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-gnd-red/30 ${application.id === effectiveSelected?.id ? 'border-gnd-red ring-2 ring-gnd-red/10' : 'border-gnd-cream'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gnd-dark">{application.publicName || application.legalName || 'Unnamed applicant'}</p>
                  <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{application.email}</p>
                </div>
                <StatusBadge status={application.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-gnd-gray">{application.activityType || application.serviceTitle || application.credentialName}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!application.publicCertificateUrl && (
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">public cert needed</span>
                )}
                {!application.certificateUrl && (
                  <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-red">missing cert</span>
                )}
              </div>
            </button>
          ))}
          {!applicationState.loading && !applicationState.error && !filteredApplications.length && (
            <p className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No applications in this queue.</p>
          )}
        </div>
      </aside>

      {effectiveSelected ? (
        <ApplicationDetail
          application={effectiveSelected}
          decisionMessage={decisionMessage}
          setDecisionMessage={setDecisionMessage}
          staffNote={staffNote}
          setStaffNote={setStaffNote}
          serviceForm={serviceForm}
          setServiceForm={setServiceForm}
          saving={saving}
          permissions={permissions}
          onDecision={(status) => onDecision(status, effectiveSelected)}
          onOpenMessages={() => onOpenMessages(effectiveSelected)}
          onMaskCertificate={() => onMaskCertificate(effectiveSelected)}
        />
      ) : (
        <ApplicationDetailPlaceholder hasApplications={applications.length > 0} />
      )}
    </section>
  );
}

function ApplicationDetailPlaceholder({ hasApplications }) {
  return (
    <article className="grid min-h-[360px] place-items-center rounded-lg bg-white p-6 text-center shadow-lg shadow-red-900/5">
      <div className="max-w-sm">
        <Inbox className="mx-auto text-gnd-gray" size={36} />
        <p className="mt-3 text-lg font-black text-gnd-dark">{hasApplications ? 'Select an application' : 'No coach applications yet'}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">
          {hasApplications
            ? 'Choose an application from the queue to review identity, credentials, certificate preview, first service, and decision messages.'
            : 'New coach applications will appear in the queue on the left, with review actions shown here.'}
        </p>
      </div>
    </article>
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
  onOpenMessages,
  onMaskCertificate,
}) {
  const canMessage = Boolean(application.applicantUserId || application.email);
  const canRequestInfo = permissions?.includes('application.request_info');
  const canApprove = permissions?.includes('application.approve');
  const canReject = permissions?.includes('application.reject');

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
        <InfoPanel title="First service approval">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Public service description</span>
            <textarea
              rows={4}
              value={serviceForm.description}
              onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))}
              className="rounded-lg bg-gnd-cream px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Min duration hours" type="number" value={serviceForm.minDurationHours} onChange={(value) => setServiceForm((current) => ({ ...current, minDurationHours: value }))} />
            <Field label="Currency" value={serviceForm.currency} onChange={(value) => setServiceForm((current) => ({ ...current, currency: value }))} />
            <Field label="Base price" type="number" value={serviceForm.price1} onChange={(value) => setServiceForm((current) => ({ ...current, price1: value }))} />
            <Field label="Extra person fee" type="number" value={serviceForm.extraPersonFee} onChange={(value) => setServiceForm((current) => ({ ...current, extraPersonFee: value }))} />
          </div>
        </InfoPanel>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ImagePanel title="Profile photo" url={application.profilePhotoUrl} />
        <section className="rounded-lg border border-gnd-cream p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-black text-gnd-dark">Certificate review</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Save a masked public preview before approval if the certificate contains private names or ID details.</p>
            </div>
            <button type="button" onClick={onMaskCertificate} disabled={!application.certificateUrl || saving} className="inline-flex items-center justify-center rounded-lg bg-gnd-dark px-3 py-2 text-xs font-black text-white disabled:opacity-40">
              Mask public preview
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ImagePanel title="Original certificate" url={application.certificateUrl} />
            <ImagePanel title="Public certificate" url={application.publicCertificateUrl} />
          </div>
        </section>
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
    </article>
  );
}

function CertificateMaskModal({ application, saving, onClose, onSave }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [rects, setRects] = useState([]);
  const [draftRect, setDraftRect] = useState(null);
  const [drawingStart, setDrawingStart] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      drawMaskedCertificate(canvas, image, [], null);
    };
    image.onerror = () => setError('Could not load the certificate image for masking.');
    image.src = application.certificateUrl;
  }, [application.certificateUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas && image) drawMaskedCertificate(canvas, image, rects, draftRect);
  }, [rects, draftRect]);

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const point = getCanvasPoint(event);
    setDrawingStart(point);
    setDraftRect(null);
  };

  const updateDrawing = (event) => {
    if (!drawingStart) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point) return;
    setDraftRect(normalizeRect(drawingStart, point));
  };

  const finishDrawing = (event) => {
    if (!drawingStart) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    const rect = point ? normalizeRect(drawingStart, point) : draftRect;
    if (rect && rect.width > 8 && rect.height > 8) {
      setRects((current) => [...current, rect]);
    }
    setDrawingStart(null);
    setDraftRect(null);
  };

  const saveMaskedCertificate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Could not create the public certificate preview.');
          return;
        }
        const file = new File([blob], `public-certificate-${application.id}.jpg`, { type: 'image/jpeg' });
        onSave({ applicationId: application.id, file });
      }, 'image/jpeg', 0.9);
    } catch (saveError) {
      setError(saveError?.message || 'Could not save the public certificate preview.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gnd-dark/55 px-4 py-6">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gnd-cream p-5">
          <div>
            <h2 className="text-lg font-black text-gnd-dark">Mask public certificate preview</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-gnd-gray">Drag over private details to blur them, then save the public preview used on the instructor profile.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream p-2 text-gnd-dark hover:text-gnd-red">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto bg-gnd-cream p-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{error}</p>}
          <canvas
            ref={canvasRef}
            className="mx-auto block max-h-[62vh] max-w-full touch-none rounded-lg bg-white shadow-sm"
            onPointerDown={startDrawing}
            onPointerMove={updateDrawing}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
          />
        </div>
        <div className="flex flex-col gap-3 border-t border-gnd-cream p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-gnd-gray">{rects.length} masked area{rects.length === 1 ? '' : 's'} added</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRects((current) => current.slice(0, -1))} disabled={!rects.length || saving} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark disabled:opacity-40">
              Undo last
            </button>
            <button type="button" onClick={() => setRects([])} disabled={!rects.length || saving} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark disabled:opacity-40">
              Clear
            </button>
            <button type="button" onClick={saveMaskedCertificate} disabled={saving} className="rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
              {saving ? 'Saving...' : 'Save public preview'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceOpsPanel({
  serviceState,
  selectedService,
  selectedServiceId,
  setSelectedServiceId,
  queueFilter,
  setQueueFilter,
  saving,
  onDecision,
}) {
  const services = serviceState.data || [];
  const filteredServices = filterServicesByQueue(services, queueFilter);
  const effectiveSelected = filteredServices.find((service) => service.id === selectedServiceId)
    || (filteredServices.some((service) => service.id === selectedService?.id) ? selectedService : null);
  const queueCounts = {
    pending: services.filter((service) => normalizeServiceStatusKey(service.status) === 'pending').length,
    approved: services.filter((service) => normalizeServiceStatusKey(service.status) === 'approved').length,
    rejected: services.filter((service) => normalizeServiceStatusKey(service.status) === 'rejected').length,
    all: services.length,
  };
  const queueOptions = [
    ['pending', 'Pending requests'],
    ['approved', 'Approved services'],
    ['rejected', 'Rejected services'],
    ['all', 'All services'],
  ];

  useEffect(() => {
    if (serviceState.loading || !filteredServices.length) return;
    if (effectiveSelected?.id) return;
    setSelectedServiceId(filteredServices[0].id);
  }, [serviceState.loading, effectiveSelected?.id, filteredServices, setSelectedServiceId]);

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="rounded-lg bg-white p-4 shadow-lg shadow-red-900/5">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Service queue</span>
          <select
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
            className="h-12 w-full rounded-lg border border-gnd-cream bg-gnd-cream px-3 text-sm font-black text-gnd-dark outline-none transition focus:border-gnd-red focus:bg-white"
          >
            {queueOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({queueCounts[key] || 0})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid gap-3 lg:max-h-[calc(100vh-245px)] lg:overflow-y-auto">
          {serviceState.loading && (
            <div className="grid h-48 place-items-center rounded-lg bg-gnd-cream">
              <Loader2 className="animate-spin text-gnd-red" size={28} />
            </div>
          )}
          {!serviceState.loading && serviceState.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{serviceState.error}</p>
          )}
          {!serviceState.loading && !serviceState.error && filteredServices.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelectedServiceId(service.id)}
              className={`min-w-0 overflow-hidden rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-gnd-red/30 ${service.id === effectiveSelected?.id ? 'border-gnd-red ring-2 ring-gnd-red/10' : 'border-gnd-cream'}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-sm font-black leading-5 text-gnd-dark">{service.title}</p>
                  <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{service.coachName}</p>
                </div>
                <div className="shrink-0">
                  <ServiceStatusBadge status={service.status} compact />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 break-words text-xs font-bold leading-5 text-gnd-gray">{service.qualification || service.description || 'No qualification provided.'}</p>
              <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                {!service.rawCertUrl && (
                  <span className="max-w-full truncate rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-red">missing cert</span>
                )}
                {service.minPrice ? (
                  <span className="max-w-full truncate rounded-md bg-gnd-cream px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{service.currency} {service.minPrice}</span>
                ) : null}
              </div>
            </button>
          ))}
          {!serviceState.loading && !serviceState.error && !filteredServices.length && (
            <p className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No services in this queue.</p>
          )}
        </div>
      </aside>

      {effectiveSelected ? (
        <ServiceDetail service={effectiveSelected} saving={saving} onDecision={onDecision} />
      ) : (
        <ServiceDetailPlaceholder hasServices={services.length > 0} />
      )}
    </section>
  );
}

function ServiceDetailPlaceholder({ hasServices }) {
  return (
    <article className="grid min-h-[360px] place-items-center rounded-lg bg-white p-6 text-center shadow-lg shadow-red-900/5">
      <div className="max-w-sm">
        <Plus className="mx-auto text-gnd-gray" size={36} />
        <p className="mt-3 text-lg font-black text-gnd-dark">{hasServices ? 'Select a service' : 'No service requests yet'}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">
          {hasServices
            ? 'Choose a service from the queue to review coach details, credential evidence, locations, pricing, and approval actions.'
            : 'Instructor-submitted service requests will appear in the queue on the left.'}
        </p>
      </div>
    </article>
  );
}

function ServiceDetail({ service, saving, onDecision }) {
  const isPending = normalizeServiceStatusKey(service.status) === 'pending';

  return (
    <article className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-gnd-cream pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <ServiceStatusBadge status={service.status} />
          <h2 className="mt-3 text-2xl font-black text-gnd-dark">{service.title}</h2>
          <p className="mt-1 text-sm font-bold text-gnd-gray">{service.coachName} {service.coachEmail ? `/ ${service.coachEmail}` : ''}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoPanel title="Coach">
          <Detail label="Coach name" value={service.coachName} />
          <Detail label="Coach email" value={service.coachEmail} />
          <Detail label="Instructor profile ID" value={service.instructorId} />
        </InfoPanel>
        <InfoPanel title="Credential">
          <Detail label="Activity" value={service.title} />
          <Detail label="Qualification" value={service.qualification} />
          <Detail label="Attainment year" value={service.attainmentYear} />
          <Detail label="Submitted" value={formatDate(service.createdAt)} />
        </InfoPanel>
        <InfoPanel title="Service details">
          <Detail label="Description" value={service.description} />
          <Detail label="Minimum duration" value={`${service.minDurationHours || 1} hour(s)`} />
          <Detail label="Locations" value={(service.locations || []).map((location) => location.name).join(', ')} />
        </InfoPanel>
        <InfoPanel title="Pricing">
          {(service.pricing || []).length ? service.pricing.map((tier, index) => (
            <Detail key={tier.id || index} label={tier.skillLevel || `Tier ${index + 1}`} value={`${tier.currency || service.currency} ${tier.price1 || '-'}${tier.price2 ? ` / ${tier.price2}` : ''}${tier.price3 ? ` / ${tier.price3}` : ''}${tier.price4 ? ` / ${tier.price4}` : ''}`} />
          )) : <Detail label="Pricing" value={service.minPrice ? `${service.currency} ${service.minPrice}` : ''} />}
        </InfoPanel>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ImagePanel title="Original certificate" url={service.rawCertUrl} />
        <ImagePanel title="Public certificate" url={service.maskedCertUrl} />
      </div>

      {isPending && (
        <section className="mt-6 rounded-lg border border-gnd-cream p-4">
          <h3 className="text-lg font-black text-gnd-dark">Review decision</h3>
          <p className="mt-1 text-sm font-bold leading-6 text-gnd-gray">Approved services become active and visible on Search. Rejected services stay hidden from public booking.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <DecisionButton icon={CheckCircle2} label="Approve service" disabled={saving} onClick={() => onDecision(service.id, 'approved')} tone="approve" />
            <DecisionButton icon={XCircle} label="Reject service" disabled={saving} onClick={() => onDecision(service.id, 'rejected')} tone="reject" />
          </div>
        </section>
      )}
    </article>
  );
}

function ComplaintsPanel({
  complaintsState,
  selectedComplaint,
  selectedComplaintId,
  setSelectedComplaintId,
  queueFilter,
  setQueueFilter,
  saving,
  onDecision,
  onMessage,
  onSendToSuspension,
}) {
  const complaints = complaintsState.data || [];
  const filteredComplaints = filterComplaintsByQueue(complaints, queueFilter);
  const queueCounts = {
    open: complaints.filter((complaint) => ['new', 'in_review'].includes(complaint.status)).length,
    needs_more_info: complaints.filter((complaint) => complaint.status === 'needs_more_info').length,
    escalated: complaints.filter((complaint) => complaint.status === 'escalated' || complaint.status === 'sent_to_suspension').length,
    resolved: complaints.filter((complaint) => complaint.status === 'resolved').length,
    dismissed: complaints.filter((complaint) => complaint.status === 'dismissed').length,
  };
  const queueOptions = [
    ['open', 'Open cases'],
    ['needs_more_info', 'Needs more info'],
    ['escalated', 'Escalated cases'],
    ['resolved', 'Resolved cases'],
    ['dismissed', 'Dismissed cases'],
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="rounded-lg bg-white p-4 shadow-lg shadow-red-900/5">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Case queue</span>
          <select
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
            className="h-12 w-full rounded-lg border border-gnd-cream bg-gnd-cream px-3 text-sm font-black text-gnd-dark outline-none transition focus:border-gnd-red focus:bg-white"
          >
            {queueOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({queueCounts[key] || 0})
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-3 lg:max-h-[calc(100vh-245px)] lg:overflow-y-auto">
          {complaintsState.loading && (
            <div className="grid h-48 place-items-center rounded-lg bg-gnd-cream">
              <Loader2 className="animate-spin text-gnd-red" size={28} />
            </div>
          )}
          {!complaintsState.loading && complaintsState.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{complaintsState.error}</p>
          )}
          {!complaintsState.loading && !complaintsState.error && filteredComplaints.map((complaint) => (
            <button
              key={complaint.id}
              type="button"
              onClick={() => setSelectedComplaintId(complaint.id)}
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-gnd-red/30 ${complaint.id === selectedComplaintId ? 'border-gnd-red ring-2 ring-gnd-red/10' : 'border-gnd-cream'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gnd-dark">{complaint.reasonLabel}</p>
                  <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{complaint.targetType} · {complaint.displayDate}</p>
                </div>
                <ComplaintBadge value={complaint.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ComplaintBadge value={complaint.severity} severity />
                <span className="rounded-md bg-gnd-cream px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{complaint.priority}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-gnd-gray">{complaint.description || 'No description provided.'}</p>
            </button>
          ))}
          {!complaintsState.loading && !complaintsState.error && !filteredComplaints.length && (
            <p className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No cases in this queue.</p>
          )}
        </div>
      </aside>

      {selectedComplaint ? (
        <ComplaintDetail
          key={selectedComplaint.id}
          complaint={selectedComplaint}
          saving={saving}
          onDecision={onDecision}
          onMessage={onMessage}
          onSendToSuspension={onSendToSuspension}
        />
      ) : (
        <ComplaintDetailPlaceholder hasComplaints={complaints.length > 0} />
      )}
    </section>
  );
}

function ComplaintDetailPlaceholder({ hasComplaints }) {
  return (
    <article className="grid min-h-[360px] place-items-center rounded-lg bg-white p-6 text-center shadow-lg shadow-red-900/5">
      <div className="max-w-sm">
        <MessageSquare className="mx-auto text-gnd-gray" size={36} />
        <p className="mt-3 text-lg font-black text-gnd-dark">{hasComplaints ? 'Select a complaint' : 'No complaints yet'}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">
          {hasComplaints
            ? 'Choose a case from the queue to review evidence, message users, or send the account to suspension.'
            : 'New reports will appear in the queue on the left, with case details and staff actions shown here.'}
        </p>
      </div>
    </article>
  );
}

function ComplaintDetail({ complaint, saving, onDecision, onMessage, onSendToSuspension }) {
  const [form, setForm] = useState({
    severity: complaint.severity === 'unassigned' ? 'medium' : complaint.severity,
    priority: complaint.priority || 'normal',
    assignedTeam: complaint.assignedTeam || '',
    slaDueAt: toDateTimeLocalValue(complaint.slaDueAt),
    staffNote: complaint.staffNote || '',
    reporterMessage: defaultComplaintMessage('reporter', complaint),
    reportedMessage: defaultComplaintMessage('reported', complaint),
  });
  const submitDecision = (status) => {
    onDecision({
      complaintId: complaint.id,
      status,
      severity: form.severity,
      staffNote: form.staffNote,
      priority: form.priority,
      assignedTeam: form.assignedTeam,
      slaDueAt: form.slaDueAt ? new Date(form.slaDueAt).toISOString() : '',
    });
  };

  return (
    <article className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gnd-red">Complaint</p>
          <h2 className="mt-2 text-2xl font-black text-gnd-dark">{complaint.reasonLabel}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">{complaint.description || 'No description provided.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ComplaintBadge value={complaint.status} />
          <ComplaintBadge value={complaint.severity} severity />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoPanel title="Reporter">
          <Detail label="Name" value={complaint.reporterName} />
          <Detail label="Email" value={complaint.reporterEmail} />
        </InfoPanel>
        <InfoPanel title="Reported account">
          <Detail label="Name" value={complaint.reportedName || 'Not linked'} />
          <Detail label="Email" value={complaint.reportedEmail || 'Not linked'} />
          <Detail label="User ID" value={complaint.reportedUserId || 'Not linked'} />
        </InfoPanel>
        <InfoPanel title="Evidence">
          <Detail label="Target" value={`${complaint.targetType}${complaint.targetId ? ` · ${complaint.targetId}` : ''}`} />
          <Detail label="Evidence link" value={complaint.evidenceUrl || 'Not provided'} />
          <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-gnd-cream p-3 text-xs font-bold text-gnd-gray">{JSON.stringify(complaint.evidenceMetadata || {}, null, 2)}</pre>
        </InfoPanel>
        <InfoPanel title="Review">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Severity</span>
              <select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Priority</span>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Assigned team" value={form.assignedTeam} onChange={(value) => setForm((current) => ({ ...current, assignedTeam: value }))} />
            <Field label="SLA due" type="datetime-local" value={form.slaDueAt} onChange={(value) => setForm((current) => ({ ...current, slaDueAt: value }))} />
          </div>
          <label className="mt-3 grid gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Staff note</span>
            <textarea rows={5} value={form.staffNote} onChange={(event) => setForm((current) => ({ ...current, staffNote: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
          </label>
        </InfoPanel>
      </div>

      <section className="mt-5 rounded-lg border border-gnd-cream bg-white p-4">
        <h3 className="text-sm font-black text-gnd-dark">Support messages</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Messages are shown to users as GuideNextdoor Support. Staff identity is retained in the audit trail.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Message reporter</span>
            <textarea rows={5} value={form.reporterMessage} onChange={(event) => setForm((current) => ({ ...current, reporterMessage: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
            <button type="button" disabled={saving || !complaint.reporterUserId || !form.reporterMessage.trim()} onClick={() => onMessage({ complaintId: complaint.id, recipientRole: 'reporter', body: form.reporterMessage })} className="rounded-lg bg-gnd-dark px-4 py-3 text-xs font-black text-white disabled:opacity-40">
              Send to reporter
            </button>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Message reported user</span>
            <textarea rows={5} value={form.reportedMessage} onChange={(event) => setForm((current) => ({ ...current, reportedMessage: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
            <button type="button" disabled={saving || !complaint.reportedUserId || !form.reportedMessage.trim()} onClick={() => onMessage({ complaintId: complaint.id, recipientRole: 'reported', body: form.reportedMessage })} className="rounded-lg bg-gnd-dark px-4 py-3 text-xs font-black text-white disabled:opacity-40">
              Send to reported user
            </button>
          </label>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <DecisionButton icon={CheckCircle2} label="Valid - investigate" disabled={saving} onClick={() => submitDecision('in_review')} tone="approve" />
        <DecisionButton icon={XCircle} label="Dismiss" disabled={saving} onClick={() => submitDecision('dismissed')} tone="reject" />
        <DecisionButton icon={CheckCircle2} label="Resolve" disabled={saving} onClick={() => submitDecision('resolved')} tone="approve" />
        <DecisionButton icon={MessageSquare} label="Needs info" disabled={saving} onClick={() => submitDecision('needs_more_info')} />
        <DecisionButton icon={UserLock} label="Send to suspension" disabled={saving || !complaint.reportedUserId} onClick={() => onSendToSuspension(complaint.id)} tone="reject" />
      </div>
    </article>
  );
}

function filterComplaintsByQueue(complaints, queueFilter) {
  const statusGroups = {
    open: ['new', 'in_review'],
    needs_more_info: ['needs_more_info'],
    escalated: ['escalated', 'sent_to_suspension'],
    resolved: ['resolved'],
    dismissed: ['dismissed'],
  };
  const statuses = statusGroups[queueFilter] || statusGroups.open;
  return complaints.filter((complaint) => statuses.includes(complaint.status));
}

function filterServicesByQueue(services, queueFilter) {
  if (queueFilter === 'all') return services;
  return services.filter((service) => normalizeServiceStatusKey(service.status) === queueFilter);
}

function normalizeServiceStatusKey(status) {
  const value = String(status || 'pending').trim().toLowerCase();
  if (value === 'approved') return 'approved';
  if (value === 'rejected') return 'rejected';
  return 'pending';
}

function filterPostsByQueue(posts, queueFilter) {
  if (queueFilter === 'reported') return posts.filter((post) => needsPostReview(post) && post.reportCount > 0);
  if (queueFilter === 'high_risk') return posts.filter((post) => needsPostReview(post) && post.riskScore >= 3);
  if (queueFilter === 'removed') return posts.filter(isRemovedPost);
  if (queueFilter === 'all') return posts;
  return posts.filter(needsPostReview);
}

function needsPostReview(post) {
  if (isRemovedPost(post)) return false;
  if (!post?.moderationReviewedAt) return true;
  const reviewedAt = new Date(post.moderationReviewedAt).getTime();
  const updatedAt = new Date(post.updatedAt || post.createdAt).getTime();
  if (!Number.isFinite(reviewedAt) || !Number.isFinite(updatedAt)) return true;
  return updatedAt > reviewedAt + 1000;
}

function isRemovedPost(post) {
  const approval = String(post?.approvalStatus || '').toLowerCase();
  const moderation = String(post?.moderationStatus || '').toLowerCase();
  return approval === 'removed' || approval === 'hidden' || moderation === 'removed' || Boolean(post?.removedAt);
}

function PostModerationBadge({ post, compact = false }) {
  const removed = isRemovedPost(post);
  const reviewed = !needsPostReview(post);
  const risky = post.riskScore >= 3 || post.reportCount > 0;
  const label = removed ? 'removed' : reviewed ? 'reviewed' : risky ? 'review' : 'new';
  const styles = removed
    ? 'bg-gnd-cream text-gnd-gray border-gnd-cream'
    : reviewed
      ? 'bg-green-50 text-green-700 border-green-100'
      : risky
      ? 'bg-red-50 text-gnd-red border-red-100'
      : 'bg-blue-50 text-blue-700 border-blue-100';
  return (
    <span className={`inline-flex shrink-0 rounded-md border font-black uppercase tracking-widest ${compact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1 text-[10px]'} ${styles}`}>
      {label}
    </span>
  );
}

function defaultPostAuthorMessage(post) {
  if (isRemovedPost(post)) {
    return `Hi, GuideNextdoor Support is reviewing your post "${post.title}". We will follow up here if any further action is needed.`;
  }
  return `Hi, GuideNextdoor Support removed your post "${post.title}" after review. You can reply here if you need clarification.`;
}

function filterApplicationsByQueue(applications, queueFilter) {
  const statusGroups = {
    active: ['new', 'in_review', 'needs_info'],
    new: ['new'],
    in_review: ['in_review'],
    needs_info: ['needs_info'],
    approved: ['approved'],
    rejected: ['rejected'],
  };
  const statuses = statusGroups[queueFilter] || statusGroups.active;
  return applications.filter((application) => statuses.includes(application.status));
}

function normalizeRect(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function drawMaskedCertificate(canvas, image, rects, draftRect) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  [...rects, draftRect].filter(Boolean).forEach((rect) => {
    context.save();
    context.beginPath();
    context.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip();
    context.filter = 'blur(14px)';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.filter = 'none';
    context.fillStyle = 'rgba(250, 247, 242, 0.32)';
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.restore();
    context.strokeStyle = '#B23A34';
    context.lineWidth = 2;
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  });
}

function defaultComplaintMessage(role, complaint) {
  if (role === 'reported') {
    return `Hi, GuideNextdoor is reviewing a complaint related to your account. Please reply here with any context or supporting information about this case. Complaint reference: ${complaint.id.slice(0, 8)}.`;
  }
  return `Hi, GuideNextdoor is reviewing your complaint. Please reply here with any additional details or evidence that may help our team investigate. Complaint reference: ${complaint.id.slice(0, 8)}.`;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ComplaintBadge({ value, severity = false }) {
  const normalized = String(value || '').toLowerCase();
  const styles = severity
    ? {
        low: 'bg-gnd-cream text-gnd-gray',
        medium: 'bg-amber-50 text-amber-700',
        high: 'bg-red-50 text-gnd-red',
        critical: 'bg-gnd-red text-white',
        unassigned: 'bg-gnd-cream text-gnd-gray',
      }
    : {
        new: 'bg-blue-50 text-blue-700',
        in_review: 'bg-amber-50 text-amber-700',
        needs_more_info: 'bg-purple-50 text-purple-700',
        resolved: 'bg-green-50 text-green-700',
        dismissed: 'bg-gnd-cream text-gnd-gray',
        escalated: 'bg-red-50 text-gnd-red',
        sent_to_suspension: 'bg-gnd-red text-white',
      };
  return (
    <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${styles[normalized] || 'bg-gnd-cream text-gnd-gray'}`}>
      {normalized.replaceAll('_', ' ') || 'new'}
    </span>
  );
}

function ServiceStatusBadge({ status, compact = false }) {
  const normalized = normalizeServiceStatusKey(status);
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-gnd-red border-red-100',
  };
  return (
    <span className={`inline-flex rounded-md border font-black uppercase tracking-widest ${compact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1 text-[10px]'} ${styles[normalized]}`}>
      {normalized}
    </span>
  );
}

function UserBlocksPanel({
  blocksState,
  queueState,
  searchState,
  setSearchState,
  selectedAccount,
  blockForm,
  setBlockForm,
  saving,
  canUnblock,
  onSearch,
  onSelectAccount,
  onCreateBlock,
  onLiftBlock,
}) {
  const canSubmit = selectedAccount
    && !selectedAccount.isStaff
    && blockForm.userId === selectedAccount.id
    && (blockForm.status !== 'temporary' || blockForm.blockedUntil);

  return (
    <section className="grid gap-5">
      <div className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gnd-dark">Account suspension</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-gnd-gray">
              Start from the review queue or search for an account, confirm the exact user, then submit the suspension details.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="Queue" value={queueState.data.length} />
            <MiniMetric label="Active" value={blocksState.data.filter((block) => block.active).length} />
            <MiniMetric label="Lifted" value={blocksState.data.filter((block) => block.liftedAt).length} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <SuspensionReviewQueue queueState={queueState} selectedAccount={selectedAccount} onSelectAccount={onSelectAccount} />
          <SuspensionSearchPanel
            searchState={searchState}
            setSearchState={setSearchState}
            selectedAccount={selectedAccount}
            onSearch={onSearch}
            onSelectAccount={onSelectAccount}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <form onSubmit={onCreateBlock} className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5">
          <h3 className="text-xl font-black text-gnd-dark">Confirmed account</h3>
          {selectedAccount ? (
            <SelectedSuspensionAccount account={selectedAccount} />
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-gnd-cream bg-gnd-cream/40 p-4">
              <p className="text-sm font-black text-gnd-dark">No account selected</p>
              <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Select an account from the queue or search results before entering suspension details.</p>
            </div>
          )}

          <div className={`mt-5 grid gap-3 ${selectedAccount ? '' : 'pointer-events-none opacity-45'}`}>
            <Field label="User ID" value={blockForm.userId} onChange={(value) => setBlockForm((current) => ({ ...current, userId: value }))} />
            <div className="rounded-lg border border-gnd-cream bg-gnd-cream/50 p-3">
              <p className="text-xs font-black uppercase tracking-widest text-gnd-gray">Suspension scope</p>
              <p className="mt-2 text-sm font-black text-gnd-dark">Full account read-only</p>
              <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">Login and public browsing stay open. Likes, saves, comments, posting, bookings, regular chat, and coach tools are paused. Coach profiles, services, and posts are hidden from public discovery.</p>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">Suspension type</span>
              <select value={blockForm.status} onChange={(event) => setBlockForm((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
                <option value="temporary">Temporary</option>
                <option value="permanent">Permanent</option>
              </select>
            </label>
            {blockForm.status === 'temporary' && (
              <Field label="Suspended until" type="datetime-local" value={blockForm.blockedUntil} onChange={(value) => setBlockForm((current) => ({ ...current, blockedUntil: value }))} />
            )}
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">Reason category</span>
              <select value={blockForm.reasonCategory} onChange={(event) => setBlockForm((current) => ({ ...current, reasonCategory: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
                <option value="policy_violation">Policy violation</option>
                <option value="safety_review">Safety review</option>
                <option value="payment_or_booking_dispute">Booking dispute</option>
                <option value="identity_or_credential_review">Identity or credential review</option>
                <option value="spam_or_abuse">Spam or abuse</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">User-facing message</span>
              <textarea rows={4} value={blockForm.userMessage} placeholder="Optional. If left blank, GuideNextdoor sends the standard suspension notice." onChange={(event) => setBlockForm((current) => ({ ...current, userMessage: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">Internal reason</span>
              <textarea rows={3} value={blockForm.reason} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">Internal note</span>
              <textarea rows={3} value={blockForm.internalNote} onChange={(event) => setBlockForm((current) => ({ ...current, internalNote: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
            </label>
            {selectedAccount?.isStaff && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-gnd-red">Staff accounts cannot be suspended here. Use Account creation to suspend or offboard internal users.</p>
            )}
            {selectedAccount?.activeSuspension && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">This account already has an active suspension. Review the history before adding another record.</p>
            )}
            <button type="submit" disabled={saving || !canSubmit} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
              <UserLock size={16} />
              Suspend confirmed account
            </button>
          </div>
        </form>

        <div className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-gnd-dark">Suspension history</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">Active records enforce read-only access until expiry or staff uplift.</p>
          </div>
          <div className="rounded-lg bg-gnd-cream px-3 py-2 text-xs font-black uppercase tracking-widest text-gnd-gray">
            {blocksState.data.filter((block) => block.active).length} active
          </div>
        </div>
        {blocksState.loading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-gnd-red" /></div>
        ) : blocksState.error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{blocksState.error}</p>
        ) : !blocksState.data.length ? (
          <p className="mt-4 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No suspensions recorded.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {blocksState.data.map((block) => (
              <div key={block.id} className="rounded-lg border border-gnd-cream p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gnd-dark">{block.userName}</p>
                    <p className="mt-1 text-xs font-bold text-gnd-gray">{block.userEmail || block.userId}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${block.active ? 'bg-red-50 text-gnd-red' : 'bg-gnd-cream text-gnd-gray'}`}>
                    {block.liftedAt ? 'lifted' : block.expired ? 'expired' : block.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold text-gnd-gray sm:grid-cols-2">
                  <Detail label="Scope" value={block.scope === 'full_account_read_only' ? 'Full read-only' : block.scope} />
                  <Detail label="Category" value={block.reasonCategory ? block.reasonCategory.replaceAll('_', ' ') : 'Not set'} />
                  <Detail label="Until" value={block.blockedUntil ? formatDate(block.blockedUntil) : block.status === 'permanent' ? 'No end date' : 'Not set'} />
                  <Detail label="Created" value={formatDate(block.createdAt)} />
                </div>
                {block.reason && <p className="mt-3 text-sm font-bold text-gnd-gray">{block.reason}</p>}
                {block.userMessage && <p className="mt-3 rounded-lg bg-gnd-cream px-3 py-2 text-xs font-bold leading-5 text-gnd-gray">{block.userMessage}</p>}
                {block.active && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-bold leading-5 text-gnd-gray">This suspension can be uplifted before the scheduled end date if the issue is resolved.</p>
                    <button
                      type="button"
                      disabled={!canUnblock}
                      onClick={() => onLiftBlock(block.id)}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gnd-dark px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Uplift suspension
                    </button>
                  </div>
                )}
                {block.active && !canUnblock && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                    Your staff role can view suspensions but does not have uplift permission.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

function SuspensionReviewQueue({ queueState, selectedAccount, onSelectAccount }) {
  return (
    <section className="rounded-lg border border-gnd-cream p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-gnd-dark">Review queue</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">DB-backed signals from suspensions, service reviews, comments, and booking records.</p>
        </div>
        {queueState.loading && <Loader2 className="animate-spin text-gnd-red" size={18} />}
      </div>
      {queueState.error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-xs font-bold text-gnd-red">{queueState.error}</p>
      ) : !queueState.loading && !queueState.data.length ? (
        <p className="mt-4 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No accounts currently shortlisted.</p>
      ) : (
        <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
          {queueState.data.map((account) => (
            <SuspensionAccountCard
              key={account.id}
              account={account}
              selected={selectedAccount?.id === account.id}
              onSelect={() => onSelectAccount(account)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SuspensionSearchPanel({ searchState, setSearchState, selectedAccount, onSearch, onSelectAccount }) {
  return (
    <section className="rounded-lg border border-gnd-cream p-4">
      <h3 className="text-lg font-black text-gnd-dark">Search account</h3>
      <form onSubmit={onSearch} className="mt-3 flex gap-2">
        <input
          value={searchState.query}
          onChange={(event) => setSearchState((current) => ({ ...current, query: event.target.value, error: '' }))}
          placeholder="Email, name, username, or user ID"
          className="h-11 min-w-0 flex-1 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none"
        />
        <button type="submit" disabled={searchState.loading} className="inline-flex h-11 items-center gap-2 rounded-lg bg-gnd-dark px-4 text-sm font-black text-white disabled:opacity-50">
          {searchState.loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </form>
      {searchState.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-gnd-red">{searchState.error}</p>}
      <div className="mt-4 grid max-h-[344px] gap-3 overflow-y-auto pr-1">
        {searchState.data.map((account) => (
          <SuspensionAccountCard
            key={account.id}
            account={account}
            selected={selectedAccount?.id === account.id}
            compact
            onSelect={() => onSelectAccount(account)}
          />
        ))}
        {!searchState.loading && searchState.query && !searchState.data.length && !searchState.error && (
          <p className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No account matched this search.</p>
        )}
      </div>
    </section>
  );
}

function SuspensionAccountCard({ account, selected, compact = false, onSelect }) {
  const firstSignal = account.signals?.[0];
  const typeTone = account.isStaff
    ? 'bg-red-50 text-gnd-red'
    : account.accountType === 'instructor'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-gnd-cream text-gnd-gray';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border px-3 py-3 text-left transition ${selected ? 'border-gnd-red bg-red-50/40 shadow-sm shadow-red-900/5' : 'border-gnd-cream bg-white hover:border-gnd-red/40'} ${compact ? '' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <AccountAvatar account={account} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-black text-gnd-dark">{account.displayName}</p>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${typeTone}`}>
              {account.accountType}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{account.email || account.username || account.id}</p>
          {firstSignal && (
            <p className="mt-2 line-clamp-1 text-xs font-bold text-gnd-gray">
              <span className="font-black text-gnd-dark">{firstSignal.label}</span>
              {firstSignal.detail ? ` - ${firstSignal.detail}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <QueueChip label="Risk" value={account.riskScore || 0} tone={(account.riskScore || 0) >= 4 ? 'risk' : 'neutral'} />
        <QueueChip label="Bookings" value={account.bookingCount || 0} />
        <QueueChip label="Posts" value={account.postCount || 0} />
        {account.serviceCount ? <QueueChip label="Services" value={account.serviceCount} /> : null}
        {account.previousSuspensionCount ? <QueueChip label="Prior" value={account.previousSuspensionCount} tone="risk" /> : null}
      </div>
      {(account.activeSuspension || account.isStaff) && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-red">
          {account.isStaff ? 'Staff account: manage internally' : 'Active suspension'}
        </p>
      )}
    </button>
  );
}

function SelectedSuspensionAccount({ account }) {
  return (
    <div className="mt-4 rounded-lg border border-gnd-cream bg-gnd-cream/40 p-4">
      <div className="flex items-start gap-3">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gnd-dark">{account.displayName}</p>
          <p className="mt-1 break-all text-xs font-bold text-gnd-gray">{account.email || account.id}</p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">{account.accountType}</span>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-bold text-gnd-gray sm:grid-cols-2">
        <Detail label="User ID" value={account.id} />
        <Detail label="Username" value={account.username || 'Not set'} />
        <Detail label="Services" value={account.serviceCount || 0} />
        <Detail label="Posts" value={account.postCount || 0} />
        <Detail label="Bookings" value={account.bookingCount || 0} />
        <Detail label="Previous suspensions" value={account.previousSuspensionCount || 0} />
      </div>
    </div>
  );
}

function AccountAvatar({ account, size = 'md' }) {
  const dimensions = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <span className={`grid ${dimensions} shrink-0 place-items-center overflow-hidden rounded-full bg-gnd-cream text-gnd-red`}>
      {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users size={18} />}
    </span>
  );
}

function QueueChip({ label, value, tone = 'neutral' }) {
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tone === 'risk' ? 'bg-red-50 text-gnd-red' : 'bg-gnd-cream text-gnd-gray'}`}>
      {label} {value}
    </span>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-gnd-cream/70 px-3 py-2">
      <p className="text-base font-black text-gnd-dark">{value}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-gnd-gray">{label}</p>
    </div>
  );
}

function StaffAdminPanel({ directoryState, filters, setFilters, onInvite, onOpenMember }) {
  const departments = [...new Set(directoryState.members.map((member) => member.department).filter(Boolean))].sort();
  const filteredMembers = filterStaffMembers(directoryState.members, filters);
  const summary = {
    active: directoryState.members.filter((member) => member.status === 'active').length,
    suspended: directoryState.members.filter((member) => member.status === 'suspended').length,
    offboarded: directoryState.members.filter((member) => member.status === 'offboarded').length,
    sensitive: directoryState.members.filter((member) => member.sensitive).length,
  };

  return (
    <section className="grid gap-5">
      <div className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gnd-dark">Staff access</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-gnd-gray">
              Create, review, suspend, and audit internal GuideNextdoor staff accounts. Staff access is invitation-style and role-based; public learner actions stay disabled for staff accounts.
            </p>
          </div>
          <button type="button" onClick={onInvite} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white hover:bg-gnd-dark">
            <Plus size={16} />
            Create staff
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricCard label="Active staff" value={summary.active} />
          <MetricCard label="Suspended" value={summary.suspended} />
          <MetricCard label="Offboarded" value={summary.offboarded} />
          <MetricCard label="Sensitive Roles" value={summary.sensitive} tone="risk" />
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-lg shadow-red-900/5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_150px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray" size={16} />
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search name or email"
              className="h-11 w-full rounded-lg bg-gnd-cream pl-9 pr-3 text-sm font-bold outline-none"
            />
          </label>
          <FilterSelect label="Department" value={filters.department} onChange={(value) => setFilters((current) => ({ ...current, department: value }))}>
            <option value="all">All departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </FilterSelect>
          <FilterSelect label="Role" value={filters.role} onChange={(value) => setFilters((current) => ({ ...current, role: value }))}>
            <option value="all">All roles</option>
            {directoryState.roles.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="offboarded">Offboarded</option>
          </FilterSelect>
          <label className="flex h-11 items-center gap-2 rounded-lg bg-gnd-cream px-3 text-sm font-black text-gnd-dark">
            <input
              type="checkbox"
              checked={filters.sensitiveOnly}
              onChange={(event) => setFilters((current) => ({ ...current, sensitiveOnly: event.target.checked }))}
            />
            Sensitive only
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-lg shadow-red-900/5">
        {directoryState.loading ? (
          <div className="grid h-52 place-items-center"><Loader2 className="animate-spin text-gnd-red" /></div>
        ) : directoryState.error ? (
          <p className="m-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{directoryState.error}</p>
        ) : !filteredMembers.length ? (
          <div className="grid h-52 place-items-center px-5 text-center">
            <div>
              <Users className="mx-auto text-gnd-gray" size={34} />
              <p className="mt-3 text-lg font-black text-gnd-dark">No staff found for this filter.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left">
              <thead className="bg-gnd-cream/70 text-[10px] font-black uppercase tracking-widest text-gnd-gray">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gnd-cream">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-black text-gnd-dark">{member.displayName}</p>
                      <p className="mt-1 text-xs font-bold text-gnd-gray">{member.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-gnd-gray">{member.department || 'Not set'}</td>
                    <td className="px-4 py-4">
                      <RoleBadgeList roles={member.roles} />
                    </td>
                    <td className="px-4 py-4"><StaffStatusBadge status={member.status} /></td>
                    <td className="px-4 py-4 text-sm font-bold text-gnd-gray">{formatDateTime(member.lastActiveAt) || 'Not recorded'}</td>
                    <td className="px-4 py-4 text-right">
                      <button type="button" onClick={() => onOpenMember(member)} className="rounded-md bg-gnd-cream px-3 py-2 text-xs font-black uppercase tracking-widest text-gnd-dark hover:text-gnd-red">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function StaffInviteModal({ roles, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({ email: '', displayName: '', department: '', employmentType: 'full_time', roleIds: [] });
  const selectedRoles = roles.filter((role) => form.roleIds.includes(role.id));
  const sensitive = selectedRoles.some((role) => ['super_admin', 'it_admin'].includes(role.key));

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <ModalShell title="Create staff" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-5">
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          <Field label="Display name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
          <Field label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Employment type</span>
            <select value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contractor">Contractor</option>
            </select>
          </label>
        </section>

        <RoleChecklist roles={roles} selectedRoleIds={form.roleIds} onChange={(roleIds) => setForm((current) => ({ ...current, roleIds }))} />
        <PermissionPreview roles={selectedRoles} />
        {sensitive && <RiskWarning />}

        <div className="rounded-lg bg-gnd-cream/60 p-4">
          <p className="text-sm font-black text-gnd-dark">Internal access confirmation</p>
          <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">This creates or invites the staff auth account through the secure server function, then assigns staff roles and writes an audit record.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark">Cancel</button>
          <button type="submit" disabled={saving || !form.email || !form.roleIds.length} className="rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
            {saving ? 'Saving...' : 'Create staff access'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function StaffDetailModal({ member, roles, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    displayName: member.displayName || '',
    department: member.department || '',
    status: member.status || 'active',
    roleIds: member.roleIds || [],
  });
  const selectedRoles = roles.filter((role) => form.roleIds.includes(role.id));
  const sensitive = selectedRoles.some((role) => ['super_admin', 'it_admin'].includes(role.key));

  const submit = (event) => {
    event.preventDefault();
    onSubmit({ staffMemberId: member.id, ...form });
  };

  return (
    <ModalShell title="Staff details" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-3 rounded-lg bg-gnd-cream/60 p-4 md:grid-cols-2">
          <Detail label="Email" value={member.email} />
          <Detail label="Created" value={formatDate(member.createdAt)} />
          <Detail label="Last active" value={formatDateTime(member.lastActiveAt)} />
          <Detail label="Current status" value={member.status} />
        </div>

        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Display name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
          <Field label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Account status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="offboarded">Offboarded</option>
            </select>
          </label>
        </section>

        <RoleChecklist roles={roles} selectedRoleIds={form.roleIds} onChange={(roleIds) => setForm((current) => ({ ...current, roleIds }))} />
        <PermissionPreview roles={selectedRoles} />
        {sensitive && <RiskWarning />}

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setForm((current) => ({ ...current, status: 'suspended' }))} className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">Suspend</button>
            <button type="button" onClick={() => setForm((current) => ({ ...current, status: 'offboarded', roleIds: [] }))} className="rounded-lg bg-red-50 px-4 py-3 text-sm font-black text-gnd-red">Offboard</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-black text-gnd-dark">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gnd-red px-4 py-3 text-sm font-black text-white disabled:opacity-40">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gnd-dark/55 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gnd-cream px-5 py-4">
          <h2 className="text-xl font-black text-gnd-dark">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gnd-gray hover:bg-gnd-cream hover:text-gnd-red" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(90vh-70px)] overflow-y-auto p-5">
          {children}
        </div>
      </section>
    </div>
  );
}

function RoleChecklist({ roles, selectedRoleIds, onChange }) {
  const toggleRole = (roleId) => {
    onChange(selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId]);
  };

  return (
    <section>
      <h3 className="text-sm font-black text-gnd-dark">Roles</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {roles.map((role) => (
          <label key={role.id} className={`rounded-lg border p-4 ${selectedRoleIds.includes(role.id) ? 'border-gnd-red bg-red-50/40' : 'border-gnd-cream bg-white'}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedRoleIds.includes(role.id)} onChange={() => toggleRole(role.id)} className="mt-1" />
              <div>
                <p className="text-sm font-black text-gnd-dark">{role.name}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">{role.description}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

function PermissionPreview({ roles }) {
  const permissions = [...new Map(roles.flatMap((role) => role.permissions || []).map((permission) => [permission.key, permission])).values()];
  return (
    <section className="rounded-lg bg-gnd-cream/60 p-4">
      <h3 className="text-sm font-black text-gnd-dark">Permission preview</h3>
      {!permissions.length ? (
        <p className="mt-2 text-xs font-bold text-gnd-gray">No permissions selected.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <span key={permission.key} title={permission.description} className="rounded-md bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">
              {permission.key}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, tone = 'default' }) {
  return (
    <div className={`rounded-lg p-4 ${tone === 'risk' ? 'bg-red-50' : 'bg-gnd-cream/60'}`}>
      <p className={`text-2xl font-black ${tone === 'risk' ? 'text-gnd-red' : 'text-gnd-dark'}`}>{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-gnd-gray">{label}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg bg-gnd-cream px-3 text-sm font-bold text-gnd-dark outline-none">
        {children}
      </select>
    </label>
  );
}

function RoleBadgeList({ roles }) {
  if (!roles?.length) return <span className="text-xs font-bold text-gnd-gray">No role</span>;
  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {roles.map((role) => (
        <span key={role.id || role.key} className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${['super_admin', 'it_admin'].includes(role.key) ? 'bg-red-50 text-gnd-red' : 'bg-gnd-cream text-gnd-gray'}`}>
          {role.name || role.key}
        </span>
      ))}
    </div>
  );
}

function StaffStatusBadge({ status }) {
  const styles = {
    active: 'bg-green-50 text-green-700',
    suspended: 'bg-amber-50 text-amber-700',
    offboarded: 'bg-red-50 text-gnd-red',
  };
  return (
    <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${styles[status] || 'bg-gnd-cream text-gnd-gray'}`}>
      {status || 'unknown'}
    </span>
  );
}

function RiskWarning() {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
      <p className="text-sm font-black text-gnd-red">Sensitive role selected</p>
      <p className="mt-1 text-xs font-bold leading-5 text-gnd-red/80">Super admin and IT admin can affect staff access or audit visibility. Keep these roles limited and reviewed regularly.</p>
    </div>
  );
}

function filterStaffMembers(members, filters) {
  const query = filters.query.trim().toLowerCase();
  return members.filter((member) => {
    if (query && !`${member.displayName} ${member.email}`.toLowerCase().includes(query)) return false;
    if (filters.department !== 'all' && member.department !== filters.department) return false;
    if (filters.status !== 'all' && member.status !== filters.status) return false;
    if (filters.role !== 'all' && !member.roles.some((role) => role.key === filters.role)) return false;
    if (filters.sensitiveOnly && !member.sensitive) return false;
    return true;
  });
}

function PostModerationPanel({ postState, selectedPost, selectedPostId, setSelectedPostId, queueFilter, setQueueFilter, saving, onModerate }) {
  const posts = postState.data || [];
  const filteredPosts = filterPostsByQueue(posts, queueFilter);
  const effectiveSelected = filteredPosts.find((post) => post.id === selectedPostId)
    || (filteredPosts.some((post) => post.id === selectedPost?.id) ? selectedPost : null);
  const queueCounts = {
    recent: posts.filter(needsPostReview).length,
    reported: posts.filter((post) => needsPostReview(post) && post.reportCount > 0).length,
    high_risk: posts.filter((post) => needsPostReview(post) && post.riskScore >= 3).length,
    removed: posts.filter(isRemovedPost).length,
    all: posts.length,
  };
  const queueOptions = [
    ['recent', 'New and updated'],
    ['reported', 'Reported posts'],
    ['high_risk', 'Risk signals'],
    ['removed', 'Removed posts'],
    ['all', 'All posts'],
  ];

  useEffect(() => {
    if (postState.loading || !filteredPosts.length) return;
    if (effectiveSelected?.id) return;
    setSelectedPostId(filteredPosts[0].id);
  }, [postState.loading, effectiveSelected?.id, filteredPosts, setSelectedPostId]);

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="rounded-lg bg-white p-4 shadow-lg shadow-red-900/5">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-gnd-gray">Post queue</span>
          <select
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
            className="h-12 w-full rounded-lg border border-gnd-cream bg-gnd-cream px-3 text-sm font-black text-gnd-dark outline-none transition focus:border-gnd-red focus:bg-white"
          >
            {queueOptions.map(([key, label]) => (
              <option key={key} value={key}>{label} ({queueCounts[key] || 0})</option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid gap-3 lg:max-h-[calc(100vh-245px)] lg:overflow-y-auto">
          {postState.loading && (
            <div className="grid h-48 place-items-center rounded-lg bg-gnd-cream">
              <Loader2 className="animate-spin text-gnd-red" size={28} />
            </div>
          )}
          {!postState.loading && postState.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{postState.error}</p>
          )}
          {!postState.loading && !postState.error && filteredPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelectedPostId(post.id)}
              className={`min-w-0 overflow-hidden rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-gnd-red/30 ${post.id === effectiveSelected?.id ? 'border-gnd-red ring-2 ring-gnd-red/10' : 'border-gnd-cream'}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gnd-cream">
                  {post.imageUrl ? <img src={post.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-gnd-gray"><Trash2 size={18} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 break-words text-sm font-black leading-5 text-gnd-dark">{post.title}</p>
                    <PostModerationBadge post={post} compact />
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-gnd-gray">{post.coachName}</p>
                  <p className="mt-1 text-[11px] font-bold text-gnd-gray">{post.displayUpdatedAt}</p>
                </div>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                {post.riskSignals.slice(0, 2).map((signal) => (
                  <span key={signal.key} className="max-w-full truncate rounded-md bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-red">{signal.label}</span>
                ))}
                {!post.riskSignals.length && <span className="rounded-md bg-gnd-cream px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">manual review</span>}
              </div>
            </button>
          ))}
          {!postState.loading && !postState.error && !filteredPosts.length && (
            <p className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-gray">No posts in this queue.</p>
          )}
        </div>
      </aside>

      {effectiveSelected ? (
        <PostModerationDetail key={effectiveSelected.id} post={effectiveSelected} saving={saving} onModerate={onModerate} />
      ) : (
        <PostModerationPlaceholder hasPosts={posts.length > 0} />
      )}
    </section>
  );
}

function PostModerationPlaceholder({ hasPosts }) {
  return (
    <article className="grid min-h-[360px] place-items-center rounded-lg bg-white p-6 text-center shadow-lg shadow-red-900/5">
      <div className="max-w-sm">
        <Trash2 className="mx-auto text-gnd-gray" size={36} />
        <p className="mt-3 text-lg font-black text-gnd-dark">{hasPosts ? 'Select a post' : 'No posts to review yet'}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">
          {hasPosts ? 'Choose a post from the queue to review media, caption, reports, comments, and removal actions.' : 'Recent and reported posts will appear in the queue on the left.'}
        </p>
      </div>
    </article>
  );
}

function PostModerationDetail({ post, saving, onModerate }) {
  const [form, setForm] = useState({
    reasonCategory: post.removalReason || 'policy_violation',
    staffNote: post.moderationNote || '',
    authorMessage: defaultPostAuthorMessage(post),
  });
  const removed = isRemovedPost(post);

  return (
    <article className="rounded-lg bg-white p-5 shadow-lg shadow-red-900/5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-gnd-cream pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <PostModerationBadge post={post} />
          <h2 className="mt-3 text-2xl font-black text-gnd-dark">{post.title}</h2>
          <p className="mt-1 text-sm font-bold text-gnd-gray">{post.coachName} {post.authorEmail ? `/ ${post.authorEmail}` : ''}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <section className="rounded-lg border border-gnd-cream p-4">
          <h3 className="text-sm font-black text-gnd-dark">Post preview</h3>
          <div className="mt-3 overflow-hidden rounded-lg bg-gnd-cream">
            {post.imageUrl ? <img src={post.imageUrl} alt="" className="max-h-[520px] w-full object-contain" /> : <div className="grid h-64 place-items-center text-sm font-bold text-gnd-gray">No media</div>}
          </div>
          {post.caption && <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-6 text-gnd-dark">{post.caption}</p>}
          {post.hashtags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => <span key={tag} className="rounded-md bg-gnd-cream px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gnd-gray">#{tag}</span>)}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4">
          <InfoPanel title="Post data">
            <Detail label="Author" value={post.coachName} />
            <Detail label="Author user ID" value={post.authorUserId} />
            <Detail label="Created" value={formatDate(post.createdAt)} />
            <Detail label="Updated" value={formatDate(post.updatedAt)} />
            <Detail label="Last reviewed" value={post.moderationReviewedAt ? formatDate(post.moderationReviewedAt) : 'Not reviewed'} />
            <Detail label="Likes / comments" value={`${post.likes || 0} / ${post.comments || 0}`} />
          </InfoPanel>
          <InfoPanel title="Risk signals">
            {post.riskSignals.length ? post.riskSignals.map((signal) => (
              <Detail key={signal.key} label={signal.label} value={signal.detail} />
            )) : <Detail label="Signals" value="No automatic signal. Manual review only." />}
          </InfoPanel>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoPanel title={`Reports (${post.reportCount || 0})`}>
          {post.complaints.length ? post.complaints.slice(0, 6).map((complaint) => (
            <div key={complaint.id} className="rounded-lg bg-gnd-cream px-3 py-2">
              <p className="text-xs font-black text-gnd-dark">{complaint.reasonLabel}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">{complaint.description || 'No description provided.'}</p>
            </div>
          )) : <Detail label="Reports" value="No reports for this post." />}
        </InfoPanel>
        <InfoPanel title="Recent comments">
          {post.comments.length ? post.comments.slice(0, 6).map((comment) => (
            <div key={comment.id} className="rounded-lg bg-gnd-cream px-3 py-2">
              <p className="text-xs font-black text-gnd-dark">{comment.userName}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">{comment.body}</p>
            </div>
          )) : <Detail label="Comments" value="No recent comments loaded." />}
        </InfoPanel>
      </div>

      <section className="mt-6 rounded-lg border border-gnd-cream p-4">
        <h3 className="text-lg font-black text-gnd-dark">{removed ? 'Restore post' : 'Remove post'}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-gnd-gray">Removal is a soft delete. The post is hidden from public discovery but remains available for audit and restoration.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-black text-gnd-dark">Reason category</span>
            <select value={form.reasonCategory} onChange={(event) => setForm((current) => ({ ...current, reasonCategory: event.target.value }))} className="h-11 rounded-lg bg-gnd-cream px-3 text-sm font-bold outline-none">
              <option value="policy_violation">Policy violation</option>
              <option value="safety_review">Safety review</option>
              <option value="spam_or_abuse">Spam or abuse</option>
              <option value="off_platform_payment">Off-platform payment</option>
              <option value="external_contact">External contact</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Field label="Internal note" value={form.staffNote} onChange={(value) => setForm((current) => ({ ...current, staffNote: value }))} />
        </div>
        <label className="mt-4 grid gap-2">
          <span className="text-sm font-black text-gnd-dark">Author message</span>
          <textarea rows={4} value={form.authorMessage} onChange={(event) => setForm((current) => ({ ...current, authorMessage: event.target.value }))} className="rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold outline-none" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {removed ? (
            <DecisionButton icon={CheckCircle2} label="Restore post" disabled={saving} onClick={() => onModerate({ postId: post.id, action: 'restore', reasonCategory: form.reasonCategory, staffNote: form.staffNote, authorMessage: form.authorMessage })} tone="approve" />
          ) : (
            <>
              <DecisionButton icon={CheckCircle2} label="Approve / mark reviewed" disabled={saving} onClick={() => onModerate({ postId: post.id, action: 'approve', reasonCategory: form.reasonCategory, staffNote: form.staffNote, authorMessage: '' })} tone="approve" />
              <DecisionButton icon={Trash2} label="Remove post" disabled={saving} onClick={() => onModerate({ postId: post.id, action: 'remove', reasonCategory: form.reasonCategory, staffNote: form.staffNote, authorMessage: form.authorMessage })} tone="reject" />
            </>
          )}
        </div>
      </section>
    </article>
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
  const statusKey = String(status || 'new').trim().toLowerCase();
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[statusKey] || statusStyles.new}`}>
      {statusLabels[statusKey] || statusLabels.new}
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
