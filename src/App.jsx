import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomeView from './views/HomeView';
import ExploreView from './views/ExploreView';
import DestinationsView from './views/DestinationsView';
import GuideProfileView from './views/GuideProfileView';
import BecomeGuideView from './views/BecomeGuideView';
import { AnimatePresence } from 'framer-motion';

function LanguageWrapper() {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  const location = useLocation();
  const supportedLangs = ['en', 'zh-HK', 'zh-CN'];
  
  useEffect(() => {
    if (supportedLangs.includes(lang) && i18n.language !== lang) {
      console.log(`Syncing i18n language from URL: ${lang}`);
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  if (!supportedLangs.includes(lang)) {
    return <Navigate to="/en" replace />;
  }

  const pathWithoutLang = location.pathname.replace(`/${lang}`, '') || '/';
  const baseUrl = 'https://guidenextdoor.com'; // Replace with actual production URL

  return (
    <>
      <Helmet>
        <html lang={lang} />
        <link rel="alternate" href={`${baseUrl}/en${pathWithoutLang}`} hreflang="en" />
        <link rel="alternate" href={`${baseUrl}/zh-HK${pathWithoutLang}`} hreflang="zh-HK" />
        <link rel="alternate" href={`${baseUrl}/zh-CN${pathWithoutLang}`} hreflang="zh-CN" />
        <link rel="x-default" href={`${baseUrl}/en${pathWithoutLang}`} />
      </Helmet>
      
      <div className="min-h-screen bg-gnd-cream text-gnd-dark font-sans overflow-x-hidden selection:bg-gnd-red selection:text-white flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<HomeView />} />
                <Route path="/explore" element={<ExploreView />} />
                <Route path="/destinations" element={<DestinationsView />} />
                <Route path="/guide/:id" element={<GuideProfileView />} />
                <Route path="/become-guide" element={<BecomeGuideView />} />
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
  console.log('App Rendering - Path:', window.location.pathname);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/en" replace />} />
        <Route path="/:lang/*" element={<LanguageWrapper />} />
      </Routes>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}} />
    </Router>
  );
}
