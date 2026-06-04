import { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomeView from './views/HomeView';
import ExploreView from './views/ExploreView';
import DestinationsView from './views/DestinationsView';
import SearchView from './views/SearchView';
import GuideProfileView from './views/GuideProfileView';
import BecomeGuideView from './views/BecomeGuideView';
import LoginView from './views/LoginView';
import MessagesView from './views/MessagesView';
import AccountProfileView from './views/AccountProfileView';
import DashboardView from './views/instructor/DashboardView';
import InstructorOverview from './views/instructor/InstructorOverview';
import InstructorMessages from './views/instructor/InstructorMessages';
import InstructorSchedule from './views/instructor/InstructorSchedule';
import InstructorPosts from './views/instructor/InstructorPosts';
import InstructorAbout from './views/instructor/InstructorAbout';
import StaffDashboardView from './views/staff/StaffDashboardView';

const supportedLangs = ['en'];

function LanguageWrapper() {
  const { lang } = useParams();
  const { i18n, t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (supportedLangs.includes(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  if (!supportedLangs.includes(lang)) {
    return <Navigate to="/en" replace />;
  }

  return (
    <>
      <Helmet>
        <html lang={lang} />
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
      </Helmet>
      <div className="flex min-h-screen flex-col bg-gnd-cream font-sans text-gnd-dark selection:bg-gnd-red selection:text-white">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={<div className="grid min-h-[60vh] place-items-center">{t('states.loading')}</div>}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<HomeView />} />
                <Route path="/explore" element={<ExploreView />} />
                <Route path="/sessions" element={<SearchView />} />
                <Route path="/search" element={<Navigate to={`/${lang}/sessions`} replace />} />
                <Route path="/destinations" element={<DestinationsView />} />
                <Route path="/guide/:id" element={<GuideProfileView />} />
                <Route path="/become-guide" element={<BecomeGuideView />} />
                <Route path="/login" element={<LoginView />} />
                <Route path="/profile" element={<AccountProfileView />} />
                <Route path="/messages" element={<MessagesView />} />
                <Route path="/staff/login" element={<LoginView staffPortal />} />
                <Route path="/staff" element={<StaffDashboardView />} />
                
                {/* Instructor Dashboard */}
                <Route path="/instructor" element={<DashboardView />}>
                  <Route index element={<InstructorOverview />} />
                  <Route path="bookings" element={<Navigate to={`/${lang}/instructor/schedule`} replace />} />
                  <Route path="messages" element={<InstructorMessages />} />
                  <Route path="services" element={<Navigate to={`/${lang}/instructor/schedule`} replace />} />
                  <Route path="schedule" element={<InstructorSchedule />} />
                  <Route path="posts" element={<InstructorPosts />} />
                  <Route path="profile" element={<InstructorAbout />} />
                </Route>
              </Routes>
            </AnimatePresence>
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/en" replace />} />
        <Route path="/:lang/*" element={<LanguageWrapper />} />
      </Routes>
    </Router>
  );
}
