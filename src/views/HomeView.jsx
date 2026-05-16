import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, Search, ArrowRight, MapPin, Users, Heart
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MOCK_GUIDES, CATEGORIES, HERO_SLIDES, MOCK_POSTS } from '../data/mockData.jsx';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const SocialPost = ({ post, t }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="break-inside-avoid mb-6 group cursor-pointer"
  >
    <div className="relative rounded-[24px] overflow-hidden bg-gray-100 shadow-sm group-hover:shadow-xl transition-all duration-500">
      <img 
        src={post.img} 
        alt={post.caption} 
        className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
        style={{ aspectRatio: post.aspect_ratio }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <p className="text-white text-sm font-medium line-clamp-2 mb-2">{post.caption}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={post.avatar} className="w-6 h-6 rounded-full object-cover border border-white/20" />
            <span className="text-white text-xs font-semibold">{post.instructor_name}</span>
          </div>
          <div className="flex items-center gap-1 text-white text-xs">
            <Heart size={14} className="fill-current text-gnd-red" />
            <span>{post.likes}</span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const GuideCard = ({ guide, t, i18n }) => (
  <Link to={`/${i18n.language}/guide/${guide.id}`} className="w-72 shrink-0 cursor-pointer group/card select-none">
    <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden mb-4 shadow-sm group-hover/card:shadow-xl group-hover/card:shadow-gnd-coral/20 transition-all duration-500 pointer-events-none">
      <img src={guide.img} alt={guide.name} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700 ease-out" />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-sm">
        <Star size={14} className="text-yellow-500" fill="currentColor"/> {guide.rating}
      </div>
    </div>
    <div className="px-2">
      <h3 className="font-bold text-xl group-hover:text-gnd-red transition-colors">{guide.name}</h3>
      <p className="text-gnd-gray text-sm mb-2 flex items-center gap-1"><MapPin size={14} /> {t(`cities.${guide.cityKey}`)}</p>
      <p className="font-medium text-gnd-red text-sm mb-3">{t(`guideRoles.${guide.roleKey}`)}</p>
    </div>
  </Link>
);

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const [heroIdx, setHeroIdx] = useState(0);
  
  const row1Ref = useRef(null);
  const row2Ref = useRef(null);
  const isPaused1 = useRef(false);
  const isPaused2 = useRef(false);
  const lastInteraction1 = useRef(0);
  const lastInteraction2 = useRef(0);
  
  // Drag state
  const isDragging1 = useRef(false);
  const startX1 = useRef(0);
  const scrollLeft1 = useRef(0);
  const isDragging2 = useRef(false);
  const startX2 = useRef(0);
  const scrollLeft2 = useRef(0);

  // Animation frame storage
  const requestRef = useRef();
  const initialized = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Desktop Drag Logic for Row 1
  const onMouseDown1 = (e) => {
    isDragging1.current = true;
    isPaused1.current = true;
    startX1.current = e.pageX - row1Ref.current.offsetLeft;
    scrollLeft1.current = row1Ref.current.scrollLeft;
  };

  // Desktop Drag Logic for Row 2
  const onMouseDown2 = (e) => {
    isDragging2.current = true;
    isPaused2.current = true;
    startX2.current = e.pageX - row2Ref.current.offsetLeft;
    scrollLeft2.current = row2Ref.current.scrollLeft;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging1.current) {
        isDragging1.current = false;
        lastInteraction1.current = Date.now();
        setTimeout(() => { if (!isDragging1.current) isPaused1.current = false; }, 1500);
      }
      if (isDragging2.current) {
        isDragging2.current = false;
        lastInteraction2.current = Date.now();
        setTimeout(() => { if (!isDragging2.current) isPaused2.current = false; }, 1500);
      }
    };

    const handleGlobalMouseMove = (e) => {
      if (isDragging1.current) {
        e.preventDefault();
        const x = e.pageX - row1Ref.current.offsetLeft;
        const walk = (x - startX1.current) * 2;
        row1Ref.current.scrollLeft = scrollLeft1.current - walk;
      }
      if (isDragging2.current) {
        e.preventDefault();
        const x = e.pageX - row2Ref.current.offsetLeft;
        const walk = (x - startX2.current) * 2;
        row2Ref.current.scrollLeft = scrollLeft2.current - walk;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []);

  // Animation Loop
  const animate = () => {
    const row1 = row1Ref.current;
    const row2 = row2Ref.current;
    const now = Date.now();

    if (row1 && row2) {
      // Ensure Row 2 starts in middle for right-scroll
      if (!initialized.current && row2.scrollWidth > 0) {
        row2.scrollLeft = row2.scrollWidth / 2;
        initialized.current = true;
      }

      // Row 1: Content moves LEFT (scrollLeft increases)
      if (!isPaused1.current && (now - lastInteraction1.current > 1500)) {
        row1.scrollLeft += 1.0; // Slightly faster for visibility
        if (row1.scrollLeft >= row1.scrollWidth / 2) {
          row1.scrollLeft = 0;
        }
      } else if (isDragging1.current) {
        // Manual drag wrap check
        if (row1.scrollLeft >= row1.scrollWidth / 2) row1.scrollLeft = 0;
        if (row1.scrollLeft <= 0) row1.scrollLeft = row1.scrollWidth / 2;
      }

      // Row 2: Content moves RIGHT (scrollLeft decreases)
      if (!isPaused2.current && (now - lastInteraction2.current > 1500)) {
        row2.scrollLeft -= 0.8;
        if (row2.scrollLeft <= 0) {
          row2.scrollLeft = row2.scrollWidth / 2;
        }
      } else if (isDragging2.current) {
        // Manual drag wrap check
        if (row2.scrollLeft <= 0) row2.scrollLeft = row2.scrollWidth / 2;
        if (row2.scrollLeft >= row2.scrollWidth / 2) row2.scrollLeft = 0;
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="overflow-x-hidden"
    >
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 space-y-8 z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-gray-100 text-sm font-medium text-gnd-red mb-2"
            >
              <Star size={16} fill="currentColor"/> {t('hero.ratingTag')}
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight"
            >
              {t('hero.title')}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gnd-gray max-w-xl leading-relaxed"
            >
              {t('hero.subtitle')}
            </motion.p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to={`/${i18n.language}/explore`} className="flex items-center justify-center gap-2 bg-gnd-red text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-gnd-coral transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-300">
                <Search size={20} />
                {t('hero.findBtn')}
              </Link>
              <Link to={`/${i18n.language}/become-guide`} className="flex items-center justify-center gap-2 bg-white text-gnd-dark border-2 border-transparent hover:border-gnd-dark px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 shadow-sm hover:shadow-md">
                {t('hero.becomeBtn')}
              </Link>
            </div>
          </div>

          <div className="flex-1 relative w-full h-[500px] hidden md:block">
            {HERO_SLIDES.map((slide, idx) => {
              const isActive = idx === heroIdx;
              return (
                <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <div className="absolute top-10 right-10 w-3/4 h-[400px] rounded-[32px] overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                    <img src={slide.img} alt="Local Experience" className="w-full h-full object-cover" />
                  </div>
                  <div className={`absolute top-0 left-0 bg-white p-4 rounded-2xl shadow-xl z-20 flex items-center gap-4 transition-transform duration-700 delay-300 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                     <img src={slide.avatar} className="w-12 h-12 rounded-full object-cover"/>
                     <div>
                       <p className="font-bold text-sm text-gnd-dark">{t(`hero.slides.${idx}.author`)} {t('hero.foundGuide')}</p>
                       <p className="text-xs text-gnd-red font-medium">{t(`hero.slides.${idx}.event`)}</p>
                     </div>
                  </div>
                  <div className={`absolute bottom-10 left-10 w-48 h-48 rounded-[24px] overflow-hidden shadow-xl z-20 border-4 border-white transition-transform duration-700 delay-100 ${isActive ? 'translate-y-0 opacity-100 transform -rotate-6 hover:rotate-0' : 'translate-y-8 opacity-0'}`}>
                    <img src={slide.deco} alt="Deco" className="w-full h-full object-cover" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('howItWorks.title')}</h2>
            <div className="w-20 h-1 bg-gnd-red mx-auto rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gray-100 z-0"></div>
            {[1, 2, 3].map((step) => (
              <div key={step} className="relative z-10 flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-gnd-cream rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:shadow-md group-hover:-translate-y-2 transition-all duration-300">
                  {step === 1 ? <MapPin size={32} className="text-gnd-red" /> : step === 2 ? <Search size={32} className="text-gnd-red" /> : <Users size={32} className="text-gnd-red" />}
                </div>
                <h3 className="text-xl font-bold mb-3">{t(`howItWorks.step${step}.title`)}</h3>
                <p className="text-gnd-gray">{t(`howItWorks.step${step}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 bg-gnd-cream">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-10">{t('categories.title')}</h2>
          <div className="flex flex-wrap gap-4 mb-16">
            {CATEGORIES.map((cat) => (
              <Link 
                to={`/${i18n.language}/explore?category=${cat.id}`}
                key={cat.id} 
                className={`relative overflow-hidden flex items-center justify-center rounded-full shadow-sm hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 group h-16 sm:h-20 w-auto px-8 min-w-[160px]`}
              >
                <div className="absolute inset-0">
                  <img src={cat.img} alt={cat.id} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                </div>
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300"></div>
                <span className="relative z-10 font-bold text-white tracking-wide text-[15px] sm:text-lg whitespace-nowrap">
                  {t(`categories.items.${cat.id}`)}
                </span>
              </Link>
            ))}
          </div>

          {/* Social Feed - MASONRY GRID (Now inside the vibe section) */}
          <div className="columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {MOCK_POSTS.map((post) => (
              <SocialPost key={post.id} post={post} t={t} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Guides Slider - RESTORED */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('featured.title')}</h2>
              <p className="text-gnd-gray max-w-lg">{t('featured.subtitle')}</p>
            </div>
            <Link to={`/${i18n.language}/explore`} className="hidden md:flex items-center gap-2 text-gnd-red font-medium hover:gap-3 transition-all">
              {t('featured.viewAll')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="relative w-full space-y-12 py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          {/* Row 1 */}
          <div 
            ref={row1Ref}
            onMouseDown={onMouseDown1}
            onMouseEnter={() => isPaused1.current = true}
            onMouseLeave={() => { if (!isDragging1.current) isPaused1.current = false; }}
            className="flex overflow-x-auto gap-6 px-6 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing touch-pan-x"
          >
            {[...MOCK_GUIDES, ...MOCK_GUIDES, ...MOCK_GUIDES].map((guide, idx) => (
              <GuideCard key={`r1-${idx}`} guide={guide} t={t} i18n={i18n} />
            ))}
          </div>

          {/* Row 2 */}
          <div 
            ref={row2Ref}
            onMouseDown={onMouseDown2}
            onMouseEnter={() => isPaused2.current = true}
            onMouseLeave={() => { if (!isDragging2.current) isPaused2.current = false; }}
            className="flex overflow-x-auto gap-6 px-6 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing touch-pan-x"
          >
            {[...MOCK_GUIDES, ...MOCK_GUIDES, ...MOCK_GUIDES].map((guide, idx) => (
              <GuideCard key={`r2-${idx}`} guide={guide} t={t} i18n={i18n} />
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <button className="md:hidden mt-12 w-full flex justify-center items-center gap-2 text-gnd-red font-medium py-4 bg-gray-50 rounded-2xl">
            {t('featured.viewAll')} <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Become a Guide CTA */}
      <section className="py-24 bg-gnd-red text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gnd-coral rounded-full blur-3xl opacity-50"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('becomeGuideCta.title')}</h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">{t('becomeGuideCta.desc')}</p>
          <Link to={`/${i18n.language}/become-guide`} className="bg-white text-gnd-red px-10 py-4 rounded-full text-lg font-bold hover:bg-gray-100 transition-colors shadow-xl hover:shadow-2xl transform hover:-translate-y-1 duration-300">
            {t('becomeGuideCta.btn')}
          </Link>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
      `}} />
    </motion.div>
  );
}
