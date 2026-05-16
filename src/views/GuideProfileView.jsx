import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, Calendar, MessageSquare, Share2, Heart, ShieldCheck, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MOCK_GUIDES } from '../data/mockData.jsx';
import { motion } from 'framer-motion';

export default function GuideProfileView() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const guide = MOCK_GUIDES.find(g => g.id === parseInt(id));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!guide) return <div className="pt-40 text-center">Guide not found</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-32 px-6 md:px-12 max-w-7xl mx-auto"
    >
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left: Images and Info */}
        <div className="flex-1 space-y-8">
          <div className="relative aspect-video rounded-[32px] overflow-hidden shadow-2xl">
            <img src={guide.img} alt={guide.name} className="w-full h-full object-cover" />
            <div className="absolute top-6 right-6 flex gap-3">
              <button className="p-3 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:scale-110 transition-transform">
                <Share2 size={20} />
              </button>
              <button className="p-3 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:scale-110 transition-transform text-red-500">
                <Heart size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold mb-2">{guide.name}</h1>
                <p className="text-gnd-red font-semibold text-lg">{t(`guideRoles.${guide.roleKey}`)}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 font-bold text-xl">
                  <Star size={20} className="text-yellow-500" fill="currentColor" /> {guide.rating}
                </div>
                <p className="text-gnd-gray text-sm">{guide.reviews} reviews</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium">
                <MapPin size={16} /> {t(`cities.${guide.cityKey}`)}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                <ShieldCheck size={16} /> Identity Verified
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h2 className="text-2xl font-bold mb-4">About Me</h2>
              <p className="text-gnd-gray leading-relaxed text-lg">
                {guide.bio || "Hi! I am a local expert passionate about showing you the best parts of my city. Whether you want to explore hidden gems, taste local street food, or learn about our rich culture, I am here to help."}
              </p>
            </div>

            <div className="pt-6">
              <h2 className="text-2xl font-bold mb-4">What I offer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guide.tagKeys.map(tagKey => (
                  <div key={tagKey} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <div className="w-10 h-10 bg-gnd-cream rounded-full flex items-center justify-center text-gnd-red">
                      <Check size={20} />
                    </div>
                    <span className="font-medium">{t(`tags.${tagKey}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Booking Card */}
        <div className="w-full lg:w-[400px]">
          <div className="sticky top-28 bg-white p-8 rounded-[32px] shadow-2xl border border-gray-50 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-3xl font-bold">$450</span>
                <span className="text-gnd-gray"> / session</span>
              </div>
            </div>

            <div className="space-y-4">
              <button className="w-full flex items-center justify-center gap-3 bg-gnd-red text-white py-4 rounded-2xl font-bold text-lg hover:bg-gnd-coral transition-colors shadow-lg shadow-red-100">
                <Calendar size={20} />
                Book Now
              </button>
              <button className="w-full flex items-center justify-center gap-3 bg-white text-gnd-dark border-2 border-gray-100 py-4 rounded-2xl font-bold text-lg hover:border-gnd-dark transition-all">
                <MessageSquare size={20} />
                Message {guide.name.split(' ')[0]}
              </button>
            </div>

            <p className="text-center text-gnd-gray text-sm">No payment required yet</p>
            
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gnd-gray">
                <ShieldCheck size={18} className="text-green-500" />
                <span>GuideNextdoor Trust & Safety Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
