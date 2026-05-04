import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  upcoming: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  ongoing: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  completed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};


const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function formatDate(dateStr?: string) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EVENT_TYPES = ['Fun Run', 'Marathon', 'Trail Run', 'Triathlon', 'Cycling'];
const LOCATIONS = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Bali'];

export default function UserEventPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = events.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchLocation = locationFilter === 'all' || (e.location || '').toLowerCase() === locationFilter.toLowerCase();
    let matchDate = true;
    if (selectedDate && e.eventDate) {
      const ed = new Date(e.eventDate);
      matchDate = ed.getFullYear() === calYear && ed.getMonth() === calMonth && ed.getDate() === selectedDate;
    }
    return matchSearch && matchStatus && matchLocation && matchDate;
  });

  const handleView = (slug: string) => {
    setNavigatingTo(slug);
    setTimeout(() => navigate(`/event/${slug}`), 800);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const dayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const eventDates = new Set(
    events.filter(e => e.eventDate).map(e => {
      const d = new Date(e.eventDate!);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) return d.getDate();
      return -1;
    }).filter(d => d > 0)
  );

  const uniqueLocations = [...new Set(events.map(e => e.location).filter(Boolean))];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#fafafa]" style={{ paddingTop: 64 }}>
        <div className="flex">

          {/* Sidebar */}
          <aside className={`
            fixed lg:sticky top-[64px] left-0 z-40 h-[calc(100vh-64px)] w-[280px] bg-white border-r border-gray-100
            overflow-y-auto transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Filter By</h2>
                <button
                  onClick={() => { setStatusFilter('all'); setLocationFilter('all'); setSelectedDate(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="Reset filters"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Calendar */}
              <div className="mb-6 border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">‹</button>
                  <span className="text-sm font-bold text-gray-800">{MONTHS[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">›</button>
                </div>
                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-400 mb-2">
                  {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 text-center text-sm gap-y-1">
                  {Array.from({ length: dayOffset }).map((_, i) => <span key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
                    const hasEvent = eventDates.has(day);
                    const isSelected = selectedDate === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(isSelected ? null : day)}
                        className={`w-8 h-8 mx-auto rounded-full text-xs font-medium transition-all
                          ${isSelected ? 'bg-red-500 text-white shadow-sm' : isToday ? 'bg-gray-900 text-white' : hasEvent ? 'text-red-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Event Type */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Event Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900 transition-colors">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-red-500 focus:ring-red-400" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Status</h3>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  <option value="all">All Status</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Location */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Location</h3>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  <option value="all">All Locations</option>
                  {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
                  {LOCATIONS.filter(l => !uniqueLocations.includes(l)).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </aside>

          {/* Sidebar Overlay (mobile) */}
          {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Top Bar */}
            <div className="sticky top-[64px] z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100">
              <div className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1z" /></svg>
                  </button>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Event</h1>
                    <p className="text-xs text-gray-500 mt-0.5">{filtered.length} event{filtered.length !== 1 ? 's' : ''} ditemukan</p>
                  </div>
                </div>
                <div className="relative w-full sm:w-72">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all" />
                </div>
              </div>
            </div>

            {/* Cards */}
            <div className="p-6">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                      <div className="h-44 bg-gray-200" />
                      <div className="p-5 space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-full" /></div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-24">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Belum ada event</h3>
                  <p className="text-sm text-gray-500">{search ? `Tidak ada event cocok "${search}"` : 'Event akan segera ditambahkan.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {filtered.map((event, i) => {
                    const status = event.status || 'upcoming';
                    const colors = STATUS_COLORS[status] || STATUS_COLORS.upcoming;
                    const hasBanner = !!event.bannerUrl && event.bannerUrl.startsWith('http');
                    return (
                      <div key={event.id} onClick={() => handleView(event.slug)}
                        className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
                        style={{ animation: `fadeUp 0.5s ease-out ${i * 0.06}s both` }}>
                        <div className="relative h-44 overflow-hidden">
                          {hasBanner ? (
                            <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex flex-col items-center justify-center p-6 text-center">
                              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{event.name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <div className={`absolute top-3 right-3 ${colors.bg} ${colors.text} px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-sm`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />{status.charAt(0).toUpperCase() + status.slice(1)}
                          </div>
                          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                            <p className="text-[11px] font-bold text-gray-900">{formatDate(event.eventDate)}</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1.5 group-hover:text-red-600 transition-colors line-clamp-2">{event.name}</h3>
                          {event.description && <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{event.description}</p>}
                          {event.location && (
                            <div className="flex items-center gap-1 text-gray-400 text-[11px] mb-2.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.categories && event.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {event.categories.slice(0, 3).map((cat, ci) => (
                                <span key={ci} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-medium rounded border border-gray-100">{cat}</span>
                              ))}
                              {event.categories.length > 3 && <span className="px-1.5 py-0.5 text-gray-400 text-[10px]">+{event.categories.length - 3}</span>}
                            </div>
                          )}
                        </div>
                        <div className="px-4 pb-3">
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${status === 'completed' ? 'bg-emerald-400 w-full' : status === 'ongoing' ? 'bg-red-500 w-2/3' : 'bg-amber-400 w-1/4'}`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>

        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        `}</style>

        {navigatingTo && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <img src="/Assets/logo2.gif" alt="Loading" className="w-20 h-20 mb-4" />
            <div className="w-10 h-10 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold text-gray-500 tracking-widest uppercase animate-pulse">Loading...</p>
          </div>
        )}
      </div>
    </>
  );
}
