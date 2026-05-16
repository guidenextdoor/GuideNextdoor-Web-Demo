import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MOCK_DESTINATIONS } from '../data/mockData.jsx';
import { motion } from 'framer-motion';

export default function DestinationsView() {
  const { t, i18n } = useTranslation();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto"
    >
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{t('destinations.title')}</h1>
        <p className="text-gnd-gray text-lg max-w-2xl">
          {t('destinations.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {MOCK_DESTINATIONS.map((dest) => (
          <Link 
            to={`/${i18n.language}/explore?city=${dest.id}`} 
            key={dest.id}
            className="group relative h-80 rounded-[32px] overflow-hidden shadow-xl"
          >
            <img 
              src={dest.img} 
              alt={t(dest.nameKey)} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-8 left-8 text-white">
              <h2 className="text-3xl font-bold mb-2">{t(dest.nameKey)}</h2>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-sm font-medium bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                  <MapPin size={14} /> {dest.count} Guides
                </span>
                <span className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all">
                  {t('destinations.viewGuides')} <ArrowRight size={18} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
