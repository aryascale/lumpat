import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";

interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string;
  eventDate?: string;
  location?: string;
  categories?: string[];
  status?: 'upcoming' | 'ongoing' | 'completed';
  isActive?: boolean;
  bannerUrl?: string;
}

const CATEGORY_TABS = ["All", "Running", "Cycling", "Festival"];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1552674605-15cff24f36e6?auto=format&fit=crop&q=80&w=800&h=600",
  "https://images.unsplash.com/photo-1476480862126-209bcaa8ea6a?auto=format&fit=crop&q=80&w=800&h=600",
  "https://images.unsplash.com/photo-1540329064121-6571b0586e37?auto=format&fit=crop&q=80&w=800&h=600",
];

function formatDate(dateStr?: string) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UserEventPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(search.toLowerCase());
    
    // Category filtering logic (using exact match if present, otherwise text fallback)
    const matchesTab = activeTab === "All" || (e.categories && e.categories.includes(activeTab)) || e.name.toLowerCase().includes(activeTab.toLowerCase());

    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status?: string) => {
    if (status === 'ongoing') {
      return (
        <div className="absolute top-4 left-4 bg-red-600/90 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 z-10">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Live Timing
        </div>
      );
    }
    if (status === 'upcoming' || !status) { // fallback
      return (
        <div className="absolute top-4 left-4 bg-emerald-500/90 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 z-10">
          <span className="w-1.5 h-1.5 bg-white rounded-full" />
          Open Reg
        </div>
      );
    }
    return (
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full shadow-sm z-10">
        Finished
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#F1F3F6]" style={{ paddingTop: 64 }}>
        
        {/* Header & Controls Section */}
        <section className="bg-white border-b border-gray-200/60 sticky top-[64px] z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            
            {/* Title Row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none mb-2">
                  Eksplorasi Event
                </h1>
                <p className="text-slate-500 font-medium text-sm">
                  Temukan tantangan lari dan festival terbaik di Indonesia.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center bg-slate-100 text-slate-800 font-bold text-lg w-10 h-10 rounded-xl">
                  {filteredEvents.length}
                </span>
                <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Event<br/>Ditemukan</span>
              </div>
            </div>

            {/* Controls Row (Search & Filters) */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              
              {/* Filter Carousel (Mobile optimized) */}
              <div className="w-full lg:w-auto overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex items-center gap-2 pb-1">
                  {CATEGORY_TABS.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`whitespace-nowrap px-5 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                        activeTab === tab 
                          ? "bg-slate-900 text-white shadow-md" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-[400px]">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Cari nama event lari atau festival..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all shadow-sm placeholder:text-slate-400" 
                />
              </div>

            </div>

          </div>
        </section>

        {/* Event Grid Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-[420px] animate-pulse border border-slate-200/60 shadow-sm" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="w-24 h-24 mx-auto mb-6 bg-slate-50 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tidak Ada Event</h3>
              <p className="text-sm text-slate-500">Coba sesuaikan filter atau kata kunci pencarian Anda.</p>
            </div>
          ) : (
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
            >
              <AnimatePresence mode="popLayout">
                {filteredEvents.map((event, i) => {
                  const hasBanner = !!event.bannerUrl;
                  const dateStr = formatDate(event.eventDate);
                  const tags = event.categories?.length ? event.categories : ["10K", "5K", "Fun Run"];
                  const imageSrc = hasBanner ? event.bannerUrl : FALLBACK_IMAGES[i % FALLBACK_IMAGES.length];
                  const priceText = event.status === 'upcoming' || !event.status ? "Mulai dari IDR 150K" : "Selesai";

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      whileHover={{ y: -6 }}
                      whileTap={{ scale: 0.98 }}
                      key={event.id}
                      onClick={() => navigate(`/event/${event.slug}`)}
                      className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                    >
                      {/* Upper Visual Area (Aspect Ratio 4:3) */}
                      <div className="relative w-full pt-[65%] bg-slate-100 overflow-hidden">
                        {getStatusBadge(event.status)}
                        
                        {event.location && (
                          <div className="absolute top-4 right-4 bg-slate-900/60 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 z-10">
                            <span>📍</span> {event.location}
                          </div>
                        )}

                        <img 
                          src={imageSrc} 
                          alt={event.name} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <span className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-widest mb-2">
                          {dateStr}
                        </span>
                        
                        <h3 className="font-black text-slate-900 text-lg md:text-xl leading-tight mb-3 line-clamp-2">
                          {event.name}
                        </h3>

                        <div className="flex flex-wrap gap-2 mt-auto">
                          {tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between mt-auto bg-slate-50/50">
                        <span className="text-[12px] font-bold text-slate-500">
                          {priceText}
                        </span>
                        <button className="px-5 py-2 bg-slate-900 text-white text-[11px] uppercase tracking-wider font-bold rounded-full hover:bg-slate-800 transition-colors flex items-center gap-1.5 group-hover:bg-blue-600">
                          {event.status === 'completed' ? 'Cek Hasil' : 'Daftar'} 
                          <span className="text-sm font-normal group-hover:translate-x-0.5 transition-transform">➔</span>
                        </button>
                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}

        </main>

        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </>
  );
}
