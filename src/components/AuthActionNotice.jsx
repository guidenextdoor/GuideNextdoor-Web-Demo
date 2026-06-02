import { Link } from 'react-router-dom';

export default function AuthActionNotice({ notice, onDismiss, loginPath, t }) {
  if (!notice) return null;

  const message = typeof notice === 'string' ? notice : notice.message;
  const requiresLogin = typeof notice === 'object' && notice.requiresLogin;

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-gnd-dark px-4 py-3 text-sm font-bold text-white shadow-2xl">
      <span className="min-w-0">{message}</span>
      {requiresLogin && (
        <Link
          to={loginPath}
          className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-black !text-gnd-dark transition hover:!text-gnd-red"
        >
          {t('auth.loginTab')}
        </Link>
      )}
      <button type="button" className="shrink-0 text-white/70 transition hover:text-white" onClick={onDismiss}>
        {t('explore.dismiss')}
      </button>
    </div>
  );
}
