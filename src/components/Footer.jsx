import React from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLanguageChange = (newLang) => {
    const currentPathWithoutLang = location.pathname.replace(`/${i18n.language}`, "") || "/";
    navigate(`/${newLang}${currentPathWithoutLang}`);
  };

  return (
    <footer className="bg-gnd-dark text-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gnd-dark">
              <MapPin size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl tracking-tight">GuideNextdoor</span>
          </div>
          <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
            {t('footer.desc')}
          </p>
          {/* Locale Switcher */}
          <div className="flex gap-4">
            <button onClick={() => handleLanguageChange('en')} className={`text-sm ${i18n.language === 'en' ? 'text-white' : 'text-gray-500 hover:text-white'}`}>EN</button>
            <button onClick={() => handleLanguageChange('zh-HK')} className={`text-sm ${i18n.language === 'zh-HK' ? 'text-white' : 'text-gray-500 hover:text-white'}`}>繁體</button>
            <button onClick={() => handleLanguageChange('zh-CN')} className={`text-sm ${i18n.language === 'zh-CN' ? 'text-white' : 'text-gray-500 hover:text-white'}`}>简体</button>
          </div>
        </div>
        
        <div>
          <h4 className="font-bold mb-6 text-lg">Platform</h4>
          <ul className="space-y-4 text-gray-400">
            <li><Link to={`/${i18n.language}/explore`} className="hover:text-white transition-colors">{t('nav.explore')}</Link></li>
            <li><Link to={`/${i18n.language}/destinations`} className="hover:text-white transition-colors">{t('nav.destinations')}</Link></li>
            <li><Link to={`/${i18n.language}/become-guide`} className="hover:text-white transition-colors">{t('nav.becomeGuide')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-6 text-lg">Support</h4>
          <ul className="space-y-4 text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors">{t('footer.about')}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{t('footer.faq')}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{t('footer.terms')}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{t('footer.privacy')}</a></li>
          </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-gray-800 text-gray-500 text-sm flex flex-col md:flex-row justify-between items-center">
        <p>© 2026 GuideNextdoor. {t('footer.rights')}</p>
        <div className="flex gap-6 mt-4 md:mt-0">
           <span>Interactive Implementation Demo</span>
        </div>
      </div>
    </footer>
  );
}
