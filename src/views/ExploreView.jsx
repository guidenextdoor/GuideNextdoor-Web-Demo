import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bookmark, Flag, Heart, MapPin, MessageCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPosts, togglePostLike, toggleSavedPost } from '../lib/database';
import { buildLoginRedirectPath } from '../lib/navigation';
import AuthActionNotice from '../components/AuthActionNotice';
import PostDetailModal from '../components/PostDetailModal';
import ReportModal from '../components/ReportModal';

const fallbackImages = [
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80',
];

export default function ExploreView() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [postState, setPostState] = useState({ loading: true, data: [], error: null });
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    const nextParams = {};
    if (query) nextParams.q = query;
    setSearchParams(nextParams, { replace: true });
  }, [query, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    fetchPosts().then((result) => {
      if (!cancelled) setPostState({ loading: false, data: result.data, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return postState.data;

    return postState.data.filter((post) => {
      const hashtags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : '';
      const haystack = `${post.title} ${post.caption} ${post.coachName} ${post.location} ${hashtags}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [postState.data, query]);
  const selectedPost = postState.data.find((post) => post.id === selectedPostId);
  const loginPath = buildLoginRedirectPath(i18n.language, location);

  const updatePost = (postId, updater) => {
    setPostState((current) => ({
      ...current,
      data: current.data.map((post) => (post.id === postId ? updater(post) : post)),
    }));
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
      updatePost(post.id, (current) => ({
        ...current,
        liked: true,
        likes: post.likes,
      }));
      return;
    }

    if (result.error) {
      updatePost(post.id, (current) => ({
        ...current,
        liked: post.liked,
        likes: post.likes,
      }));
      setNotice(result.error === 'auth_required'
        ? { message: t('explore.loginRequired'), requiresLogin: true }
        : { message: formatInteractionError(result.error, t) });
    }
  };

  const handleSave = async (post) => {
    const nextSaved = !post.saved;
    updatePost(post.id, (current) => ({ ...current, saved: nextSaved }));

    const result = await toggleSavedPost(post);
    if (result.error) {
      updatePost(post.id, (current) => ({ ...current, saved: post.saved }));
      setNotice(result.error === 'auth_required'
        ? { message: t('explore.loginRequired'), requiresLogin: true }
        : { message: formatInteractionError(result.error, t) });
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12"
    >
      <div className="mx-auto mb-7 max-w-3xl">
        <label className="relative block">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gnd-gray" size={20} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('explore.searchPlaceholder')}
            className="h-14 w-full rounded-2xl bg-white pl-13 pr-5 text-base font-bold shadow-lg shadow-red-900/5 outline-none focus:ring-2 focus:ring-gnd-red/20"
          />
        </label>
      </div>

      {postState.error && (
        <div className="mb-5 rounded-2xl bg-white p-5">
          <h2 className="text-lg font-black text-gnd-red">{t('states.schemaPending')}</h2>
          <p className="mt-2 text-sm leading-6 text-gnd-gray">{t('explore.postWallRlsBody')}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {postState.loading && [1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => <PostSkeleton key={item} />)}
        {!postState.loading && visiblePosts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={index}
            onOpen={() => setSelectedPostId(post.id)}
            onLike={() => handleLike(post)}
            onSave={() => handleSave(post)}
            onReport={() => setReportTarget(buildPostReportTarget(post))}
            profilePath={`/${i18n.language}/guide/${post.authorUsername || post.instructorId}`}
          />
        ))}
      </div>

      {!postState.loading && visiblePosts.length === 0 && (
        <div className="rounded-[2rem] bg-white p-10 text-center">
          <h2 className="text-2xl font-black">{query ? t('explore.noSearchResultsTitle') : t('explore.emptyTitle')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gnd-gray">
            {query ? t('explore.noSearchResultsBody') : t('explore.postWallEmptyBody')}
          </p>
        </div>
      )}

      <AuthActionNotice notice={notice} onDismiss={() => setNotice(null)} loginPath={loginPath} t={t} />

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onLike={() => handleLike(selectedPost)}
          onSave={() => handleSave(selectedPost)}
          onReport={(target) => setReportTarget(target || buildPostReportTarget(selectedPost))}
          profilePath={`/${i18n.language}/guide/${selectedPost.authorUsername || selectedPost.instructorId}`}
          messagePath={selectedPost.authorUsername ? `/${i18n.language}/messages?user=${encodeURIComponent(selectedPost.authorUsername)}` : `/${i18n.language}/messages`}
          t={t}
        />
      )}
      <ReportModal reportTarget={reportTarget} onClose={() => setReportTarget(null)} />
    </motion.section>
  );
}

function PostCard({ post, index, onOpen, onLike, onSave, onReport, profilePath }) {
  const imageUrls = post.imageUrls?.length > 0 ? post.imageUrls : [post.imageUrl || fallbackImages[index % fallbackImages.length]];
  const [imgIndex, setImgIndex] = useState(0);

  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-lg shadow-red-900/5 group">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <button type="button" className="h-full w-full text-left" onClick={onOpen}>
          <AnimatePresence mode="wait">
            <motion.img 
              key={imgIndex}
              src={imageUrls[imgIndex]} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              alt={post.title} 
              className="h-full w-full object-cover" 
            />
          </AnimatePresence>
        </button>

        {imageUrls.length > 1 && (
          <>
            <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[8px] font-black text-white backdrop-blur-sm">
              {imgIndex + 1} / {imageUrls.length}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setImgIndex(prev => (prev > 0 ? prev - 1 : imageUrls.length - 1)); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-gnd-dark shadow-md opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setImgIndex(prev => (prev < imageUrls.length - 1 ? prev + 1 : 0)); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-gnd-dark shadow-md opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Link to={profilePath} className="flex min-w-0 items-center gap-2">
            <img src={post.avatarUrl || imageUrls[0]} alt="" className="h-7 w-7 rounded-full object-cover" />
            <h3 className="truncate text-sm font-black">{post.coachName}</h3>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5 text-gnd-gray">
            <button type="button" className="flex items-center gap-1 transition hover:text-gnd-red" onClick={onLike}>
              <Heart size={14} className={post.liked ? 'fill-gnd-red text-gnd-red' : ''} />
              <span className="text-xs font-bold">{post.likes}</span>
            </button>
            <span className="flex items-center gap-1 text-xs font-bold" aria-label="comments">
              <MessageCircle size={14} />
              {post.comments}
            </span>
            <button type="button" className={`transition hover:text-gnd-red ${post.saved ? 'text-gnd-red' : ''}`} onClick={onSave} aria-label="save post">
              <Bookmark size={14} className={post.saved ? 'fill-current' : ''} />
            </button>
            <button type="button" className="transition hover:text-gnd-red" onClick={onReport} aria-label="report post">
              <Flag size={14} />
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-gnd-gray">
          <div className="flex min-w-0 items-center gap-1">
            {post.location && (
              <>
                <MapPin size={11} />
                <span className="truncate">{post.location}</span>
              </>
            )}
          </div>
          {post.displayDate && <span className="shrink-0">{post.displayDate}</span>}
        </div>

        <button type="button" className="line-clamp-1 w-full text-left text-sm font-bold text-gnd-dark" onClick={onOpen}>
          {post.caption || post.title}
        </button>
      </div>
    </article>
  );
}

function buildPostReportTarget(post) {
  return {
    title: 'Report post',
    targetType: 'post',
    targetId: post.id,
    reportedUserId: post.authorUserId,
    evidenceMetadata: {
      post_id: post.id,
      instructor_id: post.instructorId,
      caption: post.caption || post.title || '',
      author_name: post.coachName || '',
    },
  };
}

function PostSkeleton() {
  return (
    <div className="rounded-[1.5rem] bg-white p-3 shadow-lg shadow-red-900/5">
      <div className="aspect-[4/5] animate-pulse rounded-[1.25rem] bg-gnd-cream" />
      <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-gnd-cream" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-gnd-cream" />
    </div>
  );
}

function formatInteractionError(error, t) {
  if (error === 'staff_account_restricted') {
    return 'Staff accounts cannot like or save public posts.';
  }
  if (error === 'account_suspended') {
    return 'Your account is currently read-only. You can still browse and contact GuideNextdoor support.';
  }
  const errorMsg = typeof error === 'string' ? error : JSON.stringify(error);
  return `${t('explore.interactionFailed')} (${errorMsg})`;
}
