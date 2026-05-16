import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Globe, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLanguageChange = (newLang) => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const supportedLangs = ['en', 'zh-HK', 'zh-CN'];
    
    // Check if the first segment is a supported language
    if (supportedLangs.includes(pathSegments[0])) {
      pathSegments[0] = newLang;
    } else {
      // If no language prefix found, prepend the new one
      pathSegments.unshift(newLang);
    }
    
    const newPath = `/${pathSegments.join('/')}`;
    console.log(`Navigating from ${location.pathname} to ${newPath}`);
    navigate(newPath);
  };

  return (
    <>
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled || location.pathname !== `/${i18n.language}` ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
          {/* Logo */}
          <Link to={`/${i18n.language}`} className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-gnd-red flex items-center justify-center text-white group-hover:scale-105 transition-transform">
              <MapPin size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gnd-dark">GuideNextdoor</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-gnd-gray">
            <Link to={`/${i18n.language}/explore`} className="hover:text-gnd-red transition-colors">{t('nav.explore')}</Link>
            <Link to={`/${i18n.language}/destinations`} className="hover:text-gnd-red transition-colors">{t('nav.destinations')}</Link>
            <Link to={`/${i18n.language}/become-guide`} className="hover:text-gnd-red transition-colors">{t('nav.becomeGuide')}</Link>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium hover:text-gnd-red transition-colors p-2 rounded-full hover:bg-gray-100">
                <Globe size={18} />
                <span className="uppercase">{i18n.language}</span>
              </button>
              {/* Language Dropdown */}
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                <button onClick={() => handleLanguageChange('en')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 hover:text-gnd-red">English</button>
                <button onClick={() => handleLanguageChange('zh-HK')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 hover:text-gnd-red">繁體中文</button>
                <button onClick={() => handleLanguageChange('zh-CN')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 hover:text-gnd-red">简体中文</button>
              </div>
            </div>
            <button className="text-sm font-medium hover:text-gnd-red transition-colors">{t('nav.login')}</button>
            <button className="bg-gnd-dark text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gnd-red transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 duration-200">
              {t('nav.signup')}
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 bg-gnd-dark/40 z-[60] backdrop-blur-sm transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setIsMobileMenuOpen(false)}>
        <div className={`absolute right-0 top-0 bottom-0 w-4/5 max-w-sm bg-white p-6 transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-8">
            <span className="font-bold text-xl">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex flex-col gap-6 text-lg font-medium">
            <Link to={`/${i18n.language}/explore`} className="border-b pb-4 border-gray-100">{t('nav.explore')}</Link>
            <Link to={`/${i18n.language}/destinations`} className="border-b pb-4 border-gray-100">{t('nav.destinations')}</Link>
            <Link to={`/${i18n.language}/become-guide`} className="border-b pb-4 border-gray-100">{t('nav.becomeGuide')}</Link>
            <div className="flex gap-4 mt-4">
               <button onClick={() => handleLanguageChange('en')} className={`px-4 py-2 rounded-full text-sm ${i18n.language === 'en' ? 'bg-gnd-red text-white' : 'bg-gray-100'}`}>EN</button>
               <button onClick={() => handleLanguageChange('zh-HK')} className={`px-4 py-2 rounded-full text-sm ${i18n.language === 'zh-HK' ? 'bg-gnd-red text-white' : 'bg-gray-100'}`}>繁</button>
               <button onClick={() => handleLanguageChange('zh-CN')} className={`px-4 py-2 rounded-full text-sm ${i18n.language === 'zh-CN' ? 'bg-gnd-red text-white' : 'bg-gray-100'}`}>簡</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

