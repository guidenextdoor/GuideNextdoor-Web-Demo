import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, CalendarCheck, Lock, Mail, MessageCircle, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { consumeAuthRedirect, fetchCurrentStaffContext, getCurrentSession, sendPasswordResetEmail, signUpWithPassword, signInWithPassword } from '../lib/database';

export default function LoginView({ staffPortal = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = staffPortal
    ? `/${i18n.language}/staff`
    : getSafeRedirectPath(searchParams.get('redirect'), i18n.language);
  const [session, setSession] = useState(() => getCurrentSession());
  const [mode, setMode] = useState('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '', notice: '' });

  useEffect(() => {
    let cancelled = false;
    if (session && !status.saving) {
      const timer = setTimeout(() => {
        resolvePostLoginPath({ fallbackPath: redirectPath, language: i18n.language, staffPortal }).then((path) => {
          if (!cancelled) navigate(path, { replace: true });
        });
      }, 1000);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [session, status.saving, navigate, redirectPath, i18n.language, staffPortal]);

  useEffect(() => {
    let cancelled = false;
    consumeAuthRedirect().then(async (result) => {
      if (cancelled) return;
      if (result.session) {
        setSession(result.session);
        const path = await resolvePostLoginPath({ fallbackPath: redirectPath, language: i18n.language, staffPortal });
        navigate(path, { replace: true });
      } else if (result.error) {
        setStatus({ saving: false, error: t('auth.consumeFailed'), notice: '' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [t, navigate, redirectPath, i18n.language, staffPortal]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '', notice: '' });

    if (staffPortal && mode === 'signup') {
      setMode('login');
      setStatus({ saving: false, error: '', notice: '' });
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setStatus({ saving: false, error: t('auth.passwordMismatch'), notice: '' });
      return;
    }

    if (mode === 'signup' && !nickname.trim()) {
      setStatus({ saving: false, error: t('auth.nicknameRequired'), notice: '' });
      return;
    }

    const result = mode === 'signup'
      ? await signUpWithPassword(email, password, { nickname })
      : await signInWithPassword(email, password);

    if (result.error) {
      setStatus({
        saving: false,
        error: mode === 'signup' ? t('auth.signupFailed') : t('auth.signInFailed'),
        notice: '',
      });
      return;
    }

    if (result.data?.access_token) {
      setSession(result.data);
      setStatus({ saving: false, error: '', notice: t('auth.signedIn') });
      const path = await resolvePostLoginPath({ fallbackPath: redirectPath, language: i18n.language, staffPortal });
      setTimeout(() => navigate(path, { replace: true }), 500);
      return;
    }

    setStatus({ saving: false, error: '', notice: t('auth.checkSignupEmail') });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setStatus({ saving: false, error: 'Enter your email first.', notice: '' });
      return;
    }
    setStatus({ saving: true, error: '', notice: '' });
    const result = await sendPasswordResetEmail(email.trim(), `${window.location.origin}/${i18n.language}/login`);
    setStatus({
      saving: false,
      error: result.error ? 'Could not send the password reset email.' : '',
      notice: result.error ? '' : 'Password reset email sent.',
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid min-h-[72vh] w-full max-w-6xl place-items-center px-5 py-10 md:px-8"
    >
      <div className="grid w-full overflow-hidden rounded-lg border border-gnd-cream bg-white shadow-xl shadow-red-900/5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)]">
        <aside className="hidden border-r border-gnd-cream bg-gnd-cream/25 p-8 lg:flex lg:flex-col">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{staffPortal ? 'Staff portal' : t('auth.contextEyebrow')}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gnd-dark">{staffPortal ? 'GuideNextdoor operations console' : t('auth.contextTitle')}</h2>
            <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-gnd-gray">
              {staffPortal ? 'Sign in with an approved staff account to manage applications, services, users, and moderation queues.' : t('auth.contextSubtitle')}
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {staffPortal ? (
              <>
                <AuthBenefit icon={CalendarCheck} title="Application review" body="Approve, reject, or request more information from coach applicants." />
                <AuthBenefit icon={Bookmark} title="User operations" body="Suspend accounts and review moderation actions from one staff workspace." />
                <AuthBenefit icon={MessageCircle} title="Centralized support" body="Staff messages to applicants stay in the same GuideNextdoor conversation." />
              </>
            ) : (
              <>
                <AuthBenefit icon={CalendarCheck} title={t('auth.benefitBookTitle')} body={t('auth.benefitBookBody')} />
                <AuthBenefit icon={Bookmark} title={t('auth.benefitSaveTitle')} body={t('auth.benefitSaveBody')} />
                <AuthBenefit icon={MessageCircle} title={t('auth.benefitMessageTitle')} body={t('auth.benefitMessageBody')} />
              </>
            )}
          </div>
        </aside>

        <div className="p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{staffPortal ? 'Staff access' : t('auth.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gnd-dark sm:text-4xl">
            {staffPortal ? 'Staff sign in' : mode === 'signup' ? t('auth.signupTitle') : t('auth.title')}
          </h1>
          <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-gnd-gray">
            {staffPortal ? 'Use your approved GuideNextdoor staff account. Public learner actions are disabled for staff accounts.' : t('auth.subtitle')}
          </p>

          {session ? (
            <div className="mt-6 rounded-lg bg-gnd-cream p-6 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gnd-red border-t-transparent" />
            <p className="mt-4 text-sm font-black">{t('auth.signedIn')}</p>
            <p className="mt-1 text-xs font-bold text-gnd-gray">{t('states.loading') || 'Redirecting...'}</p>
          </div>
          ) : (
            <div className="mt-6">
              {!staffPortal && <div className="grid grid-cols-2 rounded-lg bg-gnd-cream p-1">
              {['login', 'signup'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-md px-4 py-2.5 text-sm font-black transition ${mode === option ? 'bg-white text-gnd-red shadow-sm' : 'text-gnd-gray hover:text-gnd-dark'}`}
                  onClick={() => {
                    setMode(option);
                    setStatus({ saving: false, error: '', notice: '' });
                    setNickname('');
                  }}
                >
                  {t(`auth.${option}Tab`)}
                </button>
              ))}
              </div>}

              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                {mode === 'signup' && (
                  <label className="grid gap-2 text-sm font-black text-gnd-dark">
                  {t('auth.nickname')}
                    <div className="flex items-center gap-3 rounded-lg border border-gnd-cream px-4 py-3 focus-within:border-gnd-red">
                    <UserCircle size={18} className="text-gnd-gray" />
                    <input
                      type="text"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                      placeholder={t('auth.nicknamePlaceholder')}
                      required
                    />
                    </div>
                  </label>
                )}
                <label className="grid gap-2 text-sm font-black text-gnd-dark">
                {t('auth.email')}
                  <div className="flex items-center gap-3 rounded-lg border border-gnd-cream px-4 py-3 focus-within:border-gnd-red">
                  <Mail size={18} className="text-gnd-gray" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                    placeholder={t('auth.emailPlaceholder')}
                    required
                  />
                  </div>
                </label>
                <label className="grid gap-2 text-sm font-black text-gnd-dark">
                {t('auth.password')}
                  <div className="flex items-center gap-3 rounded-lg border border-gnd-cream px-4 py-3 focus-within:border-gnd-red">
                  <Lock size={18} className="text-gnd-gray" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                    placeholder={t('auth.passwordPlaceholder')}
                    minLength={6}
                    required
                  />
                  </div>
                </label>
                {mode === 'signup' && (
                  <label className="grid gap-2 text-sm font-black text-gnd-dark">
                  {t('auth.confirmPassword')}
                    <div className="flex items-center gap-3 rounded-lg border border-gnd-cream px-4 py-3 focus-within:border-gnd-red">
                    <Lock size={18} className="text-gnd-gray" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      minLength={6}
                      required
                    />
                    </div>
                  </label>
                )}
                <button type="submit" className="rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white transition hover:bg-gnd-dark disabled:opacity-60" disabled={status.saving}>
                {status.saving ? t('states.saving') : mode === 'signup' ? t('auth.signupEmail') : t('auth.signIn')}
                </button>
                {mode === 'login' && (
                  <button type="button" onClick={handleForgotPassword} className="justify-self-start text-sm font-black text-gnd-red hover:text-gnd-dark">
                    Forgot password?
                  </button>
                )}
              </form>
            </div>
          )}

          {status.error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{status.error}</p>}
          {status.notice && <p className="mt-4 rounded-lg bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-dark">{status.notice}</p>}
        </div>
      </div>
    </motion.section>
  );
}

function AuthBenefit({ icon: Icon, title, body }) {
  return (
    <div className="flex gap-3 rounded-lg border border-gnd-cream bg-white p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gnd-red/10 text-gnd-red">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-sm font-black text-gnd-dark">{title}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-gnd-gray">{body}</p>
      </div>
    </div>
  );
}

function getSafeRedirectPath(value, language) {
  const fallback = `/${language}/explore`;
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith(`/${language}/`)) return fallback;
  if (value.startsWith(`/${language}/login`)) return fallback;
  return value;
}

async function resolvePostLoginPath({ fallbackPath, language, staffPortal }) {
  const staffResult = await fetchCurrentStaffContext();
  if (staffResult.data?.isStaff) return `/${language}/staff`;
  if (staffPortal) return `/${language}/explore`;
  return fallbackPath;
}
