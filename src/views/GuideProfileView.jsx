import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Award,
  Bookmark,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Image as ImageIcon,
  Languages,
  MapPin,
  MessageCircle,
  MessageSquare,
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, coach: null, error: null });
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabs.includes(requestedTab) ? requestedTab : 'posts');
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedCert, setSelectedCert] = useState(null);
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
    if (!tabs.includes(requestedTab)) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveTab(requestedTab);
    });
    return () => {
      cancelled = true;
    };
  }, [requestedTab]);

  useEffect(() => {
    if (state.loading || requestedTab !== 'sessions') return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setShouldScrollToSessions(true);
    });
    return () => {
      cancelled = true;
    };
  }, [requestedTab, state.loading]);

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
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : `${t('explore.interactionFailed')} (${errorMsg})`);
    }
  };

  const handleSave = async (post) => {
    const nextSaved = !post.saved;
    updatePost(post.id, (current) => ({ ...current, saved: nextSaved }));

    const result = await toggleSavedPost(post);
    if (result.error) {
      updatePost(post.id, () => post);
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : `${t('explore.interactionFailed')} (${errorMsg})`);
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
                </div>

                <div className="min-w-0 pb-1">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-gnd-red">{t('profile.eyebrow')}</p>
                  <div className="mt-2 flex max-w-3xl flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">{coach.name}</h1>
                    {coach.verified && (
                      <span className="inline-flex items-center gap-1 text-sm font-black text-gnd-red sm:text-base">
                        <CheckCircle2 size={16} className="shrink-0" />
                        {t('profile.verified')}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-gnd-gray">
                    {coach.stats.reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-gnd-dark">
                        <Star size={15} className="fill-current text-gnd-red" />
                        {Number(coach.stats.averageRating || 0).toFixed(1)}
                        <span className="font-medium text-gnd-gray">({coach.stats.reviewCount})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gnd-red/10 px-2.5 py-0.5 text-xs font-black text-gnd-red">
                        <Star size={12} className="fill-current" />
                        {t('profile.newJoin')}
                      </span>
                    )}
                    {coach.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={15} className="text-gnd-red" />
                        {coach.location}
                      </span>
                    )}
                    {coach.languages?.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Languages size={15} className="text-gnd-red" />
                        {coach.languages.map(l => l.nativeName).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[1.25rem] bg-white p-3 shadow-xl shadow-red-900/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-36 lg:justify-self-end">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={t('profile.stats.likes')} value={coach.stats.totalLikes} />
                <Stat label={t('profile.stats.services')} value={coach.stats.serviceCount} />
                <Stat label={t('profile.stats.sessions')} value={coach.stats.sessionCount} />
                <Stat label={t('profile.stats.years')} value={coach.stats.maxYears ? `${coach.stats.maxYears}+` : t('explore.newRating')} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link to={coach.username ? `/${i18n.language}/messages?user=${encodeURIComponent(coach.username)}` : `/${i18n.language}/messages`} className="flex items-center justify-center gap-2 rounded-xl bg-gnd-cream px-4 py-2.5 text-xs font-black text-gnd-dark">
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

      <nav ref={sessionsSectionRef} className="sticky top-16 z-30 mt-6 scroll-mt-20 overflow-x-auto rounded-2xl bg-white/95 px-2 shadow-lg shadow-red-900/5 backdrop-blur">
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

      <div className="mt-6">
       {activeTab === 'posts' && <PostsTab coach={coach} t={t} onOpenPost={setSelectedPostId} />}
       {activeTab === 'credentials' && <CredentialsTab coach={coach} t={t} onViewCert={setSelectedCert} />}
       {activeTab === 'sessions' && <SessionsTab coach={coach} t={t} onRequestSession={setBookingServiceId} />}
       {activeTab === 'reviews' && <ReviewsTab coach={coach} t={t} />}
      </div>

      {notice && (
       <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-gnd-dark px-5 py-3 text-sm font-bold text-white shadow-2xl">
         {notice}
         <button type="button" className="ml-3 text-white/70" onClick={() => setNotice('')}>{t('explore.dismiss')}</button>
       </div>
      )}

      {selectedCert && (
       <CertificateModal
         cert={selectedCert}
         onClose={() => setSelectedCert(null)}
       />
      )}

      {selectedPost && (        <ProfilePostModal
          post={selectedPost}
          coach={coach}
          onClose={() => setSelectedPostId(null)}
          onLike={() => handleLike(selectedPost)}
          onSave={() => handleSave(selectedPost)}
          onViewSessions={() => {
            setSelectedPostId(null);
            showSessions();
          }}
          messagePath={coach.username ? `/${i18n.language}/messages?user=${encodeURIComponent(coach.username)}` : `/${i18n.language}/messages`}
          t={t}
        />
      )}

      {bookingService && (
        <BookingRequestModal
          coach={coach}
          service={bookingService}
          onClose={() => setBookingServiceId(null)}
          onSubmitted={(submission) => {
            setBookingServiceId(null);
            setNotice(t('profile.booking.success'));
            const messageTarget = submission?.messageTarget || coach.username;
            navigate(messageTarget ? `/${i18n.language}/messages?user=${encodeURIComponent(messageTarget)}` : `/${i18n.language}/messages`);
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
              <span className="flex items-center gap-1">
                <Heart size={14} className={post.liked ? 'fill-current text-gnd-red' : ''} />
                {post.likes}
              </span>
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
  const imageUrl = post.imageUrl;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gnd-dark/80 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.article
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="grid max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl grid-cols-[2fr_1fr] md:grid-cols-[minmax(0,1.2fr)_400px]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Left: Media Area */}
        <div className="flex h-full items-center justify-center bg-black border-r border-gnd-cream/10">
          {imageUrl ? (
            <img src={imageUrl} alt={post.title} className="h-full max-h-[90vh] w-full object-contain" />
          ) : (
            <div className="grid h-[60vh] place-items-center text-white/50">
              <Camera size={44} />
            </div>
          )}
        </div>

        {/* Right: Interaction Area */}
        <div className="flex flex-col border-l border-gnd-cream bg-white min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-gnd-cream p-2 md:p-4">
            <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
              <img src={coach.avatarUrl || imageUrl} alt="" className="h-6 w-6 md:h-9 md:h-9 rounded-full border border-gnd-cream object-cover" />
              <div className="min-w-0">
                <h2 className="truncate text-[10px] md:text-sm font-black text-gnd-dark">{coach.name}</h2>
                <p className="flex items-center gap-1 truncate text-[8px] md:text-[10px] font-black uppercase tracking-wider text-gnd-gray">
                  {post.location || coach.location ? (
                    <>
                      <MapPin size={8} className="text-gnd-red md:w-[10px] md:h-[10px]" />
                      <span className="truncate">{post.location || coach.location}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <button type="button" className="rounded-full bg-gnd-cream p-1 md:p-1.5 transition hover:bg-gnd-red hover:text-white" onClick={onClose} aria-label={t('explore.closePost')}>
              <X size={14} className="md:w-[18px] md:h-[18px]" />
            </button>
          </header>

          {/* Scrollable Content (Caption + Comments) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-4 md:py-5">
            <div className="flex gap-2 md:gap-3">
              <div className="shrink-0 hidden sm:block">
                <img src={coach.avatarUrl || imageUrl} alt="" className="h-7 w-7 md:h-9 md:h-9 rounded-full object-cover" />
              </div>
              <div className="flex-1 space-y-1 text-[11px] md:text-sm leading-relaxed">
                <div className="text-gnd-dark">
                  <span className="mr-1 md:mr-2 font-black">{coach.name}</span>
                  {post.caption || post.title}
                </div>
                {post.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5 md:pt-1">
                    {post.hashtags.map((tag) => (
                      <span key={tag} className="text-[9px] md:text-xs font-bold text-blue-600 hover:underline cursor-pointer">#{tag}</span>
                    ))}
                  </div>
                )}
                <p className="pt-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gnd-gray">
                  {post.displayDate}
                </p>
              </div>
            </div>

            {/* Placeholder for real comments */}
            <div className="mt-4 md:mt-8 space-y-3 md:space-y-4">
              <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-gnd-gray/50">{t('profile.tabs.reviews')}</p>
              <div className="flex gap-2 md:gap-3 opacity-40">
                <div className="h-5 w-5 md:h-8 md:w-8 rounded-full bg-gnd-cream shrink-0" />
                <div className="space-y-1.5 flex-1 pt-0.5 md:pt-1">
                  <div className="h-1 md:h-2 w-12 md:w-24 bg-gnd-cream rounded" />
                  <div className="h-1 md:h-2 w-full bg-gnd-cream rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Interaction Section (IG style) */}
          <section className="border-t border-gnd-cream p-2 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <button type="button" className={`transition hover:scale-110 active:scale-90 ${post.liked ? 'text-gnd-red' : 'text-gnd-dark'}`} onClick={onLike}>
                  <Heart size={20} className={`${post.liked ? 'fill-current' : ''} md:w-[26px] md:h-[26px]`} />
                </button>
                <button type="button" className="text-gnd-dark transition hover:scale-110">
                  <MessageCircle size={20} className="md:w-[26px] md:h-[26px]" />
                </button>
              </div>
              <button type="button" className={`transition hover:scale-110 active:scale-90 ${post.saved ? 'text-gnd-red' : 'text-gnd-dark'}`} onClick={onSave}>
                <Bookmark size={20} className={`${post.saved ? 'fill-current' : ''} md:w-[26px] md:h-[26px]`} />
              </button>
            </div>
            
            <div className="mt-1.5 md:mt-3">
              <p className="text-[11px] md:text-sm font-black text-gnd-dark">{post.likes} {t('home.metrics.likes') || 'likes'}</p>
            </div>
          </section>

          {/* Footer Actions */}
          <footer className="flex flex-col gap-1.5 border-t border-gnd-cream bg-gnd-cream/30 p-2 md:p-4">
            <Link to={messagePath} className="flex items-center justify-center gap-1.5 md:gap-2 rounded-lg bg-gnd-red px-2 py-2 md:px-4 md:py-3 text-[9px] md:text-xs font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-600 active:scale-[0.98]">
              <MessageSquare size={12} className="md:w-[16px] md:h-[16px]" />
              {t('explore.messageCta')}
            </Link>
            <button type="button" className="rounded-lg bg-gnd-dark px-2 py-2 md:px-4 md:py-3 text-[9px] md:text-xs font-black text-white transition hover:bg-black active:scale-[0.98]" onClick={onViewSessions}>
              {t('explore.viewSessionsCta')}
            </button>
          </footer>
        </div>
      </motion.article>
    </div>
  );
}

function CredentialsTab({ coach, t, onViewCert }) {
  // Group qualifications by activity
  const grouped = (coach.qualifications || []).reduce((acc, qual) => {
    const activityKey = qual.activityKey || qual.title;
    if (!acc[activityKey]) {
      acc[activityKey] = {
        title: qual.title,
        iconName: qual.iconName,
        items: []
      };
    }
    acc[activityKey].items.push(qual);
    return acc;
  }, {});

  const groups = Object.values(grouped).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {groups.length ? groups.map((group) => (
        <section key={group.title} className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gnd-cream text-gnd-red">
              <Award size={22} />
            </div>
            <h2 className="text-xl font-black">{group.title}</h2>
          </div>
          <div className="mt-6 grid gap-4">
            {group.items.sort((a, b) => (a.attainmentYear || 0) - (b.attainmentYear || 0)).map((qual) => (
              <button
                key={qual.id}
                type="button"
                className="group relative w-full rounded-2xl border border-gnd-cream p-5 text-left transition hover:border-gnd-red/20 hover:bg-gnd-cream/5"
                onClick={() => onViewCert(qual)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gnd-dark group-hover:text-gnd-red transition-colors">{qual.qualification || t('profile.credentials.noQualification')}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gnd-red">
                      <ImageIcon size={12} />
                      {t('profile.viewCertificate')}
                    </div>
                  </div>
                  {qual.attainmentYear && (
                    <span className="shrink-0 rounded-full bg-gnd-cream px-3 py-1 text-xs font-black text-gnd-red">
                      {qual.attainmentYear}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )) : (
        <section className="rounded-2xl bg-white p-5 shadow-lg shadow-red-900/5 sm:p-8 text-center">
          <p className="text-sm text-gnd-gray">{t('profile.empty.credentialsBody')}</p>
        </section>
      )}
    </div>
  );
}

function CertificateModal({ cert, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-gnd-dark/90 p-4 backdrop-blur-sm md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-gnd-cream px-6 py-4">
          <div>
            <h2 className="text-lg font-black leading-tight text-gnd-dark">{cert.qualification}</h2>
            <p className="text-xs font-bold text-gnd-gray">{cert.title} • {cert.attainmentYear}</p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-gnd-cream text-gnd-dark transition hover:bg-gnd-red hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto bg-gnd-cream/50 p-2 sm:p-6 md:p-10">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-lg">
            <img
              src={cert.certificateUrl || 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&q=80&w=1200'}
              alt={cert.qualification}
              className="h-auto w-full"
            />
          </div>
        </div>

        <footer className="border-t border-gnd-cream bg-white px-6 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-gnd-gray/60">
            Official GuideNextdoor Verified Credential
          </p>
        </footer>
      </motion.div>
    </div>
  );
}

function SessionsTab({ coach, t, onRequestSession }) {
  if (!coach.services.length) return <EmptyPanel title={t('profile.empty.sessionsTitle')} body={t('profile.empty.sessionsBody')} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {coach.services.map((service) => (
        <article key={service.id} className="group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:shadow-xl hover:shadow-red-900/5 border border-gnd-cream/30">
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {service.qualification && (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-600 border border-blue-100">
                      {t('profile.tabs.credentials')}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-black tracking-tight text-gnd-dark group-hover:text-gnd-red transition-colors truncate">{service.title}</h2>
                  {service.locations.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 text-[10px] font-black text-gnd-gray/60 uppercase tracking-widest bg-gnd-cream/30 px-2 py-0.5 rounded-md">
                      <MapPin size={10} className="text-gnd-red" />
                      {service.locations[0].name}
                      {service.locations.length > 1 && <span>+{service.locations.length - 1}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gnd-gray">
              {service.description || t('profile.sessions.descriptionPending')}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-gnd-cream/40 pt-4">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gnd-gray/50">{t('profile.sessions.from')}</p>
                <p className="text-lg font-black text-gnd-dark leading-none">
                  {service.minPrice ? formatCurrency(service.minPrice, service.currency) : t('profile.sessions.pricePending')}
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gnd-gray/50">{t('profile.booking.duration')}</p>
                <div className="flex items-center justify-end gap-1 text-xs font-black text-gnd-dark">
                  <Clock size={12} className="text-gnd-red" />
                  {t('profile.sessions.requestBased')}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <button
              type="button"
              className="group/btn relative flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gnd-red py-3 text-xs font-black text-white shadow-md shadow-red-600/10 transition-all hover:bg-gnd-dark active:scale-[0.98]"
              onClick={() => onRequestSession(service.id)}
            >
              <CheckCircle2 size={14} />
              {t('profile.bookAction')}
              <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function BookingRequestModal({ coach, service, onClose, onSubmitted, t }) {
  const timeSectionRef = useRef(null);
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

  const scrollToStartTimes = () => {
    window.requestAnimationFrame(() => {
      timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '' });

    if (!form.lessonDate || !form.startTime || !form.skillLevel) {
      setStatus({ saving: false, error: t('profile.booking.validationError') });
      return;
    }

    let result;
    try {
      result = await submitBookingRequest({
        serviceId: service.id,
        lessonDate: form.lessonDate,
        startTime: form.startTime,
        durationHours: form.durationHours,
        groupSize: form.groupSize,
        skillLevel: form.skillLevel,
        locationDetails: form.locationDetails,
        totalPrice,
        currency: service.currency,
        serviceTitle: service.title,
        coachName: coach.name,
        note: form.note,
      });
    } catch (error) {
      setStatus({ saving: false, error: error.message || t('profile.booking.submitFailed') });
      return;
    }

    if (result.error) {
      setStatus({
        saving: false,
        error: result.error === 'auth_required'
          ? t('profile.booking.loginRequired')
          : `${t('profile.booking.submitFailed')} ${formatTechnicalError(result.error)}`,
      });
      return;
    }

    setStatus({ saving: false, error: '' });
    onSubmitted(result.data);
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
                      startTime: nextSlots[0] || '',
                    }));
                    if (nextSlots.length) scrollToStartTimes();
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
                      startTime: nextSlots[0] || '',
                    }));
                    if (nextSlots.length) scrollToStartTimes();
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

          <section ref={timeSectionRef} className="mt-6 scroll-mt-4 rounded-2xl bg-gnd-dark p-5 text-white">
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
                  onChange={(event) => {
                    const durationHours = Number(event.target.value);
                    const nextSlots = getAvailableStartTimes(coach.availability, coach.bookedSlots, form.lessonDate, durationHours);
                    setForm((current) => ({
                      ...current,
                      durationHours,
                      startTime: nextSlots.includes(current.startTime) ? current.startTime : (nextSlots[0] || ''),
                    }));
                  }}
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
  const average = Number(coach.stats.averageRating) || 0;

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

function formatTechnicalError(error) {
  const text = String(error || '').trim();
  if (!text) return '';

  try {
    const parsed = JSON.parse(text);
    return `(${parsed.message || parsed.error || text})`;
  } catch {
    return `(${text.slice(0, 180)})`;
  }
}

function formatCurrency(value, currency) {
  const code = currency || 'USD';
  const amount = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
  return `${code} ${amount}`;
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

  const basePrice = Number(pricing.price1) || Number(service.minPrice) || 0;
  const extraFee = Number(pricing.extraPersonFee) || 0;
  const additionalPeople = Math.max(0, (Number(groupSize) || 1) - 1);
  
  return (basePrice + (extraFee * additionalPeople)) * duration;
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
