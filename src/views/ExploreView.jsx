import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Heart, MapPin, MessageCircle, MessageSquare, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchPosts, togglePostLike, toggleSavedPost } from '../lib/database';

const fallbackImages = [
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80',
];

export default function ExploreView() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [postState, setPostState] = useState({ loading: true, data: [], error: null });
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [notice, setNotice] = useState('');

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
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : t('explore.interactionFailed'));
    }
  };

  const handleSave = async (post) => {
    const nextSaved = !post.saved;
    updatePost(post.id, (current) => ({ ...current, saved: nextSaved }));

    const result = await toggleSavedPost(post);
    if (result.error) {
      updatePost(post.id, (current) => ({ ...current, saved: post.saved }));
      setNotice(result.error === 'auth_required' ? t('explore.loginRequired') : t('explore.interactionFailed'));
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
            profilePath={`/${i18n.language}/guide/${post.instructorId}`}
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

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-gnd-dark px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {notice}
          <button type="button" className="ml-3 text-white/70" onClick={() => setNotice('')}>{t('explore.dismiss')}</button>
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onLike={() => handleLike(selectedPost)}
          onSave={() => handleSave(selectedPost)}
          profilePath={`/${i18n.language}/guide/${selectedPost.instructorId}`}
          t={t}
        />
      )}
    </motion.section>
  );
}

function PostCard({ post, index, onOpen, onLike, onSave, profilePath }) {
  const imageUrl = post.imageUrl || fallbackImages[index % fallbackImages.length];

  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-lg shadow-red-900/5">
      <button type="button" className="relative block w-full text-left" onClick={onOpen}>
        <img src={imageUrl} alt={post.title} className="aspect-[4/5] w-full object-cover" />
      </button>
      <div className="p-3">
        <Link to={profilePath} className="mb-2 flex w-full items-center gap-2 text-left">
          <img src={post.avatarUrl || imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-black">{post.coachName}</h3>
            <p className="mt-0.5 flex h-4 items-center gap-1 truncate text-xs font-bold text-gnd-gray">
              {post.location && (
                <>
                  <MapPin size={12} />
                  <span className="truncate">{post.location}</span>
                </>
              )}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" className="line-clamp-1 flex-1 text-left text-sm font-semibold leading-5 text-gnd-dark" onClick={onOpen}>
            {post.caption || post.title}
          </button>
          {post.displayDate && <span className="shrink-0 text-xs font-black text-gnd-gray">{post.displayDate}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between text-gnd-gray">
          <button type="button" className={`flex items-center gap-1 text-sm font-black ${post.liked ? 'text-gnd-red' : ''}`} onClick={onLike}>
            <Heart size={17} className={post.liked ? 'fill-current' : 'text-gnd-red'} />
            {post.likes}
          </button>
          <span className="flex items-center gap-1 text-sm font-black" aria-label="comments">
            <MessageCircle size={17} />
            {post.comments}
          </span>
          <button type="button" className={post.saved ? 'text-gnd-red' : ''} onClick={onSave} aria-label="save post">
            <Bookmark size={17} className={post.saved ? 'fill-current' : ''} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, onLike, onSave, profilePath, t }) {
  const imageUrl = post.imageUrl || fallbackImages[0];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gnd-dark/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.article
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl md:grid-cols-[minmax(0,1.1fr)_390px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-black">
          <img src={imageUrl} alt={post.title} className="h-full max-h-[92vh] w-full object-contain md:object-cover" />
        </div>

        <div className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 p-4">
            <Link to={profilePath} className="flex min-w-0 items-center gap-3" onClick={onClose}>
              <img src={post.avatarUrl || imageUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{post.coachName}</h2>
                <p className="mt-0.5 flex h-4 items-center gap-1 truncate text-xs font-bold text-gnd-gray">
                  {post.location && (
                    <>
                      <MapPin size={12} />
                      <span className="truncate">{post.location}</span>
                    </>
                  )}
                </p>
              </div>
            </Link>
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
            <button type="button" className="flex items-center justify-center gap-2 rounded-2xl bg-gnd-red px-5 py-3 text-sm font-black text-white">
              <MessageSquare size={18} />
              {t('explore.messageCta')}
            </button>
            <button type="button" className="rounded-2xl bg-gnd-dark px-5 py-3 text-sm font-black text-white">
              {t('explore.viewSessionsCta')}
            </button>
          </footer>
        </div>
      </motion.article>
    </div>
  );
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
