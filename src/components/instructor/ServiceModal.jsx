import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Loader2, Info, MapPin } from 'lucide-react';
import { fetchRefActivities, fetchRefQualifications, fetchLocations } from '../../lib/database';

export default function ServiceModal({ isOpen, onClose, onSave, service, instructorId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [activities, setActivities] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  
  const [formData, setFormData] = useState({
    activityId: '',
    qualificationId: '',
    customQualification: '',
    certFile: null,
    attainmentYear: '',
    description: '',
    minDurationHours: 1,
    pricing: [],
    locationIds: [],
  });

  const isEditing = Boolean(service);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    setLoading(true);

    Promise.all([
      fetchRefActivities(),
      fetchLocations(),
      fetchRefQualifications(instructorId),
    ]).then(([actRes, locRes, qualRes]) => {
      if (!isMounted) return;
      
      const loadedActivities = actRes.data || [];
      setActivities(loadedActivities);
      setAllLocations(locRes.data || []);
      setQualifications(qualRes.data || []);

      // Reset form with default or loaded data
      const initialData = service ? {
        activityId: service.activityId || '',
        qualificationId: service.qualificationId || '', // Assuming qualificationId is passed via service normalization
        customQualification: '',
        certFile: null,
        attainmentYear: service.attainmentYear || '',
        description: service.description || '',
        minDurationHours: service.minDurationHours || 1,
        pricing: service.pricing?.length ? [...service.pricing] : [{ skillLevel: t('workspace.services.allLevels', 'All Levels'), currency: 'USD', price1: '', extraPersonFee: '' }],
        locationIds: service.locations?.map(l => l.id) || [],
      } : {
        activityId: loadedActivities.length > 0 ? loadedActivities[0].id : '',
        qualificationId: '',
        customQualification: '',
        certFile: null,
        attainmentYear: '',
        description: '',
        minDurationHours: 1,
        pricing: [{ skillLevel: t('workspace.services.allLevels', 'All Levels'), currency: 'USD', price1: '', extraPersonFee: '' }],
        locationIds: [],
      };

      setFormData(initialData);

    }).catch(err => {
      console.error('Failed to load dependencies', err);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [isOpen, service, instructorId, t]);

  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationResults, setShowLocationResults] = useState(false);
  
  const [qualSearch, setQualSearch] = useState('');
  const [showQualResults, setShowQualResults] = useState(false);

  const filteredLocations = allLocations.filter(loc => 
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    loc.country?.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const filteredQualifications = qualifications.filter(q => 
    (!formData.activityId || q.activity_id === formData.activityId) &&
    (q.qualification_name || q.qualification || '').toLowerCase().includes(qualSearch.toLowerCase())
  );

  const handleLocationToggle = (locId) => {
    setFormData(prev => {
      const isSelected = prev.locationIds.includes(locId);
      return {
        ...prev,
        locationIds: isSelected 
          ? prev.locationIds.filter(id => id !== locId)
          : [...prev.locationIds, locId]
      };
    });
    setLocationSearch('');
    setShowLocationResults(false);
  };

  const handleQualSelect = (qual) => {
    if (qual === 'custom') {
      setFormData(prev => ({ ...prev, qualificationId: 'custom', customQualification: qualSearch }));
    } else {
      setFormData(prev => ({ ...prev, qualificationId: qual.id, customQualification: '' }));
      setQualSearch(qual.qualification_name || qual.qualification);
    }
    setShowQualResults(false);
  };

  const handleQualClick = () => {
    setShowQualResults(true);
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setFormData(prev => ({ ...prev, certFile: e.target.files[0] }));
    }
  };

  const handleAddPricingTier = () => {
    setFormData(prev => ({
      ...prev,
      pricing: [...prev.pricing, { skillLevel: 'New Level', currency: 'USD', price1: '', extraPersonFee: '' }]
    }));
  };

  const handleRemovePricingTier = (index) => {
    setFormData(prev => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index)
    }));
  };

  const handlePricingChange = (index, field, value) => {
    setFormData(prev => {
      const newPricing = [...prev.pricing];
      newPricing[index] = { ...newPricing[index], [field]: value };
      return { ...prev, pricing: newPricing };
    });
  };

  const selectedLocationObjects = allLocations.filter(loc => formData.locationIds.includes(loc.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.certFile && !isEditing) {
      alert('Certificate photo is compulsory.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        instructorId,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save service', err);
    } finally {
      setSaving(false);
    }
  };

  const isValid = formData.activityId && 
                  formData.locationIds.length > 0 && 
                  formData.pricing.length > 0 && 
                  formData.pricing[0].price1 &&
                  (isEditing || formData.certFile);

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gnd-dark/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gnd-cream px-6 py-4">
              <div>
                <h2 className="text-xl font-black text-gnd-dark">
                  {isEditing ? 'Edit Service' : 'Add New Service'}
                </h2>
                <p className="text-sm text-gnd-gray">Configure your offering details</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gnd-gray transition-colors hover:bg-gnd-cream hover:text-gnd-dark"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="animate-spin text-gnd-red" size={32} />
                </div>
              ) : (
                <form id="service-form" onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-gnd-dark border-b border-gnd-cream pb-2">1. Basic Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gnd-dark">Activity Category *</label>
                        <select
                          required
                          value={formData.activityId}
                          onChange={(e) => setFormData(prev => ({ ...prev, activityId: e.target.value, qualificationId: '' }))}
                          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/30 p-3 text-sm focus:border-gnd-red focus:outline-none focus:ring-1 focus:ring-gnd-red"
                        >
                          <option value="" disabled>Select an activity...</option>
                          {activities.map(act => (
                            <option key={act.id} value={act.id}>
                              {t(act.translation_key, { 
                                defaultValue: act.translation_key.replace('activity.', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5 relative">
                        <label className="text-sm font-bold text-gnd-dark">Qualification *</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={qualSearch}
                            onChange={(e) => {
                              setQualSearch(e.target.value);
                              setShowQualResults(true);
                              if (formData.qualificationId !== 'custom') {
                                setFormData(prev => ({ ...prev, qualificationId: '', customQualification: '' }));
                              }
                            }}
                            onFocus={handleQualClick}
                            onClick={handleQualClick}
                            placeholder="Select or add a qualification..."
                            className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/30 p-3 text-sm focus:border-gnd-red focus:outline-none focus:ring-1 focus:ring-gnd-red pr-10"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gnd-gray group-focus-within:text-gnd-red">
                            <Plus size={16} />
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {showQualResults && (
                            <Fragment>
                              <div className="fixed inset-0 z-10" onClick={() => setShowQualResults(false)} />
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gnd-cream bg-white shadow-2xl"
                              >
                                {filteredQualifications.length > 0 ? (
                                  <div className="py-2">
                                    <p className="px-4 py-1 text-[10px] font-black uppercase text-gnd-gray/50 tracking-wider">Available in {activities.find(a => a.id === formData.activityId)?.translation_key?.replace('activity.', '') || 'Database'}</p>
                                    {filteredQualifications.map(qual => (
                                      <button
                                        type="button"
                                        key={qual.id}
                                        onClick={() => handleQualSelect(qual)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gnd-cream/30 border-b border-gnd-cream/10 last:border-0"
                                      >
                                        <div>
                                          <p className="text-sm font-black text-gnd-dark">{qual.qualification_name || qual.qualification}</p>
                                          {qual.is_verified && <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">✓ Verified Dictionary Entry</p>}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-4 py-6 text-center text-xs font-bold text-gnd-gray">
                                    No verified credentials found for this activity.
                                  </div>
                                )}
                                
                                {qualSearch.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleQualSelect('custom')}
                                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-red-50 bg-red-50/50 border-t border-gnd-cream/20"
                                  >
                                    <Plus size={16} className="text-gnd-red" />
                                    <div>
                                      <p className="text-sm font-black text-gnd-red">Add "{qualSearch}"</p>
                                      <p className="text-[10px] font-bold text-gnd-gray uppercase tracking-widest">Register New Qualification</p>
                                    </div>
                                  </button>
                                )}
                              </motion.div>
                            </Fragment>
                          )}
                        </AnimatePresence>

                        {formData.qualificationId === 'custom' && (
                           <div className="mt-2 flex items-center gap-2 rounded-lg border border-gnd-red bg-red-50 px-3 py-2">
                             <div className="flex-1">
                               <p className="text-[10px] font-black uppercase text-gnd-red">Adding Custom Qualification:</p>
                               <p className="text-sm font-bold text-gnd-dark">{formData.customQualification}</p>
                             </div>
                             <button type="button" onClick={() => { setFormData(prev => ({ ...prev, qualificationId: '', customQualification: '' })); setQualSearch(''); }} className="text-gnd-gray hover:text-gnd-red"><X size={14}/></button>
                           </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gnd-dark">Certificate Photo *</label>
                      <input
                        required={!isEditing}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="w-full rounded-lg border border-gnd-cream bg-white p-2 text-sm text-gnd-gray file:mr-4 file:rounded-md file:border-0 file:bg-gnd-red/10 file:px-4 file:py-2 file:text-sm file:font-bold file:text-gnd-red hover:file:bg-gnd-red/20"
                      />
                      {formData.certFile && (
                        <p className="text-xs text-green-600 mt-1 font-bold flex items-center gap-1">✓ Ready to upload: {formData.certFile.name}</p>
                      )}
                      <p className="text-xs text-gnd-gray mt-1 flex items-center gap-1"><Info size={12}/> A valid certificate is required for all services on GuideNextdoor.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gnd-dark">Attainment Year</label>
                        <input
                          type="number"
                          min="1950"
                          max={new Date().getFullYear()}
                          value={formData.attainmentYear}
                          onChange={(e) => setFormData(prev => ({ ...prev, attainmentYear: e.target.value }))}
                          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/30 p-3 text-sm focus:border-gnd-red focus:outline-none focus:ring-1 focus:ring-gnd-red"
                          placeholder={`e.g. ${new Date().getFullYear() - 3}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gnd-dark">Minimum Duration (Hours)</label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={formData.minDurationHours}
                          onChange={(e) => setFormData(prev => ({ ...prev, minDurationHours: Number(e.target.value) || 1 }))}
                          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/30 p-3 text-sm focus:border-gnd-red focus:outline-none focus:ring-1 focus:ring-gnd-red"
                          placeholder="e.g. 1"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gnd-dark">Service Description</label>
                      <textarea
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/30 p-3 text-sm focus:border-gnd-red focus:outline-none focus:ring-1 focus:ring-gnd-red"
                        placeholder="Describe what learners can expect from this service..."
                      />
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-gnd-dark border-b border-gnd-cream pb-2">2. Coverage Areas *</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedLocationObjects.map(loc => (
                        <div key={loc.id} className="flex items-center gap-1.5 rounded-lg border border-gnd-red bg-gnd-red/5 px-3 py-1.5">
                          <MapPin size={12} className="text-gnd-red" />
                          <span className="text-xs font-bold text-gnd-dark">{loc.name}</span>
                          <button 
                            type="button"
                            onClick={() => handleLocationToggle(loc.id)}
                            className="ml-1 text-gnd-red hover:text-red-700"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={locationSearch}
                        onChange={(e) => {
                          setLocationSearch(e.target.value);
                          setShowLocationResults(true);
                        }}
                        onFocus={() => setShowLocationResults(true)}
                        placeholder="Search for a location..."
                        className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/10 px-3 py-3 text-sm font-bold text-gnd-dark outline-none focus:ring-1 focus:ring-gnd-red"
                      />
                      
                      <AnimatePresence>
                        {showLocationResults && locationSearch.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gnd-cream bg-white shadow-xl"
                          >
                            {filteredLocations.length > 0 ? filteredLocations.map(loc => (
                              <button
                                type="button"
                                key={loc.id}
                                onClick={() => handleLocationToggle(loc.id)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gnd-cream/30"
                              >
                                <MapPin size={14} className="text-gnd-gray" />
                                <div>
                                  <p className="text-sm font-black text-gnd-dark">{loc.name}</p>
                                  {loc.country && <p className="text-[10px] font-bold text-gnd-gray uppercase">{loc.country}</p>}
                                </div>
                                {formData.locationIds.includes(loc.id) && (
                                  <span className="ml-auto text-xs font-bold text-gnd-red">Added</span>
                                )}
                              </button>
                            )) : (
                              <div className="px-4 py-6 text-center text-xs font-bold text-gnd-gray">
                                No locations found for "{locationSearch}"
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {formData.locationIds.length === 0 && <p className="text-sm text-gnd-red font-bold">Please add at least one location.</p>}
                  </div>

                  {/* Pricing Tiers */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gnd-cream pb-2">
                      <h3 className="text-lg font-black text-gnd-dark">3. Pricing Tiers (Hourly Rate) *</h3>
                      <button 
                        type="button" 
                        onClick={handleAddPricingTier}
                        className="text-sm font-bold text-gnd-red hover:text-red-700 flex items-center gap-1"
                      >
                        <Plus size={16}/> Add Tier
                      </button>
                    </div>

                    <div className="space-y-6">
                      {formData.pricing.map((tier, index) => (
                        <div key={index} className="relative rounded-xl border border-gnd-cream bg-gnd-cream/10 p-4 pt-6">
                          {formData.pricing.length > 1 && (
                             <button 
                               type="button"
                               onClick={() => handleRemovePricingTier(index)}
                               className="absolute top-2 right-2 text-gnd-gray hover:text-gnd-red p-1"
                             >
                               <Trash2 size={16}/>
                             </button>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gnd-gray uppercase tracking-wider">Skill Level Label</label>
                              <input
                                required
                                type="text"
                                value={tier.skillLevel}
                                onChange={(e) => handlePricingChange(index, 'skillLevel', e.target.value)}
                                className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                                placeholder="e.g. Beginner"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gnd-gray uppercase tracking-wider">Currency</label>
                              <select
                                value={tier.currency}
                                onChange={(e) => handlePricingChange(index, 'currency', e.target.value)}
                                className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none bg-white"
                              >
                                <option value="USD">USD ($)</option>
                                <option value="HKD">HKD (HK$)</option>
                                <option value="JPY">JPY (¥)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-gnd-gray">Base Price (1 Person) *</label>
                              <input
                                required
                                type="number"
                                min="0"
                                value={tier.price1}
                                onChange={(e) => handlePricingChange(index, 'price1', e.target.value)}
                                className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                                placeholder="Hourly Price"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gnd-gray">Additional Person Fee *</label>
                              <input
                                required
                                type="number"
                                min="0"
                                value={tier.extraPersonFee}
                                onChange={(e) => handlePricingChange(index, 'extraPersonFee', e.target.value)}
                                className="w-full rounded-md border border-gnd-cream px-3 py-2 text-sm focus:border-gnd-red focus:outline-none"
                                placeholder="Fee per extra person"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </form>
              )}
            </div>

            <div className="border-t border-gnd-cream p-6 flex justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-6 py-3 text-sm font-bold text-gnd-dark transition-colors hover:bg-gnd-cream rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="service-form"
                disabled={saving || !isValid}
                className="flex items-center gap-2 rounded-lg bg-gnd-dark px-8 py-3 text-sm font-black text-white transition-all hover:bg-gnd-red disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  isEditing ? 'Save Changes' : 'Create Service'
                )}
              </button>
            </div>
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  );
}
