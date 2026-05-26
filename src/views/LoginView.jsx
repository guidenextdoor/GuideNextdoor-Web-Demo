import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { consumeAuthRedirect, getCurrentSession, getOAuthLoginUrl, requestEmailLogin, signOut } from '../lib/database';

export default function LoginView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getCurrentSession());
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '', notice: '' });

  useEffect(() => {
    let cancelled = false;
    consumeAuthRedirect().then((result) => {
      if (cancelled) return;
      if (result.session) {
        setSession(result.session);
        setStatus({ saving: false, error: '', notice: t('auth.signedIn') });
      } else if (result.error) {
        setStatus({ saving: false, error: t('auth.consumeFailed'), notice: '' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '', notice: '' });

    const result = await requestEmailLogin(email, `${window.location.origin}/${i18n.language}/login`, {
      shouldCreateUser: mode === 'signup',
    });
    if (result.error) {
      setStatus({
        saving: false,
        error: mode === 'signup' ? t('auth.signupFailed') : t('auth.sendFailed'),
        notice: '',
      });
      return;
    }

    setStatus({ saving: false, error: '', notice: mode === 'signup' ? t('auth.checkSignupEmail') : t('auth.checkEmail') });
  };

  const handleGoogle = () => {
    const url = getOAuthLoginUrl('google', `${window.location.origin}/${i18n.language}/login`);
    if (!url) {
      setStatus({ saving: false, error: t('auth.sendFailed'), notice: '' });
      return;
    }

    window.location.assign(url);
  };

  const handleSignOut = () => {
    signOut();
    setSession(null);
    setStatus({ saving: false, error: '', notice: t('auth.signedOut') });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-12 md:px-8"
    >
      <div className="w-full rounded-[1.5rem] bg-white p-6 shadow-xl shadow-red-900/5 md:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gnd-red text-white">
          <LogIn size={24} />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('auth.eyebrow')}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{mode === 'signup' ? t('auth.signupTitle') : t('auth.title')}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-gnd-gray">{t('auth.subtitle')}</p>

        {session ? (
          <div className="mt-6 rounded-2xl bg-gnd-cream p-4">
            <p className="text-sm font-black">{session.user?.email || t('auth.signedIn')}</p>
            <p className="mt-1 text-xs font-bold text-gnd-gray">{t('auth.sessionReady')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" className="flex items-center justify-center gap-2 rounded-xl bg-gnd-dark px-5 py-3 text-sm font-black text-white" onClick={() => navigate(`/${i18n.language}/sessions`)}>
                {t('auth.goDashboard')}
              </button>
              <button type="button" className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-gnd-dark" onClick={handleSignOut}>
                <LogOut size={17} />
                {t('auth.signOut')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div className="grid grid-cols-2 rounded-2xl bg-gnd-cream p-1">
              {['login', 'signup'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-xl px-4 py-2.5 text-sm font-black ${mode === option ? 'bg-white text-gnd-red shadow-sm' : 'text-gnd-gray'}`}
                  onClick={() => {
                    setMode(option);
                    setStatus({ saving: false, error: '', notice: '' });
                  }}
                >
                  {t(`auth.${option}Tab`)}
                </button>
              ))}
            </div>

            <button type="button" className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-gnd-cream bg-white px-5 py-3 text-sm font-black text-gnd-dark transition hover:border-gnd-red" onClick={handleGoogle}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base font-black text-[#4285F4]">G</span>
              {mode === 'signup' ? t('auth.signupGoogle') : t('auth.loginGoogle')}
            </button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gnd-cream" />
              <span className="text-xs font-black uppercase tracking-[0.14em] text-gnd-gray">{t('auth.orEmail')}</span>
              <span className="h-px flex-1 bg-gnd-cream" />
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-black">
              {t('auth.email')}
              <div className="flex items-center gap-3 rounded-2xl border border-gnd-cream px-4 py-3 focus-within:border-gnd-red">
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
            <button type="submit" className="rounded-2xl bg-gnd-red px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={status.saving}>
              {status.saving ? t('states.saving') : mode === 'signup' ? t('auth.signupEmail') : t('auth.sendLink')}
            </button>
            </form>
          </div>
        )}

        {status.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{status.error}</p>}
        {status.notice && <p className="mt-4 rounded-2xl bg-gnd-cream px-4 py-3 text-sm font-bold text-gnd-dark">{status.notice}</p>}

        <Link to={`/${i18n.language}/explore`} className="mt-6 inline-flex text-sm font-black text-gnd-red">
          {t('auth.backExplore')}
        </Link>
      </div>
    </motion.section>
  );
}
