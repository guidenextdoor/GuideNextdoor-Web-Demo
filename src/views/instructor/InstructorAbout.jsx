import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Briefcase, Camera, Check, ChevronDown, Clock, Edit2, Languages, Loader2, MapPin, Save, Search, ShieldCheck, UserCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkUsernameAvailability, fetchInstructorSchedule, fetchLanguages, updateInstructorProfile, uploadFile } from '../../lib/database';
import { compressImage } from '../../lib/image-utils';
import InstructorDashboardLayout from './InstructorDashboardLayout';

export default function InstructorAbout() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [form, setForm] = useState({
    nickname: '',
    username: '',
    bio: '',
    avatarUrl: '',
    languageIds: [],
  });
  const [allLanguages, setAllLanguages] = useState([]);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: true, error: '' });
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  const loadData = async () => {
    try {
      const [scheduleResult, languagesResult] = await Promise.all([
        fetchInstructorSchedule(),
        fetchLanguages()
      ]);

      if (scheduleResult.error && !scheduleResult.data) {
        setState({ loading: false, data: null, error: scheduleResult.error });
        return;
      }

      setState({ loading: false, data: scheduleResult.data, error: null });
      setAllLanguages(languagesResult.data || []);

      if (scheduleResult.data?.coach) {
        const { coach } = scheduleResult.data;
        setForm({
          nickname: coach.nickname || coach.name || '',
          username: coach.username || '',
          bio: coach.bio || '',
          avatarUrl: coach.avatarUrl || '',
          languageIds: (coach.languages || []).map(l => l.id),
        });
      }
    } catch (err) {
      setState({ loading: false, data: null, error: err.message || 'Failed to load profile' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced username check
  useEffect(() => {
    if (!editing || !form.username || form.username === state.data?.coach?.username) {
      setUsernameStatus({ checking: false, available: true, error: '' });
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    setUsernameStatus(prev => ({ ...prev, checking: true, error: '' }));
    debounceTimer.current = setTimeout(async () => {
      const result = await checkUsernameAvailability(form.username);
      setUsernameStatus({
        checking: false,
        available: result.available,
        error: result.available ? '' : (result.error ? 'Error checking' : t('workspace.about.usernameTaken')),
      });
    }, 600);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [form.username, editing, state.data?.coach?.username, t]);

  const handlePhotoClick = () => {
    if (editing) fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.8 });
      const result = await uploadFile('posts', compressed, `avatars/${Date.now()}.jpg`);
      
      if (result.data) {
        setForm(prev => ({ ...prev, avatarUrl: result.data }));
      } else {
        setNotice('Photo upload failed');
      }
    } catch (err) {
      setNotice('Error processing photo');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = (id) => {
    setForm(prev => ({
      ...prev,
      languageIds: prev.languageIds.includes(id)
        ? prev.languageIds.filter(lId => lId !== id)
        : [...prev.languageIds, id]
    }));
  };

  const handleSave = async () => {
    if (!usernameStatus.available) {
      setNotice(t('workspace.about.usernameTaken'));
      return;
    }

    setSaving(true);
    const result = await updateInstructorProfile(form);
    setSaving(false);

    if (result.error) {
      setNotice(result.error === 'auth_required' ? 'Login required' : `Save failed: ${result.error}`);
    } else {
      setEditing(false);
      setNotice('Profile updated successfully');
      loadData();
    }
  };

  const coach = state.data?.coach;
  const services = state.data?.services || [];
  const selectedLangs = allLanguages.filter(l => form.languageIds.includes(l.id));

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.about.eyebrow')}
      title={t('workspace.about.title')}
      subtitle={t('workspace.about.subtitle')}
    >
      {state.loading && (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-gnd-red">
          {typeof state.error === 'string' ? state.error : JSON.stringify(state.error)}
          <button onClick={loadData} className="ml-4 underline">Retry</button>
        </div>
      )}

      {!state.loading && coach && (
        <div className="grid gap-5">
          <section className="relative rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
            <div className="absolute right-4 top-4 flex gap-2">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gnd-cream px-3 py-1.5 text-xs font-black text-gnd-dark transition hover:bg-gnd-red hover:text-white"
                >
                  <Edit2 size={14} />
                  {t('workspace.about.edit') || 'Edit'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-gnd-cream px-3 py-1.5 text-xs font-black text-gnd-dark transition hover:bg-gray-200"
                  >
                    <X size={14} />
                    {t('profile.booking.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || usernameStatus.checking || !usernameStatus.available}
                    className="flex items-center gap-1.5 rounded-lg bg-gnd-red px-3 py-1.5 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <Save size={14} />
                    )}
                    {t('profile.booking.submit') || 'Save'}
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col gap-5 sm:flex-row">
              <div 
                className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gnd-cream group ${editing ? 'cursor-pointer' : ''}`}
                onClick={handlePhotoClick}
              >
                {(form.avatarUrl || coach.avatarUrl) ? (
                  <img src={form.avatarUrl || coach.avatarUrl} alt="" className="h-full w-full object-cover transition group-hover:opacity-80" />
                ) : (
                  <div className="grid h-full place-items-center text-gnd-red">
                    <UserCircle size={42} />
                  </div>
                )}
                {editing && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={24} />
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div className="min-w-0 flex-1 pt-1">
                {editing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Nickname (Display Name)</span>
                      <input
                        type="text"
                        value={form.nickname}
                        onChange={(e) => setForm(p => ({ ...p, nickname: e.target.value }))}
                        className="rounded-lg border border-gnd-cream bg-gnd-cream/30 px-3 py-2 text-sm font-bold outline-none focus:border-gnd-red"
                        placeholder="Public nickname"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Username (URL Slug)</span>
                      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                        usernameStatus.checking ? 'border-gnd-cream bg-gnd-cream/30' :
                        !usernameStatus.available ? 'border-red-500 bg-red-50' :
                        'border-gnd-cream bg-gnd-cream/30 focus-within:border-gnd-red'
                      }`}>
                        <span className="text-sm font-bold text-gnd-gray">@</span>
                        <input
                          type="text"
                          value={form.username}
                          onChange={(e) => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                          placeholder="unique_username"
                        />
                        {usernameStatus.checking && <Loader2 size={14} className="animate-spin text-gnd-gray" />}
                        {!usernameStatus.checking && usernameStatus.available && form.username && <Check size={14} className="text-green-600" />}
                        {!usernameStatus.checking && !usernameStatus.available && <X size={14} className="text-red-600" />}
                      </div>
                    </label>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-gnd-dark">{coach.name}</h2>
                      {coach.verified && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-green-600">
                          <ShieldCheck size={13} />
                          {t('explore.verified')}
                        </span>
                      )}
                    </div>
                    {coach.username && (
                      <p className="mt-0.5 text-xs font-black text-gnd-red tracking-tight">@{coach.username}</p>
                    )}
                  </>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-gnd-gray">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase size={15} className="text-gnd-red" />
                    {coach.role}
                  </span>
                  {coach.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} className="text-gnd-red" />
                      {coach.location}
                    </span>
                  )}
                  {!editing && coach.languages?.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Languages size={15} className="text-gnd-red" />
                      {coach.languages.map(l => t(`languages.${l.code}`) || l.nativeName).join(', ')}
                    </span>
                  )}
                </div>

                {editing ? (
                  <div className="mt-4 grid gap-4">
                    <div className="relative grid gap-1.5" ref={dropdownRef}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Spoken Languages</span>
                      <div
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className={`flex min-h-[46px] cursor-pointer w-full flex-wrap items-center gap-1.5 rounded-xl border transition-all px-3 py-2 text-left text-sm font-bold outline-none ${
                          showLangDropdown ? 'border-gnd-red bg-white ring-4 ring-gnd-red/5' : 'border-gnd-cream bg-gnd-cream/30 hover:border-gnd-red/30'
                        }`}
                      >
                        {selectedLangs.length > 0 ? (
                          selectedLangs.map(l => (
                            <span key={l.id} className="inline-flex items-center gap-1 rounded-lg bg-gnd-red px-2.5 py-1 text-[10px] font-black text-white shadow-sm shadow-red-900/20">
                              {t(`languages.${l.code}`) || l.native_name}
                              <X 
                                size={12} 
                                className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity" 
                                onClick={(e) => { e.stopPropagation(); toggleLanguage(l.id); }} 
                              />
                            </span>
                          ))
                        ) : (
                          <span className="text-gnd-gray/50 font-medium">Select languages...</span>
                        )}
                        <ChevronDown 
                          size={16} 
                          className={`ml-auto shrink-0 text-gnd-gray transition-transform duration-300 ${showLangDropdown ? 'rotate-180 text-gnd-red' : ''}`} 
                        />
                      </div>

                      <AnimatePresence>
                        {showLangDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute top-full left-0 z-50 mt-2 max-h-[320px] w-full flex flex-col overflow-hidden rounded-2xl border border-gnd-cream bg-white shadow-2xl shadow-red-900/10"
                          >
                            <div className="sticky top-0 z-10 border-b border-gnd-cream bg-white p-2">
                              <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gnd-gray" />
                                <input
                                  type="text"
                                  value={langSearch}
                                  onChange={(e) => setLangSearch(e.target.value)}
                                  placeholder="Search languages..."
                                  className="w-full rounded-lg bg-gnd-cream/40 py-2 pl-9 pr-4 text-xs font-bold outline-none focus:bg-gnd-cream/60"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
                              {allLanguages
                                .filter(l => 
                                  t(`languages.${l.code}`)?.toLowerCase().includes(langSearch.toLowerCase()) || 
                                  l.native_name?.toLowerCase().includes(langSearch.toLowerCase())
                                )
                                .map((lang) => {
                                  const isSelected = form.languageIds.includes(lang.id);
                                  return (
                                    <button
                                      key={lang.id}
                                      type="button"
                                      onClick={() => toggleLanguage(lang.id)}
                                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-gnd-cream/40 ${
                                        isSelected ? 'bg-gnd-red/5' : ''
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className={`truncate text-sm font-bold ${isSelected ? 'text-gnd-red' : 'text-gnd-dark'}`}>
                                          {t(`languages.${lang.code}`) || lang.native_name}
                                        </p>
                                        <p className="truncate text-[10px] font-medium text-gnd-gray opacity-60">
                                          {lang.native_name}
                                        </p>
                                      </div>
                                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                                        isSelected ? 'border-gnd-red bg-gnd-red text-white scale-100' : 'border-gnd-cream group-hover:border-gnd-red/30 scale-90 opacity-0 group-hover:opacity-100'
                                      }`}>
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                    </button>
                                  );
                                })}
                              {allLanguages.filter(l => 
                                t(`languages.${l.code}`)?.toLowerCase().includes(langSearch.toLowerCase()) || 
                                l.native_name?.toLowerCase().includes(langSearch.toLowerCase())
                              ).length === 0 && (
                                <div className="py-8 text-center">
                                  <p className="text-xs font-bold text-gnd-gray">No languages found</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <label className="grid gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">Bio Description</span>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
                        className="min-h-[120px] rounded-lg border border-gnd-cream bg-gnd-cream/30 px-3 py-2 text-sm font-bold outline-none focus:border-gnd-red"
                        placeholder="Share your background and coaching style..."
                      />
                    </label>
                  </div>
                ) : (
                  <p className="mt-5 max-w-3xl text-sm font-bold leading-7 text-gnd-gray whitespace-pre-wrap">
                    {coach.bio || t('workspace.about.bioPending')}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gnd-cream bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-gnd-red" />
              <h2 className="text-lg font-black text-gnd-dark">{t('profile.tabs.credentials')}</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {services.length ? services.map((service) => (
                <article key={service.id} className="rounded-lg border border-gnd-cream bg-gnd-cream/15 p-4">
                  <p className="text-sm font-black text-gnd-dark">{service.title}</p>
                  <p className="mt-1 text-xs font-bold text-gnd-gray">
                    {service.qualification || t('profile.credentials.noQualification')}
                  </p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gnd-red">
                    {service.years || 0} {t('profile.stats.years')}
                  </p>
                </article>
              )) : (
                <p className="text-sm font-bold text-gnd-gray">{t('workspace.about.noServices')}</p>
              )}
            </div>
          </section>
        </div>
      )}
      
      {notice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gnd-dark px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {notice}
          <button type="button" className="ml-3 text-white/70" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}
    </InstructorDashboardLayout>
  );
}
