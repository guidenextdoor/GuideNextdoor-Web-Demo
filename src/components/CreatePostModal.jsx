import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  Loader2,
  Trash2,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../lib/image-utils';
import { uploadPostMedia, createPost, fetchLocations, fetchInstructorSchedule } from '../lib/database';

export default function CreatePostModal({ onClose, onPostCreated, t }) {
  const [step, setStep] = useState(1); // 1: Select, 2: Preview & Details
  const [files, setFiles] = useState([]); // Original files
  const [previews, setPreviews] = useState([]); // Compressed preview URLs
  const [compressedFiles, setCompressedFiles] = useState([]); // Files to upload
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [caption, setCaption] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedPostLocation] = useState(null);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [hashtags, setHashtags] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [services, setServices] = useState([]);
  
  const fileInputRef = useRef(null);
  const locationRef = useRef(null);

  useEffect(() => {
    async function loadMetadata() {
      const [locResult, schedResult] = await Promise.all([
        fetchLocations(),
        fetchInstructorSchedule()
      ]);
      if (locResult.data) setLocations(locResult.data);
      if (schedResult.data?.services) setServices(schedResult.data.services);
    }
    loadMetadata();
  }, []);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files).slice(0, 5);
    if (!selectedFiles.length) return;
    
    setLoading(true);
    try {
      const compressed = await Promise.all(
        selectedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      
      const previewUrls = compressed.map(file => URL.createObjectURL(file));
      
      setFiles(selectedFiles);
      setCompressedFiles(compressed);
      setPreviews(previewUrls);
      setStep(2);
    } catch (err) {
      console.error('Compression failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = (index) => {
    const newPreviews = previews.filter((_, i) => i !== index);
    const newCompressed = compressedFiles.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    setCompressedFiles(newCompressed);
    
    if (newPreviews.length === 0) {
      setStep(1);
    } else if (currentIndex >= newPreviews.length) {
      setCurrentIndex(newPreviews.length - 1);
    }
  };

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    loc.country?.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const filteredServices = services.filter(svc => 
    svc.title.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const handleShare = async () => {
    if (!compressedFiles.length) return;
    
    setLoading(true);
    try {
      // 1. Upload to storage
      const uploadResult = await uploadPostMedia(compressedFiles);
      if (uploadResult.error) throw new Error(uploadResult.error);
      
      // 2. Create post record
      const postResult = await createPost({
        imageUrls: uploadResult.data,
        caption,
        locationId: selectedLocation?.id || null,
        serviceId: selectedService?.id || null,
        hashtags: caption.match(/#[\w\u4e00-\u9fa5]+/g)?.map(tag => tag.slice(1)) || [],
        aspectRatio: 0.8 // Standard IG 4:5
      });
      
      if (postResult.error) throw new Error(postResult.error);
      
      onPostCreated();
      onClose();
    } catch (err) {
      alert(`Failed to create post: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-gnd-cream px-4">
          {step === 2 && !loading ? (
            <button onClick={() => setStep(1)} className="text-gnd-dark hover:text-gnd-red">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="w-6" />
          )}
          <h2 className="text-sm font-black uppercase tracking-widest text-gnd-dark">
            {step === 1 ? 'Create New Post' : 'Edit Post'}
          </h2>
          {!loading && step === 2 ? (
            <button 
              onClick={handleShare}
              className="text-sm font-black text-blue-500 hover:text-blue-600 uppercase tracking-widest"
            >
              Share
            </button>
          ) : (
            <button onClick={onClose} className="text-gnd-dark hover:text-gnd-red">
              <X size={20} />
            </button>
          )}
        </header>

        {/* Content */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="grid h-[500px] place-items-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-gnd-red" />
                <p className="text-sm font-black uppercase tracking-widest text-gnd-gray">Processing...</p>
              </div>
            </div>
          ) : step === 1 ? (
            <div 
              className="grid h-[500px] place-items-center border-2 border-dashed border-gnd-cream m-4 rounded-xl cursor-pointer hover:bg-gnd-cream/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-gnd-cream/30 p-6 text-gnd-red">
                  <ImageIcon size={48} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gnd-dark">Drag photos here</h3>
                  <p className="mt-2 text-sm font-bold text-gnd-gray">Upload up to 5 photos</p>
                </div>
                <button className="mt-4 rounded-lg bg-gnd-red px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-red-600/20">
                  Select from computer
                </button>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="grid h-[500px] grid-cols-1 md:grid-cols-[1.2fr_1fr]">
              {/* Media Preview */}
              <div className="relative bg-black group overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentIndex}
                    src={previews[currentIndex]}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full object-contain"
                  />
                </AnimatePresence>
                
                {previews.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : previews.length - 1))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={() => setCurrentIndex(prev => (prev < previews.length - 1 ? prev + 1 : 0))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {previews.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 w-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/50'}`} 
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Thumbnail Rail */}
                <div className="absolute bottom-12 left-4 right-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {previews.map((src, i) => (
                    <div key={i} className="relative shrink-0">
                      <img 
                        src={src} 
                        onClick={() => setCurrentIndex(i)}
                        className={`h-16 w-16 rounded-md object-cover cursor-pointer border-2 transition-all ${i === currentIndex ? 'border-white scale-105' : 'border-transparent opacity-70'}`}
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(i); }}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {previews.length < 5 && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-white/50 bg-white/10 text-white hover:bg-white/20"
                    >
                      <Plus size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sidebar Form */}
              <div className="flex flex-col border-l border-gnd-cream overflow-y-auto">
                {/* Profile Header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="h-8 w-8 rounded-full bg-gnd-cream animate-pulse" />
                  <p className="text-sm font-black text-gnd-dark">Your Post</p>
                </div>

                {/* Caption Area */}
                <div className="px-4">
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Write a caption..."
                    className="h-32 w-full resize-none bg-transparent py-2 text-sm font-bold text-gnd-dark outline-none placeholder:text-gnd-gray/50"
                  />
                </div>

                {/* Metadata Pickers */}
                <div className="flex-1 space-y-4 border-t border-gnd-cream p-4">
                  {/* Location Picker */}
                  <div className="relative space-y-2">
                    <label 
                      htmlFor="location-search"
                      className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gnd-gray"
                    >
                      <MapPin size={14} className="text-gnd-red" />
                      Add Location
                    </label>
                    
                    {selectedLocation ? (
                      <div className="flex items-center justify-between rounded-lg border border-gnd-red bg-gnd-red/5 px-3 py-2">
                        <span className="text-sm font-bold text-gnd-dark">{selectedLocation.name}</span>
                        <button 
                          onClick={() => setSelectedPostLocation(null)}
                          className="text-gnd-red hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          id="location-search"
                          ref={locationRef}
                          type="text"
                          value={locationSearch}
                          onChange={(e) => {
                            setLocationSearch(e.target.value);
                            setShowLocationResults(true);
                          }}
                          onFocus={() => setShowLocationResults(true)}
                          placeholder="Search for a location..."
                          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/10 px-3 py-2 text-sm font-bold text-gnd-dark outline-none focus:ring-1 focus:ring-gnd-red"
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
                                  key={loc.id}
                                  onClick={() => {
                                    setSelectedPostLocation(loc);
                                    setShowLocationResults(false);
                                    setLocationSearch('');
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gnd-cream/30"
                                >
                                  <MapPin size={14} className="text-gnd-gray" />
                                  <div>
                                    <p className="text-sm font-black text-gnd-dark">{loc.name}</p>
                                    {loc.country && <p className="text-[10px] font-bold text-gnd-gray uppercase">{loc.country}</p>}
                                  </div>
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
                    )}
                  </div>

                  {/* Service Linker */}
                  <div className="relative space-y-2">
                    <label 
                      htmlFor="service-search"
                      className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gnd-gray"
                    >
                      <Tag size={14} className="text-gnd-red" />
                      Link to Service
                    </label>
                    
                    {selectedService ? (
                      <div className="flex items-center justify-between rounded-lg border border-gnd-red bg-gnd-red/5 px-3 py-2">
                        <span className="text-sm font-bold text-gnd-dark">{selectedService.title}</span>
                        <button 
                          onClick={() => setSelectedService(null)}
                          className="text-gnd-red hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          id="service-search"
                          type="text"
                          value={serviceSearch}
                          onChange={(e) => {
                            setServiceSearch(e.target.value);
                            setShowServiceResults(true);
                          }}
                          onFocus={() => setShowServiceResults(true)}
                          placeholder="Search for your services..."
                          className="w-full rounded-lg border border-gnd-cream bg-gnd-cream/10 px-3 py-2 text-sm font-bold text-gnd-dark outline-none focus:ring-1 focus:ring-gnd-red"
                        />
                        
                        <AnimatePresence>
                          {showServiceResults && serviceSearch.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gnd-cream bg-white shadow-xl"
                            >
                              {filteredServices.length > 0 ? filteredServices.map(svc => (
                                <button
                                  key={svc.id}
                                  onClick={() => {
                                    setSelectedService(svc);
                                    setShowServiceResults(false);
                                    setServiceSearch('');
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gnd-cream/30"
                                >
                                  <Tag size={14} className="text-gnd-gray" />
                                  <p className="text-sm font-black text-gnd-dark">{svc.title}</p>
                                </button>
                              )) : (
                                <div className="px-4 py-6 text-center text-xs font-bold text-gnd-gray">
                                  No services found for "{serviceSearch}"
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer hints */}
                <div className="border-t border-gnd-cream bg-gnd-cream/10 p-4">
                  <p className="text-[10px] font-bold text-gnd-gray leading-relaxed">
                    Your post will be visible on the Explore wall immediately. Use hashtags in the caption to help learners find your content.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
