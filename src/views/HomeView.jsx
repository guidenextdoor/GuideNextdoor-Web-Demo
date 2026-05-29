import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ShieldCheck, UsersRound, Star, MapPin, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fetchCoaches, fetchLocations, fetchServices, fetchPosts } from '../lib/database';

// Spring physics as per DESIGN.md v2.0
const springTransition = { type: "spring", stiffness: 400, damping: 25 };

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState({ loading: true, coaches: 0, services: 0, locations: 0, error: null });
  const [featuredPosts, setFeaturedPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCoaches(), 
      fetchServices(), 
      fetchLocations(),
      fetchPosts()
    ]).then(([coaches, services, locations, posts]) => {
      if (cancelled) return;
      setSummary({
        loading: false,
        coaches: coaches.data.length,
        services: services.data.length,
        locations: locations.data.length,
        rawCoaches: coaches.data?.length || 0,
        rawPosts: posts.data?.length || 0,
        error: coaches.error || services.error || locations.error,
      });
      setFeaturedPosts(posts.data.slice(0, 4));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-x-hidden">
      {/* 1. EDITORIAL HERO SECTION */}
      <section className="relative mx-auto max-w-7xl px-5 pt-12 pb-20 md:px-8 md:pt-20 md:pb-32">
        <div className="flex flex-col items-center text-center">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-gnd-red sm:text-xs"
          >
            {t('home.eyebrow')}
          </motion.p>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.03em] text-gnd-dark md:text-8xl lg:text-[9rem]"
          >
            {t('home.title').split('.').map((part, i) => (
              <span key={i} className="block">{part}</span>
            ))}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 max-w-xl text-lg font-bold leading-relaxed text-gnd-gray md:text-xl"
          >
            {t('home.subtitle')}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, ...springTransition }}
            className="mt-12 flex flex-col gap-4 sm:flex-row"
          >
            <Link 
              to={`/${i18n.language}/explore`} 
              className="inline-flex h-16 items-center justify-center rounded-lg bg-gnd-red px-10 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-red-900/40 transition-all hover:bg-gnd-dark hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('home.primaryAction')}
            </Link>
            <Link 
              to={`/${i18n.language}/become-guide`} 
              className="inline-flex h-16 items-center justify-center rounded-lg border border-gnd-cream bg-white px-10 text-sm font-black uppercase tracking-widest text-gnd-dark transition-all hover:bg-gnd-cream hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('home.secondaryAction')}
            </Link>
          </motion.div>
        </div>

        {/* Floating "Window" Collage Elements */}
        <motion.div 
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 0.1, x: 0 }}
          className="absolute -left-20 top-40 -z-10 hidden lg:block"
        >
          <div className="h-[400px] w-[300px] rotate-[-6deg] rounded-3xl bg-gnd-gray/10" />
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 0.1, x: 0 }}
          className="absolute -right-20 top-60 -z-10 hidden lg:block"
        >
          <div className="h-[500px] w-[350px] rotate-[8deg] rounded-3xl bg-gnd-gray/10" />
        </motion.div>
      </section>

      {/* 2. FEATURED POSTS GRID (The "RedNote" Grid) */}
      <section className="bg-white py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <header className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gnd-gray">{t('explore.storyRailLabel')}</p>
              <h2 className="mt-2 text-3xl font-black text-gnd-dark md:text-5xl">{t('explore.storyRailTitle')}</h2>
            </div>
            <Link to={`/${i18n.language}/explore`} className="text-xs font-black uppercase tracking-widest text-gnd-red hover:underline decoration-2 underline-offset-4">
              {t('explore.resultCount', { count: summary.coaches }) || 'View all'}
            </Link>
          </header>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-8">
            {summary.loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.5rem] bg-gnd-cream" />
              ))
            ) : featuredPosts.length > 0 ? (
              featuredPosts.map((post, i) => (
                <motion.article 
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative overflow-hidden rounded-[1.5rem] bg-gnd-cream shadow-sm transition-all hover:shadow-xl hover:shadow-red-900/5"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img 
                      src={post.imageUrls?.[0] || post.imageUrl} 
                      alt={post.title} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-full flex-col justify-end">
                        <div className="flex items-center gap-3 text-white">
                          <div className="flex items-center gap-1">
                            <Heart size={14} className="fill-current" />
                            <span className="text-[10px] font-black">{post.likes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star size={14} className="fill-white" />
                            <span className="text-[10px] font-black">4.9</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-5 w-5 rounded-full bg-gnd-red/10 flex items-center justify-center">
                        <MapPin size={10} className="text-gnd-red" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-gnd-gray truncate">{post.location}</span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-bold leading-relaxed text-gnd-dark">
                      {post.caption || post.title}
                    </h3>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <p className="text-sm font-bold text-gnd-gray">{t('explore.emptyBody') || 'No coaches nearby right now. Check back later!'}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (The "Platform Pillars") */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-32">
        <div className="grid gap-12 lg:grid-cols-3">
          {['discover', 'coordinate', 'verify'].map((key, i) => (
            <motion.div 
              key={key} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, ...springTransition }}
              className="relative overflow-hidden rounded-[2rem] border border-gnd-cream bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-red-900/5"
            >
              <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gnd-red/5 text-gnd-red">
                {key === 'discover' && <Compass size={28} />}
                {key === 'coordinate' && <UsersRound size={28} />}
                {key === 'verify' && <ShieldCheck size={28} />}
              </div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gnd-red">{t(`home.pillars.${key}.eyebrow`)}</p>
              <h3 className="text-2xl font-black text-gnd-dark">{t(`home.pillars.${key}.title`)}</h3>
              <p className="mt-4 text-sm font-bold leading-relaxed text-gnd-gray">{t(`home.pillars.${key}.body`)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. TRUST METRICS */}
      <section className="mx-auto mb-20 max-w-4xl px-5 md:mb-32">
        <div className="rounded-[2.5rem] bg-gnd-dark p-8 md:p-12 text-white">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center gap-2 text-gnd-coral md:justify-start">
                <Sparkles size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('home.opsLabel')}</span>
              </div>
              <h2 className="mt-4 text-3xl font-black md:text-4xl">{t('home.opsTitle')}</h2>
              <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/60">{t('home.opsBody')}</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 md:justify-end">
              {[
                { label: t('home.metrics.coaches'), value: summary.coaches },
                { label: t('home.metrics.services'), value: summary.services },
                { label: t('home.metrics.locations'), value: summary.locations }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center md:items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{stat.label}</span>
                  <span className="mt-1 text-3xl font-black">{summary.loading ? '...' : stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. BECOME A COACH CTA */}
      <section className="bg-gnd-cream py-20 md:py-32">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <h2 className="text-4xl font-black leading-tight text-gnd-dark md:text-6xl">
            {t('becomeGuide.title')}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg font-bold text-gnd-gray">
            {t('becomeGuide.subtitle')}
          </p>
          <div className="mt-10">
            <Link 
              to={`/${i18n.language}/become-guide`}
              className="inline-flex h-16 items-center justify-center rounded-lg bg-gnd-dark px-12 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black hover:scale-105"
            >
              {t('home.secondaryAction')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
