import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Camera, Loader2, Save, UserCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchCurrentUserProfile, getCurrentSession, updateCurrentUserPassword, updateCurrentUserProfile, uploadUserAvatar } from '../lib/database';

const AVATAR_FRAME_SIZE = 300;

export default function AccountProfileView({ embedded = false }) {
  const { t, i18n } = useTranslation();
  const session = getCurrentSession();
  const fileInputRef = useRef(null);
  const [state, setState] = useState({ loading: true, profile: null, error: '' });
  const [form, setForm] = useState({ nickname: '', avatarUrl: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [avatarEditor, setAvatarEditor] = useState(null);
  const [status, setStatus] = useState({ saving: false, uploading: false, error: '', notice: '' });
  const [passwordStatus, setPasswordStatus] = useState({ saving: false, error: '', notice: '' });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUserProfile().then((result) => {
      if (cancelled) return;
      setState({ loading: false, profile: result.data, error: result.error || '' });
      if (result.data) {
        setForm({
          nickname: result.data.nickname || '',
          avatarUrl: result.data.avatarUrl || '',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return embedded ? null : <Navigate to={`/${i18n.language}/login?redirect=${encodeURIComponent(`/${i18n.language}/profile`)}`} replace />;

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (avatarEditor?.previewUrl) URL.revokeObjectURL(avatarEditor.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    let naturalWidth = 1;
    let naturalHeight = 1;
    try {
      const image = await loadImage(previewUrl);
      naturalWidth = image.naturalWidth || 1;
      naturalHeight = image.naturalHeight || 1;
    } catch {
      // The preview can still open; save will report an error if decoding fails.
    }
    setAvatarEditor({
      file,
      previewUrl,
      naturalWidth,
      naturalHeight,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    event.target.value = '';
  };

  const uploadEditedAvatar = async () => {
    if (!avatarEditor) return;

    setStatus({ saving: false, uploading: true, error: '', notice: '' });
    try {
      const cropped = await cropAvatarImage(avatarEditor);
      const result = await uploadUserAvatar(cropped);
      if (result.error) {
        setStatus({ saving: false, uploading: false, error: result.error, notice: '' });
        return;
      }
      setForm((current) => ({ ...current, avatarUrl: result.data?.avatarUrl || current.avatarUrl }));
      URL.revokeObjectURL(avatarEditor.previewUrl);
      setAvatarEditor(null);
      setStatus({ saving: false, uploading: false, error: '', notice: t('account.photoUpdated') });
    } catch (error) {
      setStatus({ saving: false, uploading: false, error: error.message || String(error), notice: '' });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, uploading: false, error: '', notice: '' });

    const result = await updateCurrentUserProfile({
      nickname: form.nickname,
      displayName: form.nickname,
      avatarUrl: form.avatarUrl,
    });

    if (result.error) {
      setStatus({ saving: false, uploading: false, error: result.error, notice: '' });
      return;
    }

    setState((current) => ({ ...current, profile: result.data }));
    setStatus({ saving: false, uploading: false, error: '', notice: t('account.saved') });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setPasswordStatus({ saving: false, error: 'Password must be at least 8 characters.', notice: '' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ saving: false, error: 'Passwords do not match.', notice: '' });
      return;
    }
    setPasswordStatus({ saving: true, error: '', notice: '' });
    const result = await updateCurrentUserPassword(passwordForm.newPassword);
    if (result.error) {
      setPasswordStatus({ saving: false, error: 'Could not update password. Please try again.', notice: '' });
      return;
    }
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setPasswordStatus({ saving: false, error: '', notice: 'Password updated.' });
  };

  const content = state.loading ? (
        <div className="grid h-64 place-items-center rounded-lg bg-white">
          <Loader2 className="animate-spin text-gnd-red" size={32} />
        </div>
      ) : (
        <div className="grid gap-5">
        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-5 shadow-xl shadow-red-900/5 md:p-7">
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <section>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group mx-auto grid aspect-square w-full max-w-[220px] place-items-center overflow-hidden rounded-full border border-dashed border-gnd-cream bg-gnd-cream/40 text-gnd-red transition hover:border-gnd-red/40"
              >
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid place-items-center gap-3">
                    <Camera size={28} />
                    <span className="text-xs font-black uppercase tracking-widest">{t('account.addPhoto')}</span>
                  </div>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
              {status.uploading && <p className="mt-3 text-xs font-black text-gnd-red">{t('account.uploading')}</p>}
              <AnimatePresence>
              {avatarEditor && (
                <AvatarEditor
                  editor={avatarEditor}
                  setEditor={setAvatarEditor}
                  onCancel={() => {
                    URL.revokeObjectURL(avatarEditor.previewUrl);
                    setAvatarEditor(null);
                  }}
                  onSave={uploadEditedAvatar}
                  saving={status.uploading}
                  t={t}
                />
              )}
              </AnimatePresence>
            </section>

            <section className="grid content-start gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-gnd-dark">{t('account.nickname')} <span className="text-gnd-red">*</span></span>
                <input
                  value={form.nickname}
                  onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
                  required
                  className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20"
                />
                <span className="text-xs font-bold leading-5 text-gnd-gray">{t('account.nicknameHelp')}</span>
              </label>
              <div className="rounded-lg bg-gnd-cream/60 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray">{t('account.email')}</p>
                <p className="mt-1 text-sm font-bold text-gnd-dark">{state.profile?.email || session.user.email}</p>
              </div>
            </section>
          </div>

          {state.error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{state.error}</p>}
          {status.error && <p className="mt-5 max-h-28 overflow-auto rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{status.error}</p>}
          {status.notice && <p className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-600">{status.notice}</p>}

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={status.saving || status.uploading} className="inline-flex items-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white transition hover:bg-gnd-dark disabled:opacity-60">
              <Save size={17} />
              {status.saving ? t('states.saving') : t('account.save')}
            </button>
          </div>
        </form>
        <form onSubmit={handlePasswordSubmit} className="rounded-lg bg-white p-5 shadow-xl shadow-red-900/5 md:p-7">
          <h2 className="text-xl font-black text-gnd-dark">Account security</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gnd-gray">Update your password directly from this page. This applies to learner, instructor, and staff accounts.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                minLength={8}
                className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black text-gnd-dark">Confirm new password</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                minLength={8}
                className="h-12 rounded-lg bg-gnd-cream px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-gnd-red/20"
              />
            </label>
          </div>
          {passwordStatus.error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{passwordStatus.error}</p>}
          {passwordStatus.notice && <p className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-600">{passwordStatus.notice}</p>}
          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={passwordStatus.saving || !passwordForm.newPassword || !passwordForm.confirmPassword} className="inline-flex items-center gap-2 rounded-lg bg-gnd-dark px-5 py-3 text-sm font-black text-white transition hover:bg-gnd-red disabled:opacity-60">
              {passwordStatus.saving ? t('states.saving') : 'Update password'}
            </button>
          </div>
        </form>
        </div>
      );

  if (embedded) return content;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12"
    >
      <div className="mb-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-gnd-red">
          <UserCircle size={15} />
          {t('account.eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gnd-dark md:text-5xl">{t('account.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-gnd-gray">{t('account.subtitle')}</p>
      </div>
      {content}
    </motion.section>
  );
}

function AvatarEditor({ editor, setEditor, onCancel, onSave, saving, t }) {
  const frameRef = useRef(null);
  const dragRef = useRef({ active: false, mode: 'drag', startX: 0, startY: 0, offsetX: 0, offsetY: 0, distance: 0, zoom: 1 });

  const startDrag = (event) => {
    if (saving) return;
    if (event.touches?.length >= 2) {
      dragRef.current = {
        active: true,
        mode: 'pinch',
        startX: 0,
        startY: 0,
        offsetX: editor.offsetX,
        offsetY: editor.offsetY,
        distance: getTouchDistance(event),
        zoom: editor.zoom,
      };
      return;
    }
    const point = getPointerPoint(event);
    dragRef.current = {
      active: true,
      mode: 'drag',
      startX: point.x,
      startY: point.y,
      offsetX: editor.offsetX,
      offsetY: editor.offsetY,
      distance: 0,
      zoom: editor.zoom,
    };
  };

  const moveDrag = (event) => {
    if (!dragRef.current.active || saving) return;
    event.preventDefault();
    if (dragRef.current.mode === 'pinch' && event.touches?.length >= 2) {
      const nextZoom = clamp(dragRef.current.zoom * (getTouchDistance(event) / dragRef.current.distance), 1, 3);
      setEditor((current) => ({
        ...current,
        zoom: nextZoom,
        ...constrainAvatarOffset({
          zoom: nextZoom,
          offsetX: current.offsetX,
          offsetY: current.offsetY,
          frameSize: getFrameSize(frameRef.current),
          naturalWidth: current.naturalWidth,
          naturalHeight: current.naturalHeight,
        }),
      }));
      return;
    }
    const point = getPointerPoint(event);
    const nextOffset = constrainAvatarOffset({
      zoom: editor.zoom,
      offsetX: dragRef.current.offsetX + point.x - dragRef.current.startX,
      offsetY: dragRef.current.offsetY + point.y - dragRef.current.startY,
      frameSize: getFrameSize(frameRef.current),
      naturalWidth: editor.naturalWidth,
      naturalHeight: editor.naturalHeight,
    });
    setEditor((current) => ({ ...current, ...nextOffset }));
  };

  const stopDrag = () => {
    dragRef.current.active = false;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    setEditor((current) => {
      const zoom = clamp(current.zoom + direction, 1, 3);
      return {
        ...current,
        zoom,
        ...constrainAvatarOffset({
          zoom,
          offsetX: current.offsetX,
          offsetY: current.offsetY,
          frameSize: getFrameSize(frameRef.current),
          naturalWidth: current.naturalWidth,
          naturalHeight: current.naturalHeight,
        }),
      };
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-gnd-dark/60 backdrop-blur-sm"
        onClick={saving ? undefined : onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="fixed inset-x-4 top-1/2 z-[81] mx-auto max-h-[calc(100vh-2rem)] max-w-lg -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t('account.adjustPhoto')}
      >
        <div className="flex items-center justify-between border-b border-gnd-cream px-5 py-4">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md p-2 text-gnd-gray transition hover:bg-gnd-cream hover:text-gnd-red disabled:opacity-40" aria-label={t('profile.booking.cancel')}>
            <X size={18} />
          </button>
          <h2 className="text-base font-black text-gnd-dark">{t('account.adjustPhoto')}</h2>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-md px-3 py-2 text-sm font-black text-gnd-red transition hover:bg-gnd-red/10 disabled:opacity-40">
            {saving ? t('states.saving') : t('account.usePhoto')}
          </button>
        </div>

        <div className="p-5">
          <div
            ref={frameRef}
            className="relative mx-auto aspect-square w-[min(72vw,300px)] max-w-[300px] cursor-grab touch-none select-none overflow-hidden rounded-full bg-gnd-cream shadow-inner active:cursor-grabbing"
            onMouseDown={startDrag}
            onMouseMove={moveDrag}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={startDrag}
            onTouchMove={moveDrag}
            onTouchEnd={stopDrag}
            onWheel={handleWheel}
          >
            <img
              src={editor.previewUrl}
              alt=""
              draggable="false"
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={buildAvatarImageStyle(editor, AVATAR_FRAME_SIZE)}
            />
          </div>
          <p className="mt-5 text-center text-xs font-bold leading-5 text-gnd-gray">{t('account.dragPhoto')}</p>
        </div>
      </motion.div>
    </>
  );
}

async function cropAvatarImage({ previewUrl, zoom, offsetX, offsetY }) {
  const image = await loadImage(previewUrl);
  const size = 700;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const safeOffset = constrainAvatarOffset({
    zoom,
    offsetX,
    offsetY,
    frameSize: 300,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  });
  const drawX = (size - drawWidth) / 2 + safeOffset.offsetX * (size / 300);
  const drawY = (size - drawHeight) / 2 + safeOffset.offsetY * (size / 300);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Could not prepare avatar image.');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getPointerPoint(event) {
  const source = event.touches?.[0] || event.changedTouches?.[0] || event;
  return { x: source.clientX, y: source.clientY };
}

function getTouchDistance(event) {
  const [first, second] = event.touches;
  if (!first || !second) return 1;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) || 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getFrameSize(element) {
  return element?.getBoundingClientRect?.().width || 300;
}

function constrainAvatarOffset({ zoom, offsetX, offsetY, frameSize, naturalWidth = 1, naturalHeight = 1 }) {
  const imageSize = getCoveredImageSize({ naturalWidth, naturalHeight, frameSize, zoom });
  const maxOffsetX = Math.max(0, (imageSize.width - frameSize) / 2);
  const maxOffsetY = Math.max(0, (imageSize.height - frameSize) / 2);
  return {
    offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
  };
}

function getCoveredImageSize({ naturalWidth, naturalHeight, frameSize, zoom }) {
  const safeWidth = naturalWidth || 1;
  const safeHeight = naturalHeight || 1;
  const coverScale = Math.max(frameSize / safeWidth, frameSize / safeHeight) * zoom;
  return {
    width: safeWidth * coverScale,
    height: safeHeight * coverScale,
  };
}

function buildAvatarImageStyle(editor, frameSize) {
  const imageSize = getCoveredImageSize({
    naturalWidth: editor.naturalWidth,
    naturalHeight: editor.naturalHeight,
    frameSize,
    zoom: editor.zoom,
  });
  const safeOffset = constrainAvatarOffset({
    zoom: editor.zoom,
    offsetX: editor.offsetX,
    offsetY: editor.offsetY,
    frameSize,
    naturalWidth: editor.naturalWidth,
    naturalHeight: editor.naturalHeight,
  });
  return {
    width: `${imageSize.width}px`,
    height: `${imageSize.height}px`,
    transform: `translate(calc(-50% + ${safeOffset.offsetX}px), calc(-50% + ${safeOffset.offsetY}px))`,
  };
}
