import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadMasterParticipants } from "../lib/data";
import { Html5Qrcode } from "html5-qrcode";
import { Search, QrCode, X, CheckCircle, Keyboard } from "lucide-react";
import type { LeaderRow } from "../components/LeaderboardTable";

export default function RpcPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState<any>(null);
  const [participants, setParticipants] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [foundParticipant, setFoundParticipant] = useState<LeaderRow | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const qrReaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events?eventId=${slug}`);
        if (!res.ok) throw new Error("Event not found");
        const data = await res.json();
        setEventData(data);

        // Load master data
        if (data && data.id) {
          const loadedParticipants = await loadMasterParticipants(data.id);
          // BUG FIX: loadMasterParticipants returns an object {all, byCategoryKey, ...}
          setParticipants(loadedParticipants.all as any);
        }
      } catch (err) {
        console.error("Error loading RPC data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug]);

  // QR Code Scanner Logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isScanning && qrReaderRef.current) {
      html5QrCode = new Html5Qrcode("rpc-qr-reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 300 } },
        (decodedText) => {
          // Find participant
          const p = participants.find(p => p.epc === decodedText || String(p.bib) === decodedText);
          if (p) {
            setFoundParticipant(p);
            setIsScanning(false); // Auto stop scanning on success
          } else {
            setScanError("QR Code tidak cocok dengan data peserta.");
          }
        },
        (error) => {
          // Ignore frequent scan errors
        }
      ).catch(err => {
        console.error("Error starting scanner", err);
        setScanError("Gagal mengakses kamera. Periksa izin browser.");
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
      }
    };
  }, [isScanning, participants]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;

    const p = participants.find(p => String(p.bib).toLowerCase() === q || p.name.toLowerCase().includes(q));
    if (p) {
      setFoundParticipant(p);
      setQuery("");
    } else {
      setFoundParticipant(null);
      alert("Peserta tidak ditemukan.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-3xl font-black tracking-widest text-gray-900">LOADING...</div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-3xl font-black text-red-500 uppercase tracking-widest">Event Not Found</div>
      </div>
    );
  }

  const bgImage = eventData?.content?.rpcBgUrl || eventData?.bannerUrl || eventData?.homeImageUrl;
  const isVideoBg = bgImage && (bgImage.toLowerCase().endsWith('.mp4') || bgImage.toLowerCase().endsWith('.webm') || bgImage.toLowerCase().endsWith('.mov'));

  return (
    <div 
      className="min-h-screen bg-gray-900 text-gray-900 font-sans flex flex-col relative overflow-hidden"
      style={bgImage && !isVideoBg ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {isVideoBg && (
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={bgImage}
        />
      )}
      {/* Dark overlay so the text/UI is still readable but background is clearly visible */}
      {bgImage && <div className="absolute inset-0 bg-black/20 z-0" />}
      
      {/* Main Container */}
      <div className="flex flex-col h-screen max-h-screen w-full relative z-10 overflow-hidden">
        
        {/* Top Logo / Title Area - Only show if no banner image is provided, to keep it super clean */}
        {!bgImage && (
          <div className="w-full pt-12 flex flex-col items-center justify-center shrink-0">
             <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase text-white tracking-tight drop-shadow-md">
               {eventData.name}
             </h1>
             <h2 className="text-lg md:text-xl text-red-400 font-bold uppercase tracking-widest mt-2 drop-shadow-md">
               Race Pack Collection
             </h2>
          </div>
        )}

        {/* Floating Bottom Action Bar (Duolingo Style) */}
        {!foundParticipant && !isScanning && (
          <div className="absolute bottom-8 lg:bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-3 md:p-4 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-b-[8px] border-gray-300 flex flex-col sm:flex-row gap-3 md:gap-4">
               
               <form onSubmit={handleSearch} className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Cari Nomor BIB atau Nama..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-gray-100 border-2 border-gray-200 border-b-[6px] text-gray-900 px-6 py-4 md:py-5 rounded-[2rem] text-lg md:text-xl font-bold focus:border-blue-400 focus:border-b-[6px] focus:translate-y-0 focus:outline-none placeholder-gray-400 transition-all"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-[calc(50%+3px)] bg-blue-500 hover:bg-blue-400 active:border-b-0 active:translate-y-[calc(-50%+3px)] border-blue-700 border-b-[4px] text-white p-3 rounded-2xl transition-all">
                     <Search className="w-6 h-6 stroke-[3]" />
                  </button>
               </form>

               <button 
                 type="button"
                 onClick={() => { setIsScanning(true); setScanError(""); }}
                 className="bg-green-500 hover:bg-green-400 border-green-700 border-b-[6px] active:border-b-0 active:translate-y-[6px] text-white px-8 py-4 md:py-5 rounded-[2rem] flex items-center justify-center transition-all shrink-0"
               >
                  <QrCode className="w-8 h-8 md:w-10 md:h-10 stroke-[2.5]" />
               </button>
            </div>
          </div>
        )}

        {/* Scanner Area */}
        {isScanning && !foundParticipant && (
          <div className="absolute inset-0 bg-stone-900/95 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-xl">
            <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-[110]">
              <button 
                className="bg-stone-700 hover:bg-stone-600 border-stone-900 border-b-[6px] active:border-b-0 active:translate-y-[6px] text-white rounded-[2rem] p-4 transition-all"
                onClick={() => {
                  setIsScanning(false);
                  setScanError("");
                }}
              >
                <X className="w-8 h-8 stroke-[3]" />
              </button>
            </div>

            <div className="text-center text-white mb-8 z-[105]">
              <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter drop-shadow-lg text-green-400">SCAN TIKET</h2>
              <p className="text-stone-300 font-bold bg-stone-800/80 px-6 py-3 rounded-2xl border-b-4 border-stone-900">Arahkan kamera ke QR Code peserta</p>
            </div>

            <div className="relative w-full max-w-md aspect-square bg-stone-950 rounded-[3rem] overflow-hidden border-[8px] border-stone-800 border-b-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[105]">
              <div id="rpc-qr-reader" ref={qrReaderRef} className="w-full h-full object-cover relative z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
            </div>

            {scanError && (
              <div className="mt-8 text-lg font-bold text-white bg-red-500 border-red-700 border-b-[6px] px-8 py-4 rounded-[2rem] z-[105] animate-in slide-in-from-bottom-5">
                {scanError}
              </div>
            )}
          </div>
        )}

        {/* Participant Data Display */}
        {foundParticipant && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-2xl border-b-[12px] border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
              <div className="bg-green-100 text-green-500 p-4 rounded-[2rem] mb-6 border-b-[6px] border-green-200">
                 <CheckCircle className="w-12 h-12 stroke-[3]" />
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 uppercase tracking-tight mb-2 leading-tight">
                {foundParticipant.name}
              </h2>
              <div className="text-xl md:text-2xl font-bold text-gray-400 mb-8 uppercase tracking-widest">
                {foundParticipant.category || foundParticipant.sourceCategoryKey} • {foundParticipant.gender || '-'}
              </div>

              <div className="bg-red-50 border-4 border-red-400 border-b-[10px] rounded-[2.5rem] px-12 py-8 mb-10 w-full max-w-sm">
                 <div className="text-red-400 font-bold tracking-widest uppercase mb-2">NOMOR BIB</div>
                 <div className="text-7xl md:text-8xl font-black text-red-500 tracking-tighter drop-shadow-sm">
                   {foundParticipant.bib}
                 </div>
              </div>

              <button 
                onClick={() => {
                  setFoundParticipant(null);
                  setQuery("");
                }}
                className="bg-blue-500 hover:bg-blue-400 border-blue-700 border-b-[8px] active:border-b-0 active:translate-y-[8px] text-white px-12 py-5 rounded-[2rem] text-2xl font-black uppercase tracking-widest transition-all w-full md:w-auto"
              >
                SELESAI
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
