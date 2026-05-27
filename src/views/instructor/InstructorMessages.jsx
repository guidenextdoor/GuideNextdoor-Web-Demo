import { useTranslation } from 'react-i18next';
import ChatRoom from '../../components/ChatRoom';
import InstructorDashboardLayout from './InstructorDashboardLayout';

export default function InstructorMessages() {
  const { t } = useTranslation();

  return (
    <InstructorDashboardLayout
      eyebrow={t('workspace.messages.eyebrow')}
      title={t('workspace.messages.title')}
      subtitle={t('workspace.messages.subtitle')}
    >
      <ChatRoom />
    </InstructorDashboardLayout>
  );
}
