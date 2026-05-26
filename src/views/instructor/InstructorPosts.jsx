import { Image as ImageIcon, Inbox, PlusSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InstructorDashboardLayout from './InstructorDashboardLayout';

export default function InstructorPosts() {
  const { t } = useTranslation();

  return (
    <InstructorDashboardLayout
      eyebrow={t('profile.tabs.posts')}
      title={t('workspace.posts.title')}
      subtitle={t('workspace.posts.subtitle')}
    >
      <div className="flex justify-end">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg bg-gnd-red px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-gnd-dark active:scale-[0.98]"
        >
          <PlusSquare size={20} />
          {t('workspace.posts.createPost')}
        </button>
      </div>

      <div className="grid place-items-center rounded-lg border border-gnd-cream bg-white p-12 shadow-sm sm:p-16">
        <Inbox size={48} className="mb-4 text-gnd-cream" />
        <h2 className="flex items-center gap-2 text-2xl font-black text-gnd-dark">
          <ImageIcon size={24} className="text-gnd-red" />
          {t('workspace.posts.emptyTitle')}
        </h2>
        <p className="mt-2 max-w-sm text-center font-bold text-gnd-gray">{t('workspace.posts.emptyBody')}</p>
      </div>
    </InstructorDashboardLayout>
  );
}
