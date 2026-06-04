import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Flag, Heart, MessageCircle, MessageSquare, Bookmark, MapPin, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPostComments, createPostComment } from '../lib/database';

const fallbackImages = [
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80',
];

export default function PostDetailModal({ post, onClose, onLike, onSave, onReport, profilePath, messagePath, t }) {
  const imageUrls = post.imageUrls?.length > 0 ? post.imageUrls : [post.imageUrl || fallbackImages[0]];
  const [imgIndex, setImgIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    async function loadComments() {
      setLoadingComments(true);
      const result = await fetchPostComments(post.id);
      if (result.data) setComments(result.data);
      setLoadingComments(false);
    }
    loadComments();
  }, [post.id]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const result = await createPostComment(post.id, newComment);
    if (result.error) {
      alert(result.error === 'auth_required' ? t('explore.loginRequired') : formatCommentError(result.error));
    } else {
      setNewComment('');
      // Refresh comments
      const updated = await fetchPostComments(post.id);
      if (updated.data) setComments(updated.data);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gnd-dark/80 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.article
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="grid max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl grid-cols-[2fr_1fr] md:grid-cols-[minmax(0,1.2fr)_400px]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Left: Media Area */}
        <div className="relative flex h-full items-center justify-center bg-black border-r border-gnd-cream/10 group">
          <AnimatePresence mode="wait">
            <motion.img 
              key={imgIndex}
              src={imageUrls[imgIndex]} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              alt={post.title} 
              className="h-full max-h-[90vh] w-full object-contain" 
            />
          </AnimatePresence>

          {imageUrls.length > 1 && (
            <>
              <button 
                onClick={() => setImgIndex(prev => (prev > 0 ? prev - 1 : imageUrls.length - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100"
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                onClick={() => setImgIndex(prev => (prev < imageUrls.length - 1 ? prev + 1 : 0))}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100"
              >
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
                {imageUrls.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 w-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-white scale-125' : 'bg-white/40'}`} 
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Interaction Area */}
        <div className="flex flex-col border-l border-gnd-cream bg-white min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-gnd-cream p-2 md:p-4">
            <Link to={profilePath} className="flex min-w-0 items-center gap-1.5 md:gap-3" onClick={onClose}>
              <img src={post.avatarUrl || imageUrls[0]} alt="" className="aspect-square h-6 w-6 rounded-full border border-gnd-cream object-cover md:h-9 md:w-9" />
              <div className="min-w-0">
                <h2 className="truncate text-[10px] md:text-sm font-black text-gnd-dark">{post.coachName}</h2>
                <p className="flex items-center gap-1 truncate text-[8px] md:text-[10px] font-black uppercase tracking-wider text-gnd-gray">
                  {post.location && (
                    <>
                      <MapPin size={8} className="text-gnd-red md:w-[10px] md:h-[10px]" />
                      <span className="truncate">{post.location}</span>
                    </>
                  )}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-full bg-gnd-cream p-1 md:p-1.5 transition hover:bg-gnd-red hover:text-white" onClick={() => onReport?.(buildPostReportTarget(post))} aria-label="Report post">
                <Flag size={14} className="md:w-[18px] md:h-[18px]" />
              </button>
              <button type="button" className="rounded-full bg-gnd-cream p-1 md:p-1.5 transition hover:bg-gnd-red hover:text-white" onClick={onClose} aria-label={t('explore.closePost')}>
                <X size={14} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </header>

          {/* Scrollable Content (Caption + Comments) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-4 md:py-5">
            <div className="flex gap-2 md:gap-3">
              <Link to={profilePath} onClick={onClose} className="shrink-0 hidden sm:block">
                <img src={post.avatarUrl || imageUrls[0]} alt="" className="aspect-square h-7 w-7 rounded-full object-cover md:h-9 md:w-9" />
              </Link>
              <div className="flex-1 space-y-1 text-[11px] md:text-sm leading-relaxed">
                <p className="text-gnd-dark">
                  <Link to={profilePath} className="mr-1 md:mr-2 font-black" onClick={onClose}>{post.coachName}</Link>
                  {post.caption || post.title}
                </p>
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

            {/* Comments List */}
            <div className="mt-4 md:mt-8 space-y-4 md:space-y-6">
              <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-gnd-gray/50">
                Comments ({comments.length})
              </p>
              
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gnd-cream" />
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 md:gap-3">
                    <img src={comment.avatarUrl || fallbackImages[0]} alt="" className="aspect-square h-6 w-6 shrink-0 rounded-full object-cover md:h-8 md:w-8" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] md:text-sm text-gnd-dark leading-relaxed">
                        <span className="font-black mr-2">{comment.userName}</span>
                        {comment.body}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[8px] md:text-[10px] font-bold text-gnd-gray uppercase tracking-wider">{comment.displayDate}</p>
                        <button type="button" onClick={() => onReport?.(buildCommentReportTarget(comment, post))} className="text-[8px] font-black uppercase tracking-widest text-gnd-gray hover:text-gnd-red">Report</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs font-bold text-gnd-gray py-4">No comments yet. Be the first to share your thoughts!</p>
              )}
            </div>
          </div>

          {/* Interaction Section (IG style) */}
          <section className="border-t border-gnd-cream p-2 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <button type="button" className={`transition hover:scale-110 active:scale-90 ${post.liked ? 'text-gnd-red' : 'text-gnd-dark'}`} onClick={onLike}>
                  <Heart size={20} className={`${post.liked ? 'fill-current' : ''} md:w-[26px] md:h-[26px]`} />
                </button>
                <span className="text-[11px] font-black text-gnd-dark md:text-sm">{post.likes}</span>
                <button 
                  type="button" 
                  className="text-gnd-dark transition hover:scale-110"
                  onClick={() => document.getElementById('comment-input')?.focus()}
                >
                  <MessageCircle size={20} className="md:w-[26px] md:h-[26px]" />
                </button>
              </div>
              <button type="button" className={`transition hover:scale-110 active:scale-90 ${post.saved ? 'text-gnd-red' : 'text-gnd-dark'}`} onClick={onSave}>
                <Bookmark size={20} className={`${post.saved ? 'fill-current' : ''} md:w-[26px] md:h-[26px]`} />
              </button>
            </div>
          </section>

          {/* Comment Input Area */}
          <section className="border-t border-gnd-cream p-2 md:p-3">
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input
                id="comment-input"
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-transparent text-[11px] md:text-sm font-bold text-gnd-dark outline-none placeholder:text-gnd-gray/40"
              />
              <button 
                type="submit"
                disabled={!newComment.trim() || submitting}
                className={`text-[11px] md:text-sm font-black uppercase tracking-widest transition ${newComment.trim() && !submitting ? 'text-blue-500' : 'text-gnd-gray/30 cursor-not-allowed'}`}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
              </button>
            </form>
          </section>

          {/* Footer Actions */}
          <footer className="flex flex-col gap-1.5 border-t border-gnd-cream bg-gnd-cream/30 p-2 md:p-4">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={messagePath}
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-gnd-red px-2 py-2 text-[9px] font-black !text-white shadow-lg shadow-red-600/20 transition hover:bg-red-600 active:scale-[0.98] md:gap-2 md:px-4 md:py-3 md:text-xs"
              >
                <MessageSquare size={12} className="!text-white md:h-[16px] md:w-[16px]" />
                {t('explore.messageCta')}
              </Link>
              <Link
                to={`${profilePath}?tab=sessions`}
                onClick={onClose}
                className="flex items-center justify-center rounded-lg bg-gnd-dark px-2 py-2 text-center text-[9px] font-black !text-white transition hover:bg-black active:scale-[0.98] md:px-4 md:py-3 md:text-xs"
              >
                {t('explore.viewSessionsCta')}
              </Link>
            </div>
          </footer>
        </div>
      </motion.article>
    </div>
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

function buildCommentReportTarget(comment, post) {
  return {
    title: 'Report comment',
    targetType: 'comment',
    targetId: comment.id,
    reportedUserId: comment.userId,
    evidenceMetadata: {
      comment_id: comment.id,
      post_id: post.id,
      body: comment.body || '',
      author_name: comment.userName || '',
    },
  };
}

function formatCommentError(error) {
  if (error === 'staff_account_restricted') {
    return 'Staff accounts cannot comment on public posts.';
  }
  if (error === 'account_suspended') {
    return 'Your account is currently read-only. You can still browse and contact GuideNextdoor support.';
  }
  return 'Failed to post comment.';
}
