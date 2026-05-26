import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  Bookmark,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchInstructorProfile, submitBookingRequest, togglePostLike, toggleSavedPost } from '../lib/database';

const tabs = ['posts', 'credentials', 'sessions', 'reviews'];

export default function GuideProfileView() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, coach: null, error: null });
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [bookingServiceId, setBookingServiceId] = useState(null);
  const [notice, setNotice] = useState('');
  const [shouldScrollToSessions, setShouldScrollToSessions] = useState(false);
  const sessionsSectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchInstructorProfile(id).then((result) => {
      if (!cancelled) setState({ loading: false, coach: result.data, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!shouldScrollToSessions || activeTab !== 'sessions') return;

    window.requestAnimationFrame(() => {
      sessionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShouldScrollToSessions(false);
    });
  }, [activeTab, shouldScrollToSessions]);

  if (state.loading) {
    return <div className="mx-auto max-w-7xl px-5 py-20 text-gnd-gray md:px-8">{t('states.loadingDatabase')}</div>;
  }

  if (state.error || !state.coach) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <div className="rounded-lg bg-white p-10">
          <h1 className="text-3xl font-black">{t('profile.notFoundTitle')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gnd-gray">{t('profile.notFoundBody')}</p>
          <Link to={`/${i18n.language}/explore`} className="mt-6 inline-flex rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white">
            {t('profile.backToExplore')}
          </Link>
        </div>
      </div>
    );
  }

  const coach = state.coach;
  const coverImage = coach.coverPhotoUrl || coach.avatarUrl;
  const selectedPost = coach.posts.find((post) => post.id === selectedPostId);
  const bookingService = coach.services.find((service) => service.id === bookingServiceId);

  const showSessions = () => {
    setActiveTab('sessions');
    setShouldScrollToSessions(true);
  };

  const updatePost = (postId, updater) => {
    setState((current) => {
      if (!current.coach) return current;

      const posts = current.coach.posts.map((post) => (post.id === postId ? updater(post) : post));
      return {
        ...current,
        coach: {
          ...current.coach,
          posts,
          stats: {
            ...current.coach.stats,
            totalLikes: posts.reduce((sum, post) => sum + (Number(post.likes) || 0), 0),
          },
        },
      };
    });
  };

  const handleLike = async (post) => {
    const nextLiked = !post.liked;
    updatePost(post.id, (current) => ({
      ...current,
      liked: nextLiked,
      likes: Math.max(0, current.likes + (nextLiked ? 1 : -1)),
    }));

    const result = await togglePostLike(post);
    if (result.alreadyExists) {
      updatePost(post.id, (current) => ({ ...current, liked: true, likes: post.likes }));
      return;
    }

    if (result.error) {
      updatePost(post.id, () => post);
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : t('explore.interactionFailed'));
    }
  };

  const handleSave = async (post) => {
    const nextSaved = !post.saved;
    updatePost(post.id, (current) => ({ ...current, saved: nextSaved }));

    const result = await toggleSavedPost(post);
    if (result.error) {
      updatePost(post.id, () => post);
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : t('explore.interactionFailed'));
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12"
    >
      <article className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-red-900/5">
        <div className="relative h-52 bg-gnd-dark md:h-72">
          {coverImage ? (
            <img src={coverImage} alt="" className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="grid h-full place-items-center text-white/40">
              <ImageIcon size={48} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>

        <div className="px-5 pb-6 md:px-8 md:pb-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-start">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <div className="flex min-w-0 items-end gap-3 sm:gap-4">
                <div className="relative -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] border-4 border-white bg-gnd-cream shadow-xl sm:-mt-14 sm:h-28 sm:w-28 md:h-32 md:w-32 lg:mt-0">
                {coach.avatarUrl ? (
                  <img src={coach.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-3xl font-black text-gnd-red">
                    {coach.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {coach.verified && (
                  <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-gnd-red text-white">
                    <ShieldCheck size={18} />
                  </span>
                )}
                </div>

                <div className="min-w-0 pb-1">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('profile.eyebrow')}</p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">{coach.name}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-gnd-gray">
                    {coach.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={15} />
                        {coach.location}
                      </span>
                    )}
                    {coach.verified && (
                      <span className="inline-flex items-center gap-1 text-gnd-red">
                        <CheckCircle2 size={15} />
                        {t('profile.verified')}
                      </span>
                    )}
                    {coach.timezone && <span>{coach.timezone}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[1.25rem] bg-white p-3 shadow-xl shadow-red-900/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-36 lg:justify-self-end">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <Stat label={t('profile.stats.likes')} value={coach.stats.totalLikes} />
                <Stat label={t('profile.stats.reviews')} value={coach.stats.reviewCount} />
                <Stat label={t('profile.stats.sessions')} value={coach.stats.sessionCount} />
                <Stat label={t('profile.stats.services')} value={coach.stats.serviceCount} />
                <Stat label={t('profile.stats.years')} value={coach.stats.maxYears ? `${coach.stats.maxYears}+` : t('explore.newRating')} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link to={`/${i18n.language}/messages`} className="flex items-center justify-center gap-2 rounded-xl bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark">
                  <MessageSquare size={16} />
                  {t('profile.messageAction')}
                </Link>
                <button type="button" onClick={showSessions} className="flex items-center justify-center gap-2 rounded-xl bg-gnd-red px-4 py-2.5 text-xs font-black text-white">
                  <CalendarDays size={16} />
                  {t('profile.viewSessions')}
                </button>
              </div>
            </div>

            <p className="max-w-3xl text-base leading-7 text-gnd-gray lg:col-start-1 lg:row-start-2 lg:mt-5">{coach.bio || t('explore.pendingBio')}</p>
          </div>
        </div>
      </article>

      <nav className="sticky top-0 z-30 mt-6 overflow-x-auto rounded-2xl bg-white/95 px-2 shadow-lg shadow-red-900/5 backdrop-blur">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-4 text-sm font-black ${activeTab === tab ? 'text-gnd-red' : 'text-gnd-gray'}`}
            >
              {t(`profile.tabs.${tab}`)}
              {activeTab === tab && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gnd-red" />}
            </button>
          ))}
        </div>
      </nav>

      <div ref={sessionsSectionRef} className="mt-6 scroll-mt-24">
        {activeTab === 'posts' && <PostsTab coach={coach} t={t} onOpenPost={setSelectedPostId} />}
        {activeTab === 'credentials' && <CredentialsTab coach={coach} t={t} />}
        {activeTab === 'sessions' && <SessionsTab coach={coach} t={t} onRequestSession={setBookingServiceId} />}
        {activeTab === 'reviews' && <ReviewsTab coach={coach} t={t} />}
      </div>

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-gnd-dark px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {notice}
          <button type="button" className="ml-3 text-white/70" onClick={() => setNotice('')}>{t('explore.dismiss')}</button>
        </div>
      )}

      {selectedPost && (
        <ProfilePostModal
          post={selectedPost}
          coach={coach}
          onClose={() => setSelectedPostId(null)}
          onLike={() => handleLike(selectedPost)}
          onSave={() => handleSave(selectedPost)}
          onViewSessions={() => {
            setSelectedPostId(null);
            showSessions();
          }}
          messagePath={`/${i18n.language}/messages`}
          t={t}
        />
      )}

      {bookingService && (
        <BookingRequestModal
          coach={coach}
          service={bookingService}
          onClose={() => setBookingServiceId(null)}
          onSubmitted={() => {
            setBookingServiceId(null);
            setNotice(t('profile.booking.success'));
          }}
          t={t}
        />
      )}
    </motion.section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-gnd-cream px-1.5 py-2 text-center sm:px-2">
      <p className="truncate text-base font-black leading-5 sm:text-lg">{value}</p>
      <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.03em] text-gnd-gray sm:text-[10px]">{label}</p>
    </div>
  );
}

function PostsTab({ coach, t, onOpenPost }) {
  if (!coach.posts.length) return <EmptyPanel title={t('profile.empty.postsTitle')} body={t('profile.empty.postsBody')} />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {coach.posts.map((post) => (
        <article key={post.id} className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-red-900/5">
          <button type="button" className="relative block aspect-[4/5] w-full bg-gnd-cream text-left" onClick={() => onOpenPost(post.id)}>
            {post.imageUrl ? <img src={post.imageUrl} alt="" className="h-full w-full object-cover" /> : <Camera className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gnd-gray" />}
          </button>
          <div className="p-3">
            <button type="button" className="line-clamp-2 text-left text-sm font-bold leading-5" onClick={() => onOpenPost(post.id)}>{post.caption || post.title}</button>
            <div className="mt-3 flex items-center justify-between text-xs font-black text-gnd-gray">
              <span className="flex items-center gap-1"><Heart size={14} />{post.likes}</span>
              <span className="flex items-center gap-1"><MessageCircle size={14} />{post.comments}</span>
              <span>{post.displayDate}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfilePostModal({ post, coach, onClose, onLike, onSave, onViewSessions, messagePath, t }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gnd-dark/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.article
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-[minmax(0,1.1fr)_390px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-black">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt={post.title} className="h-full max-h-[92vh] w-full object-contain md:object-cover" />
          ) : (
            <div className="grid h-[60vh] place-items-center text-white/50">
              <Camera size={44} />
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src={coach.avatarUrl || post.imageUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{coach.name}</h2>
                <p className="mt-0.5 flex h-4 items-center gap-1 truncate text-xs font-bold text-gnd-gray">
                  {post.location || coach.location ? (
                    <>
                      <MapPin size={12} />
                      <span className="truncate">{post.location || coach.location}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={onClose} aria-label={t('explore.closePost')}>
              <X size={19} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex items-center justify-between border-y border-gnd-cream py-3 text-gnd-gray">
              <div className="flex items-center gap-5">
                <button type="button" className={`flex items-center gap-2 text-sm font-black ${post.liked ? 'text-gnd-red' : ''}`} onClick={onLike}>
                  <Heart size={22} className={post.liked ? 'fill-current' : ''} />
                  {post.likes}
                </button>
                <span className="flex items-center gap-2 text-sm font-black">
                  <MessageCircle size={22} />
                  {post.comments}
                </span>
              </div>
              <button type="button" className={`flex items-center gap-2 text-sm font-black ${post.saved ? 'text-gnd-red' : ''}`} onClick={onSave}>
                <Bookmark size={22} className={post.saved ? 'fill-current' : ''} />
                {t('explore.save')}
              </button>
            </div>

            <p className="whitespace-pre-line text-sm leading-6 text-gnd-dark">{post.caption || post.title}</p>
            {post.displayDate && <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-gnd-gray">{post.displayDate}</p>}
            {post.hashtags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.hashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gnd-cream px-3 py-1 text-xs font-black text-gnd-red">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          <footer className="grid grid-cols-2 gap-3 p-4">
            <Link to={messagePath} className="flex items-center justify-center gap-2 rounded-2xl bg-gnd-red px-5 py-3 text-sm font-black text-white">
              <MessageSquare size={18} />
              {t('explore.messageCta')}
            </Link>
            <button type="button" className="rounded-2xl bg-gnd-dark px-5 py-3 text-sm font-black text-white" onClick={onViewSessions}>
              {t('explore.viewSessionsCta')}
            </button>
          </footer>
        </div>
      </motion.article>
    </div>
  );
}

function CredentialsTab({ coach, t }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gnd-red text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('profile.credentials.verification')}</p>
            <h2 className="mt-1 text-2xl font-black">{coach.verified ? t('profile.verified') : t('profile.credentials.pending')}</h2>
            <p className="mt-2 text-sm leading-6 text-gnd-gray">{t('profile.credentials.verificationBody')}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('profile.credentials.experience')}</p>
        <div className="mt-4 grid gap-3">
          {coach.services.length ? coach.services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-gnd-cream p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{service.title}</h3>
                  <p className="mt-1 text-sm font-bold text-gnd-gray">{service.qualification || t('profile.credentials.noQualification')}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gnd-cream px-3 py-1 text-xs font-black text-gnd-red">{service.years}+ {t('profile.years')}</span>
              </div>
              {service.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {service.tags.map((tag) => <span key={tag} className="rounded-full bg-gnd-cream px-3 py-1 text-xs font-bold text-gnd-gray">{tag}</span>)}
                </div>
              )}
            </div>
          )) : <p className="text-sm text-gnd-gray">{t('profile.empty.credentialsBody')}</p>}
        </div>
      </section>
    </div>
  );
}

function SessionsTab({ coach, t, onRequestSession }) {
  if (!coach.services.length) return <EmptyPanel title={t('profile.empty.sessionsTitle')} body={t('profile.empty.sessionsBody')} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {coach.services.map((service) => (
        <article key={service.id} className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">{service.status}</p>
              <h2 className="mt-2 text-2xl font-black">{service.title}</h2>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gnd-cream text-gnd-red">
              <Award size={22} />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-gnd-gray">{service.description || t('profile.sessions.descriptionPending')}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-gnd-gray">
            {service.locations.map((location) => <span key={location.id} className="rounded-full bg-gnd-cream px-3 py-1">{location.name}</span>)}
            {service.years > 0 && <span className="rounded-full bg-gnd-cream px-3 py-1">{service.years}+ {t('profile.years')}</span>}
            {service.qualification && <span className="rounded-full bg-gnd-cream px-3 py-1">{service.qualification}</span>}
          </div>
          <div className="mt-5 rounded-2xl bg-gnd-cream p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-gnd-gray">{t('profile.sessions.from')}</p>
                <p className="mt-1 text-2xl font-black">{service.minPrice ? formatCurrency(service.minPrice, service.currency) : t('profile.sessions.pricePending')}</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-black text-gnd-gray">
                <Clock size={16} />
                {t('profile.sessions.requestBased')}
              </div>
            </div>
          </div>
          <button type="button" className="mt-4 w-full rounded-2xl bg-gnd-red px-5 py-3 text-sm font-black text-white" onClick={() => onRequestSession(service.id)}>
            {t('profile.bookAction')}
          </button>
        </article>
      ))}
    </div>
  );
}

function BookingRequestModal({ coach, service, onClose, onSubmitted, t }) {
  const skillLevels = service.pricing.length ? service.pricing.map((pricing) => pricing.skillLevel).filter(Boolean) : ['Beginner', 'Intermediate', 'Advanced'];
  const today = toDateInputValue(new Date());
  const initialDateOptions = buildBookingDateOptions(coach.availability, coach.bookedSlots, getMonthStart(new Date()), 1);
  const initialDate = initialDateOptions.find((option) => option.hasAvailability && !option.isPast)?.value || today;
  const initialSlots = getAvailableStartTimes(coach.availability, coach.bookedSlots, initialDate, 1);
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(initialDate));
  const [form, setForm] = useState({
    lessonDate: initialDate,
    startTime: initialSlots[0] || coach.availability[0]?.startTime || '09:00',
    durationHours: 1,
    groupSize: 1,
    skillLevel: skillLevels[0] || 'Beginner',
    locationDetails: '',
    note: '',
  });
  const [status, setStatus] = useState({ saving: false, error: '' });
  const dateOptions = buildBookingDateOptions(coach.availability, coach.bookedSlots, visibleMonth, form.durationHours);
  const calendarCells = buildCalendarCells(dateOptions, visibleMonth);
  const matchingSlots = getAvailabilityForDate(coach.availability, form.lessonDate);
  const blockedSlots = getBlockedSlotsForDate(coach.bookedSlots, form.lessonDate);
  const startTimes = getAvailableStartTimes(coach.availability, coach.bookedSlots, form.lessonDate, form.durationHours);
  const totalPrice = calculateBookingPrice(service, form.skillLevel, form.groupSize, form.durationHours);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '' });

    if (!form.lessonDate || !form.startTime || !form.skillLevel) {
      setStatus({ saving: false, error: t('profile.booking.validationError') });
      return;
    }

    const result = await submitBookingRequest({
      serviceId: service.id,
      lessonDate: form.lessonDate,
      startTime: form.startTime,
      durationHours: form.durationHours,
      groupSize: form.groupSize,
      skillLevel: form.skillLevel,
      locationDetails: form.locationDetails,
      totalPrice,
      note: form.note,
    });

    if (result.error) {
      setStatus({
        saving: false,
        error: result.error === 'auth_required' ? t('profile.booking.loginRequired') : t('profile.booking.submitFailed'),
      });
      return;
    }

    setStatus({ saving: false, error: '' });
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-gnd-dark/70 p-0 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[1.5rem]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gnd-cream px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={coach.avatarUrl || coach.coverPhotoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gnd-red">{t('profile.booking.eyebrow')}</p>
              <h2 className="truncate text-xl font-black">{t('profile.booking.title')}</h2>
              <p className="mt-1 truncate text-sm font-bold text-gnd-gray">{service.title} · {coach.name}</p>
            </div>
          </div>
          <button type="button" className="rounded-full bg-gnd-cream p-2" onClick={onClose} aria-label={t('explore.closePost')}>
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">{t('profile.booking.date')}</p>
                <h3 className="mt-1 text-xl font-black">{t('profile.booking.chooseDate')}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark"
                  onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
                >
                  {t('profile.booking.previousMonth')}
                </button>
                <label className="grid gap-1">
                  <span className="sr-only">{t('profile.booking.monthPicker')}</span>
                  <input
                    type="month"
                    value={visibleMonth.slice(0, 7)}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setVisibleMonth(`${event.target.value}-01`);
                    }}
                    className="min-w-32 rounded-xl border border-gnd-cream bg-white px-3 py-2 text-center text-sm font-black text-gnd-dark outline-none focus:border-gnd-red"
                    aria-label={t('profile.booking.monthPicker')}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-xl bg-gnd-cream px-3 py-2 text-xs font-black text-gnd-dark"
                  onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
                >
                  {t('profile.booking.nextMonth')}
                </button>
                <input
                  type="date"
                  min={today}
                  value={form.lessonDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextSlots = getAvailableStartTimes(coach.availability, coach.bookedSlots, value, form.durationHours);
                    setVisibleMonth(getMonthStart(value));
                    setForm((current) => ({
                      ...current,
                      lessonDate: value,
                      startTime: nextSlots[0] || current.startTime,
                    }));
                  }}
                  className="rounded-xl border border-gnd-cream bg-white px-3 py-2 text-xs font-black outline-none focus:border-gnd-red"
                />
              </div>
            </div>
            <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6">
              <div className="grid min-w-full grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="pb-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-gnd-gray">{day}</div>
                ))}
                {calendarCells.map((option) => option.blank ? (
                  <span key={option.key} aria-hidden="true" />
                ) : (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.isPast}
                  onClick={() => {
                    const nextSlots = getAvailableStartTimes(coach.availability, coach.bookedSlots, option.value, form.durationHours);
                    setForm((current) => ({
                      ...current,
                      lessonDate: option.value,
                      startTime: nextSlots[0] || current.startTime,
                    }));
                  }}
                  className={`min-h-20 rounded-2xl px-2 py-2 text-center transition ${form.lessonDate === option.value ? 'bg-gnd-red text-white shadow-lg shadow-red-900/15' : 'bg-gnd-cream text-gnd-dark'} ${!option.hasAvailability ? 'opacity-60' : ''} ${option.isPast ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-100' : ''}`}
                >
                  <span className="block text-lg font-black">{option.day}</span>
                  <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[0.04em]">
                    {option.availableCount ? formatSlotCount(option.availableCount, t) : t('profile.booking.noSlotsShort')}
                  </span>
                  {option.blockedCount > 0 && <span className="mt-1 block text-[9px] font-black opacity-70">{formatBookedCount(option.blockedCount, t)}</span>}
                </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl bg-gnd-dark p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">{t('profile.booking.time')}</p>
                <h3 className="mt-1 text-xl font-black">{t('profile.booking.chooseStart')}</h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-white/70">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gnd-red" />{t('profile.booking.available')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" />{t('profile.booking.unavailable')}</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {startTimes.length ? startTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => updateField('startTime', time)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black transition ${form.startTime === time ? 'bg-gnd-red text-white' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  {time}
                </button>
              )) : (
                <div className="col-span-full rounded-2xl bg-white/10 px-4 py-4 text-sm font-bold text-white/70">
                  {matchingSlots.length ? t('profile.booking.allTimesBooked') : t('profile.booking.noTimes')}
                </div>
              )}
            </div>
            {blockedSlots.length > 0 && (
              <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/70">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">{t('profile.booking.blockedTimes')}</p>
                <p className="mt-1">{blockedSlots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(' / ')}</p>
              </div>
            )}
            <label className="mt-4 grid gap-2 text-sm font-black text-white">
              {t('profile.booking.customStart')}
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => updateField('startTime', event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:border-gnd-red"
                required
              />
            </label>
          </section>

          <section className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gnd-red">{t('profile.booking.details')}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                {t('profile.booking.groupSize')}
                <select
                  value={form.groupSize}
                  onChange={(event) => updateField('groupSize', Number(event.target.value))}
                  className="rounded-2xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red"
                >
                  {[1, 2, 3, 4].map((size) => <option key={size} value={size}>{size} pax</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black">
                {t('profile.booking.skillLevel')}
                <select
                  value={form.skillLevel}
                  onChange={(event) => updateField('skillLevel', event.target.value)}
                  className="rounded-2xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red"
                >
                  {skillLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black">
                {t('profile.booking.duration')}
                <select
                  value={form.durationHours}
                  onChange={(event) => updateField('durationHours', Number(event.target.value))}
                  className="rounded-2xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red"
                >
                  {[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{formatDurationLabel(hours, t)}</option>)}
                </select>
              </label>

              <div className="rounded-2xl bg-gnd-cream px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-gnd-gray">{t('profile.booking.selectedSlot')}</p>
                <p className="mt-1 text-base font-black">{formatSelectedBookingSlot(form.lessonDate, form.startTime)}</p>
              </div>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-black">
              {t('profile.booking.locationDetails')}
              <input
                type="text"
                value={form.locationDetails}
                onChange={(event) => updateField('locationDetails', event.target.value)}
                className="rounded-2xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold outline-none focus:border-gnd-red"
                placeholder={t('profile.booking.locationPlaceholder')}
              />
            </label>

            <label className="mt-4 grid gap-2 text-sm font-black">
              {t('profile.booking.note')}
              <textarea
                value={form.note}
                onChange={(event) => updateField('note', event.target.value)}
                rows={3}
                className="resize-none rounded-2xl border border-gnd-cream bg-white px-4 py-3 text-sm font-bold leading-6 outline-none focus:border-gnd-red"
                placeholder={t('profile.booking.notePlaceholder')}
              />
            </label>
          </section>

          {status.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-gnd-red">{status.error}</p>}
        </div>

        <footer className="grid gap-3 border-t border-gnd-cream bg-white px-5 py-4 sm:grid-cols-[1fr_1fr_1.3fr] sm:px-6">
          <div className="rounded-2xl bg-gnd-cream px-4 py-3 sm:col-span-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gnd-gray">{t('profile.booking.estimatedTotal')}</p>
            <p className="mt-1 text-2xl font-black">{formatCurrency(totalPrice, service.currency)}</p>
          </div>
          <button type="button" className="rounded-2xl bg-gnd-cream px-5 py-3 text-sm font-black text-gnd-dark" onClick={onClose}>
            {t('profile.booking.cancel')}
          </button>
          <button type="submit" className="rounded-2xl bg-gnd-red px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={status.saving}>
            {status.saving ? t('states.saving') : t('profile.booking.submit')}
          </button>
        </footer>
      </motion.form>
    </div>
  );
}

function ReviewsTab({ coach, t }) {
  const average = Number(coach.rating) || 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="h-fit rounded-2xl bg-gnd-dark p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">{t('profile.reviews.summary')}</p>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-6xl font-black">{average ? average.toFixed(1) : t('explore.newRating')}</span>
          {average > 0 && <Star className="mb-2 fill-current text-gnd-red" size={28} />}
        </div>
        <p className="mt-3 text-sm font-bold text-white/60">{t('profile.reviews.count', { count: coach.stats.reviewCount })}</p>
      </section>

      <section className="grid gap-3">
        {coach.reviews.length ? coach.reviews.map((review) => (
          <article key={review.id} className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black">{review.reviewerName}</h3>
                <p className="mt-1 text-xs font-bold text-gnd-gray">{review.displayDate}</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-gnd-cream px-3 py-1 text-sm font-black text-gnd-red">
                <Star size={15} className="fill-current" />
                {review.rating}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-gnd-gray">{review.comment}</p>
            {(review.skillLevel || review.groupSize) && (
              <p className="mt-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-gnd-gray">
                <Users size={14} />
                {[review.skillLevel, review.groupSize ? `${review.groupSize} pax` : ''].filter(Boolean).join(' / ')}
              </p>
            )}
          </article>
        )) : <EmptyPanel title={t('profile.empty.reviewsTitle')} body={t('profile.empty.reviewsBody')} />}
      </section>
    </div>
  );
}

function EmptyPanel({ title, body }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-lg shadow-red-900/5">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gnd-gray">{body}</p>
    </div>
  );
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getAvailabilityForDate(availability, lessonDate) {
  if (!lessonDate) return [];

  const date = new Date(`${lessonDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return [];

  return availability.filter((slot) => Number(slot.dayOfWeek) === date.getDay());
}

function buildBookingDateOptions(availability, bookedSlots, visibleMonth, durationHours) {
  const today = new Date();
  const firstDay = typeof visibleMonth === 'string' ? new Date(`${visibleMonth}T00:00:00`) : new Date(visibleMonth);
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const value = toDateInputValue(date);
    const dayOfWeek = date.getDay();
    const isPast = value < toDateInputValue(today);
    const weeklySlots = availability.filter((slot) => Number(slot.dayOfWeek) === dayOfWeek);
    const availableCount = isPast ? 0 : getAvailableStartTimes(availability, bookedSlots, value, durationHours).length;
    const blockedCount = getBlockedSlotsForDate(bookedSlots, value).length;

    return {
      value,
      weekday: weekdayLabels[dayOfWeek],
      day: String(date.getDate()).padStart(2, '0'),
      hasAvailability: weeklySlots.length > 0 && availableCount > 0,
      availableCount,
      blockedCount,
      isPast,
    };
  });
}

function buildCalendarCells(dateOptions, visibleMonth) {
  const monthStart = new Date(`${visibleMonth}T00:00:00`);
  const leadingBlanks = monthStart.getDay();
  const blanks = Array.from({ length: leadingBlanks }, (_, index) => ({
    key: `blank-${visibleMonth}-${index}`,
    blank: true,
  }));

  return [...blanks, ...dateOptions];
}

function getMonthStart(value) {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : new Date(value);
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}

function shiftMonth(value, offset) {
  const date = new Date(`${value}T00:00:00`);
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function getSlotStartTimes(slots) {
  const times = new Set();

  slots.forEach((slot) => {
    const start = parseTimeToMinutes(slot.startTime);
    const end = parseTimeToMinutes(slot.endTime);
    if (start === null || end === null || end <= start) return;

    for (let minute = start; minute < end; minute += 60) {
      times.add(formatMinutesAsTime(minute));
    }
  });

  return [...times].sort();
}

function getAvailableStartTimes(availability, bookedSlots, lessonDate, durationHours) {
  const weeklySlots = getAvailabilityForDate(availability, lessonDate);
  const blockedSlots = getBlockedSlotsForDate(bookedSlots, lessonDate);
  const durationMinutes = Math.max(Number(durationHours) || 1, 1) * 60;

  return getSlotStartTimes(weeklySlots).filter((time) => {
    const start = parseTimeToMinutes(time);
    if (start === null) return false;

    const end = start + durationMinutes;
    const containingWindow = weeklySlots.some((slot) => {
      const windowStart = parseTimeToMinutes(slot.startTime);
      const windowEnd = parseTimeToMinutes(slot.endTime);
      return windowStart !== null && windowEnd !== null && start >= windowStart && end <= windowEnd;
    });
    if (!containingWindow) return false;

    return !blockedSlots.some((slot) => rangesOverlap(
      start,
      end,
      parseTimeToMinutes(slot.startTime),
      parseTimeToMinutes(slot.endTime),
    ));
  });
}

function getBlockedSlotsForDate(bookedSlots, lessonDate) {
  return (bookedSlots || []).filter((slot) => {
    if (slot.lessonDate !== lessonDate) return false;
    return ['Pending', 'Confirmed'].includes(slot.status);
  });
}

function rangesOverlap(startA, endA, startB, endB) {
  if (startB === null || endB === null) return false;
  return startA < endB && startB < endA;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatMinutesAsTime(value) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatSelectedBookingSlot(dateValue, timeValue) {
  if (!dateValue || !timeValue) return '';

  const [year, month, day] = dateValue.split('-');
  return `${day}-${month}-${year} ${timeValue}`;
}

function calculateBookingPrice(service, skillLevel, groupSize, durationHours) {
  const pricing = service.pricing.find((row) => row.skillLevel === skillLevel) || service.pricing[0];
  const duration = Math.max(Number(durationHours) || 1, 1);
  if (!pricing) return (Number(service.minPrice) || 0) * duration;

  const key = `price${Math.min(Math.max(Number(groupSize) || 1, 1), 4)}`;
  return (Number(pricing[key]) || Number(service.minPrice) || 0) * duration;
}

function formatDurationLabel(hours, t) {
  return `${hours} ${hours === 1 ? t('profile.booking.hourUnit') : t('profile.booking.hoursUnit')}`;
}

function formatSlotCount(count, t) {
  return `${count} ${count === 1 ? t('profile.booking.slotUnit') : t('profile.booking.slotsUnit')}`;
}

function formatBookedCount(count, t) {
  return `${count} ${t('profile.booking.bookedUnit')}`;
}
