// src/pages/UserEventPage.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";


interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string;
  banner?: string;
  imageUrl?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  date?: string;
  categories?: string[];
  status?: 'upcoming' | 'ongoing' | 'completed';
}

export default function UserEventPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch events dari API
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        setEvents(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch events:', err);
        setLoading(false);
      });
  }, []);

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const handleViewLeaderboard = (eventSlug: string) => {
    setNavigatingTo(eventSlug);
    // Simulate loading animation for the premium "entering event" feel
    setTimeout(() => {
      navigate(`/event/${eventSlug}`);
    }, 1200);
  };



  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-white relative flex flex-col mt-8">
        {/* Triathlon subtle watermark */}
        <div className="absolute inset-0 bg-[url('/images/events/triathlon_bg_transparent.png')] bg-repeat opacity-40 mix-blend-multiply pointer-events-none" />
        
        {/* Header */}
        <div className="text-center py-6 md:py-12 px-4 relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter mb-2 text-stone-900 uppercase">
            Leaderboards
          </h1>
          <p className="text-sm md:text-lg text-stone-500 font-bold tracking-widest uppercase">
            Select an event to view official results and routes
          </p>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}} />
        </div>

        {/* Header and Carousel Section */}
        <div className="flex-1 w-full px-4 md:px-8 pb-20 relative z-10">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-500">
              <div className="w-16 h-16 border-4 border-stone-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
              <p className="font-bold tracking-widest uppercase animate-pulse">Loading Event Data...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 md:py-20 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-4 text-sm md:text-base">No events available yet.</p>
              <button
                onClick={() => navigate("/")}
                className="bg-accent text-white px-5 py-2.5 md:px-6 md:py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm md:text-base"
              >
                Go Home
              </button>
            </div>
          ) : (
            /* Main Leaderboard List */
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
              {events.map((event, eventIdx) => {
                const fallbackImages = [
                  '/images/events/dummy_marathon.png',
                  '/images/events/dummy_triathlon.png',
                  '/images/events/dummy_cycling.png'
                ];
                const bgImg = event.banner || event.imageUrl || fallbackImages[eventIdx % fallbackImages.length];

                return (
                  <div
                    key={event.id}
                    className="w-full bg-white rounded-[24px] p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-stone-100 transition-shadow duration-300 cursor-pointer flex flex-col md:flex-row gap-4 sm:gap-6"
                    onClick={() => handleViewLeaderboard(event.slug)}
                    style={{ animation: `fadeInUp 0.6s ease-out ${eventIdx * 0.15}s both` }}
                  >

                    {/* Content Column */}
                    <div className="flex-1 flex flex-col justify-center py-2 md:py-4">
                      {/* Sub-info Row: Date & Categories */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-stone-500 text-xs sm:text-sm font-medium mb-2">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-[#cbd5e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{event.date || 'Tanggal TBD'}</span>
                        </div>
                        
                        {event.categories && event.categories.length > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-stone-300 hidden sm:block"></span>
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-[#cbd5e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{event.categories.slice(0, 3).join(', ')}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[#1e293b] leading-snug mb-2 md:mb-3">
                        {event.name}
                      </h3>

                      {/* Location */}
                      {event.location && (
                        <div className="flex items-center gap-1.5 text-[#64748b] text-sm">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Column (Far Right) */}
                    <div className="md:w-48 pl-0 md:pl-6 border-t md:border-t-0 md:border-l border-stone-100 flex flex-col items-start md:items-end justify-center pt-4 md:pt-0 gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewLeaderboard(event.slug);
                        }}
                        className="w-full md:w-auto px-6 py-2.5 border-2 border-red-200 text-red-500 bg-transparent rounded-full font-bold text-sm tracking-wide hover:bg-neutral-50 hover:text-red-600 transition-colors flex items-center justify-center"
                      >
                        Lihat Detail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>



        {/* Loading Overlay Animation */}
        {navigatingTo && (
           <div className="splash-screen">
             <img src="/Assets/logo2.gif" alt="IJT Logo" className="splash-screen__logo" />
             <span className="splash-screen__text">Loading...</span>
           </div>
        )}
      </div>
    </>
  );
}
