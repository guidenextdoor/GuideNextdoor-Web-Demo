import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Image as ImageIcon, Inbox, PlusSquare, MapPin, Heart, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchInstructorSchedule, togglePostLike, toggleSavedPost } from '../../lib/database';
import { buildLoginRedirectPath } from '../../lib/navigation';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import AuthActionNotice from '../../components/AuthActionNotice';
import CreatePostModal from '../../components/CreatePostModal';
import PostDetailModal from '../../components/PostDetailModal';

export default function InstructorPosts() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [notice, setNotice] = useState(null);

  async function loadPosts() {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchInstructorSchedule();
    setState({
      loading: false,
      data: result.data || null,
      error: result.error
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetchInstructorSchedule().then((result) => {
      if (cancelled) return;
      setState({
        loading: false,
        data: result.data || null,
        error: result.error
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const posts = state.data?.posts || [];
  const coach = state.data?.coach || {};
  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const loginPath = buildLoginRedirectPath(i18n.language, location);

  const selectedPost = posts.find((p) => p.id === selectedPostId);

  const updatePost = (postId, updater) => {
    setState((current) => {
      if (!current.data) return current;
      return {
        ...current,
        data: {
          ...current.data,
          posts: current.data.posts.map((post) => (post.id === postId ? updater(post) : post)),
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
        : { message: formatInteractionError(result.error) });
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
        : { message: formatInteractionError(result.error) });
    }
  };

  return (
    <InstructorDashboardLayout
      eyebrow={t('profile.tabs.posts')}
      title={t('workspace.posts.title')}
      subtitle={t('workspace.posts.subtitle')}
    >
      <section className="mb-6 rounded-xl border border-gnd-cream bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-gnd-cream/20 px-4 py-2 border border-gnd-cream/50">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-gnd-gray leading-none">{t('workspace.posts.published') || 'Published'}</span>
                <span className="text-lg font-black text-gnd-dark mt-1">{totalPosts}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gnd-red">
                <ImageIcon size={14} />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-gnd-cream/20 px-4 py-2 border border-gnd-cream/50">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-gnd-gray leading-none">{t('explore.likes') || 'Total Likes'}</span>
                <span className="text-lg font-black text-gnd-dark mt-1">{totalLikes}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gnd-red">
                <Heart size={14} className="fill-current" />
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-xs font-black text-white shadow-lg shadow-red-600/15 transition-all hover:bg-gnd-dark active:scale-[0.98]"
          >
            <PlusSquare size={16} />
            {t('workspace.posts.createPost')}
          </button>
        </div>
      </section>

      {state.loading ? (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
            <p className="text-sm font-black text-gnd-gray uppercase tracking-widest">{t('states.loading')}</p>
          </div>
        </div>
      ) : state.error ? (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="flex flex-col items-center gap-2 text-center p-6">
            <div className="rounded-full bg-red-50 p-3 text-gnd-red">
              <PlusSquare size={24} className="rotate-45" />
            </div>
            <h3 className="text-lg font-black text-gnd-dark mt-2">{t('states.error') || 'Error loading posts'}</h3>
            <p className="text-sm font-bold text-gnd-gray max-w-xs">{state.error}</p>
            <button 
              onClick={loadPosts}
              className="mt-4 text-xs font-black text-gnd-red uppercase tracking-widest hover:underline"
            >
              {t('actions.retry') || 'Retry'}
            </button>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-gnd-cream bg-white p-12 shadow-sm sm:p-16">
          <Inbox size={48} className="mb-4 text-gnd-cream" />
          <h2 className="flex items-center gap-2 text-2xl font-black text-gnd-dark">
            <ImageIcon size={24} className="text-gnd-red" />
            {t('workspace.posts.emptyTitle')}
          </h2>
          <p className="mt-2 max-w-sm text-center font-bold text-gnd-gray">{t('workspace.posts.emptyBody')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <InstructorPostCard 
              key={post.id} 
              post={post} 
              t={t} 
              onOpen={() => setSelectedPostId(post.id)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePostModal 
          onClose={() => setShowCreateModal(false)} 
          onPostCreated={loadPosts}
          t={t}
        />
      )}

      {selectedPost && (
        <PostDetailModal
          post={{
            ...selectedPost,
            // Ensure coach data is present for the modal
            coachName: coach.nickname || coach.displayName || 'Me',
            avatarUrl: coach.avatarUrl || selectedPost.avatarUrl,
          }}
          onClose={() => setSelectedPostId(null)}
          onLike={() => handleLike(selectedPost)}
          onSave={() => handleSave(selectedPost)}
          profilePath={`/${i18n.language}/guide/${coach.username || coach.id}`}
          messagePath={`/${i18n.language}/messages`}
          t={t}
        />
      )}

      <AuthActionNotice notice={notice} onDismiss={() => setNotice(null)} loginPath={loginPath} t={t} />
    </InstructorDashboardLayout>
  );
}

function InstructorPostCard({ post, t, onOpen }) {
  return (
    <article 
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-xl border border-gnd-cream bg-white shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gnd-cream">
        <img 
          src={post.imageUrl} 
          alt={post.title} 
          className="h-full w-full object-cover transition-transform group-hover:scale-105" 
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center gap-1.5">
              <Heart size={16} className="fill-current" />
              <span className="text-xs font-black">{post.likes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle size={16} className="fill-current" />
              <span className="text-xs font-black">{post.comments}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black text-gnd-gray/50 uppercase tracking-widest">
            {post.displayDate}
          </span>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-black uppercase text-green-600 border border-green-100">
            {t('workspace.posts.published') || 'Published'}
          </span>
        </div>
        <p className="line-clamp-2 text-sm font-bold text-gnd-dark leading-relaxed">
          {post.caption}
        </p>
        {post.location && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-gnd-gray uppercase tracking-widest">
            <MapPin size={12} className="text-gnd-red" />
            {post.location}
          </div>
        )}
      </div>
    </article>
  );
}

function formatInteractionError(error) {
  if (error === 'staff_account_restricted') {
    return 'Staff accounts cannot like or save public posts.';
  }
  return 'Interaction failed.';
}
