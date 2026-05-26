import { useEffect, useState } from 'react';
import { Image as ImageIcon, Inbox, PlusSquare, MapPin, Heart, MessageCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchInstructorSchedule } from '../../lib/database';
import InstructorDashboardLayout from './InstructorDashboardLayout';
import CreatePostModal from '../../components/CreatePostModal';

export default function InstructorPosts() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: [], error: null });
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function loadPosts() {
    setState(prev => ({ ...prev, loading: true }));
    const result = await fetchInstructorSchedule();
    setState({
      loading: false,
      data: result.data?.posts || [],
      error: result.error
    });
  }

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <InstructorDashboardLayout
      eyebrow={t('profile.tabs.posts')}
      title={t('workspace.posts.title')}
      subtitle={t('workspace.posts.subtitle')}
    >
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-6 py-3 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98]"
        >
          <PlusSquare size={20} />
          {t('workspace.posts.createPost')}
        </button>
      </div>

      {state.loading ? (
        <div className="grid h-64 place-items-center rounded-lg border border-gnd-cream bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gnd-cream border-t-gnd-red" />
            <p className="text-sm font-black text-gnd-gray uppercase tracking-widest">{t('states.loading')}</p>
          </div>
        </div>
      ) : state.data.length === 0 ? (
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
          {state.data.map((post) => (
            <InstructorPostCard key={post.id} post={post} />
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
    </InstructorDashboardLayout>
  );
}

function InstructorPostCard({ post }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-gnd-cream bg-white shadow-sm transition-all hover:shadow-md">
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
            Published
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
