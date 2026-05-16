import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, MapPin, Star, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MOCK_GUIDES, CATEGORIES } from '../data/mockData.jsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExploreView() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const cityFilter = searchParams.get('city');

  const filteredGuides = useMemo(() => {
    return MOCK_GUIDES.filter(guide => {
      const matchesSearch = guide.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t(`cities.${guide.cityKey}`).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || guide.roleKey === selectedCategory;
      const matchesCity = !cityFilter || guide.cityKey === cityFilter;
      return matchesSearch && matchesCategory && matchesCity;
    });
  }, [searchQuery, selectedCategory, cityFilter, t]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-2">
            {cityFilter ? t(`cities.${cityFilter}`) : t('nav.explore')}
          </h1>
          <p className="text-gnd-gray">{filteredGuides.length} {t('featured.title')}</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by city or name..."
              className="w-full pl-12 pr-4 py-3 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-gnd-red transition-colors shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-3 overflow-x-auto pb-6 mb-8 [&::-webkit-scrollbar]:hidden">
        <button 
          onClick={() => setSelectedCategory('all')}
          className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${selectedCategory === 'all' ? 'bg-gnd-red text-white' : 'bg-white border border-gray-200 hover:border-gnd-red'}`}
        >
          All Experience
        </button>
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${selectedCategory === cat.id ? 'bg-gnd-red text-white' : 'bg-white border border-gray-200 hover:border-gnd-red'}`}
          >
            {t(`categories.items.${cat.id}`)}
          </button>
        ))}
        {cityFilter && (
          <button 
            onClick={() => setSearchParams({})}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-all"
          >
            Clear City: {t(`cities.${cityFilter}`)} <X size={14} />
          </button>
        )}
      </div>

      {/* Guide Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <AnimatePresence mode='popLayout'>
          {filteredGuides.map((guide) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={guide.id}
            >
              <Link to={`/${i18n.language}/guide/${guide.id}`} className="group block">
                <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden mb-4 shadow-sm group-hover:shadow-xl group-hover:shadow-gnd-coral/20 transition-all duration-500">
                  <img src={guide.img} alt={guide.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-sm">
                    <Star size={14} className="text-yellow-500" fill="currentColor"/> {guide.rating}
                  </div>
                </div>
                <div className="px-2">
                  <h3 className="font-bold text-xl group-hover:text-gnd-red transition-colors">{guide.name}</h3>
                  <p className="text-gnd-gray text-sm mb-2 flex items-center gap-1"><MapPin size={14} /> {t(`cities.${guide.cityKey}`)}</p>
                  <p className="font-medium text-gnd-red text-sm mb-3">{t(`guideRoles.${guide.roleKey}`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {guide.tagKeys.map(tagKey => (
                      <span key={tagKey} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                        {t(`tags.${tagKey}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredGuides.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
            <X size={32} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No guides found</h2>
          <p className="text-gnd-gray">Try adjusting your search or filters.</p>
        </div>
      )}
    </motion.div>
  );
}
