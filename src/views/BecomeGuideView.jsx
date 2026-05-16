import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Upload, MapPin, Camera, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BecomeGuideView() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const steps = [
    { id: 1, title: t('becomeGuide.steps.info'), icon: <User /> },
    { id: 2, title: t('becomeGuide.steps.location'), icon: <MapPin /> },
    { id: 3, title: t('becomeGuide.steps.photos'), icon: <Camera /> },
    { id: 4, title: t('becomeGuide.steps.verify'), icon: <Check /> }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-32 pb-32 px-6 md:px-12 max-w-4xl mx-auto"
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">{t('becomeGuideCta.title')}</h1>
        <p className="text-gnd-gray text-lg max-w-2xl mx-auto">
          {t('becomeGuideCta.desc')}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex justify-between items-center mb-16 relative">
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
        <div 
          className="absolute top-1/2 left-0 h-1 bg-gnd-red -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
        ></div>
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${step >= s.id ? 'bg-gnd-red text-white shadow-lg scale-110' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
              {step > s.id ? <Check size={20} /> : s.icon}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.id ? 'text-gnd-red' : 'text-gray-400'}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* Form Area */}
      <div className="bg-white p-8 md:p-12 rounded-[32px] shadow-2xl border border-gray-50 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold mb-6">{t('becomeGuide.form.title')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gnd-dark">{t('becomeGuide.form.name')}</label>
                  <input type="text" placeholder={t('becomeGuide.form.namePlaceholder')} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gnd-red transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gnd-dark">{t('becomeGuide.form.email')}</label>
                  <input type="email" placeholder={t('becomeGuide.form.emailPlaceholder')} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gnd-red transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gnd-dark">{t('becomeGuide.form.bio')}</label>
                <textarea rows="4" placeholder={t('becomeGuide.form.bioPlaceholder')} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gnd-red transition-all"></textarea>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold mb-6">{t('becomeGuide.form.locationTitle')}</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gnd-dark">{t('becomeGuide.form.city')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder={t('becomeGuide.form.cityPlaceholder')} className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gnd-red transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gnd-dark">{t('becomeGuide.form.specialties')}</label>
                  <div className="flex flex-wrap gap-2">
                    {['Food', 'Photography', 'Hiking', 'Nightlife', 'History'].map(tag => (
                      <button key={tag} className="px-4 py-2 rounded-full border border-gray-200 hover:border-gnd-red hover:text-gnd-red transition-all text-sm font-medium">
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <h2 className="text-2xl font-bold mb-6">{t('becomeGuide.form.vibeTitle')}</h2>
              <div className="border-2 border-dashed border-gray-200 rounded-[32px] p-12 hover:border-gnd-red hover:bg-red-50/30 transition-all group cursor-pointer">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gnd-red group-hover:text-white transition-all">
                  <Upload size={24} />
                </div>
                <p className="font-bold text-lg mb-1">{t('becomeGuide.form.uploadTitle')}</p>
                <p className="text-gnd-gray">{t('becomeGuide.form.uploadDesc')}</p>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-2">{t('becomeGuide.form.finishTitle')}</h2>
              <p className="text-gnd-gray max-md mx-auto">
                {t('becomeGuide.form.finishDesc')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-12 pt-8 border-t border-gray-100">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className={`px-8 py-3 rounded-full font-bold text-gnd-dark hover:bg-gray-100 transition-all ${step === 1 ? 'invisible' : ''}`}
          >
            {t('becomeGuide.form.back')}
          </button>
          <button 
            onClick={() => step === 4 ? navigate(`/${i18n.language}`) : setStep(s => Math.min(4, s + 1))}
            className="flex items-center gap-2 bg-gnd-red text-white px-10 py-3 rounded-full font-bold hover:bg-gnd-coral transition-colors shadow-lg shadow-red-100"
          >
            {step === 4 ? t('becomeGuide.form.finish') : t('becomeGuide.form.continue')}
            {step < 4 && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
