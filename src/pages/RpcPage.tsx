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

  const rpcBgUrl = eventData?.content?.rpcBgUrl;
  const isVideoBg = rpcBgUrl && (rpcBgUrl.toLowerCase().endsWith('.mp4') || rpcBgUrl.toLowerCase().endsWith('.webm') || rpcBgUrl.toLowerCase().endsWith('.mov'));
  const bannerUrl = eventData?.bannerUrl || eventData?.homeImageUrl;

  return (
    <div 
      className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col relative overflow-hidden"
      style={rpcBgUrl && !isVideoBg ? { backgroundImage: `url(${rpcBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {isVideoBg && (
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={rpcBgUrl}
        />
      )}
      {/* Increased opacity for better background visibility, changed from white/60 blur to dark/40 without blur to see it clearly */}
      {rpcBgUrl && <div className="absolute inset-0 bg-black/40 z-0" />}
      
      {/* Main Container */}
      <div className="flex flex-col h-screen max-h-screen w-full relative z-10 overflow-y-auto">
        
        {/* GRAND BANNER HEADER */}
        <div 
           className="w-full h-48 md:h-64 lg:h-80 bg-red-700 relative flex flex-col items-center justify-center shrink-0 shadow-2xl border-b-4 border-red-900"
           style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
           {bannerUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />}
           <div className="relative z-10 text-center px-4 mt-8">
             <h1 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase text-white tracking-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
               {eventData.name}
             </h1>
             <h2 className="text-lg md:text-2xl text-red-100 font-bold uppercase tracking-widest mt-3 drop-shadow-md bg-red-900/60 inline-block px-6 py-2 rounded-full backdrop-blur-md border border-red-500/50">
               Race Pack Collection
             </h2>
           </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 flex flex-col items-center max-w-6xl mx-auto w-full p-6 lg:p-10">
          
          {/* Main Interface */}
          {!foundParticipant && !isScanning && (
            <div className="flex-1 flex flex-col items-center justify-center w-full animate-in fade-in slide-in-from-bottom-10 duration-500">
               
               {/* Instruction Text */}
               <h3 className="text-lg md:text-2xl font-black text-white bg-black/70 px-8 py-5 rounded-full backdrop-blur-md border border-white/20 shadow-2xl text-center mb-12 uppercase tracking-widest leading-relaxed">
                 SILAKAN PINDAI QR CODE <span className="text-red-400">ATAU</span> MASUKKAN NOMOR BIB ANDA
               </h3>

               {/* Options Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                 
                 {/* Option 1: SCAN */}
                 <button 
                   onClick={() => { setIsScanning(true); setScanError(""); }}
                   className="group flex flex-col items-center justify-center bg-white/95 hover:bg-white backdrop-blur-xl border-[6px] border-transparent hover:border-red-500 text-gray-900 p-10 rounded-[2.5rem] transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(220,38,38,0.4)] hover:-translate-y-2 cursor-pointer relative overflow-hidden"
                 >
                   <div className="absolute top-4 left-6 text-xl font-black uppercase tracking-widest text-gray-300 group-hover:text-red-200 transition-colors">
                     Opsi 1
                   </div>
                   
                   <div className="bg-red-50 text-red-600 p-8 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 border-2 border-red-100">
                     <QrCode className="w-16 h-16" />
                   </div>
                   
                   <div className="text-4xl font-black uppercase tracking-tight text-gray-900 group-hover:text-red-600 transition-colors">
                     SCAN QR
                   </div>
                   <p className="text-gray-500 mt-3 text-center font-medium">Arahkan kamera ke QR Code peserta</p>
                 </button>

                 {/* Option 2: KETIK */}
                 <div className="flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl border-[6px] border-transparent focus-within:border-gray-800 text-gray-900 p-10 rounded-[2.5rem] transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative">
                   <div className="absolute top-4 left-6 text-xl font-black uppercase tracking-widest text-gray-300">
                     Opsi 2
                   </div>

                   <div className="bg-gray-100 text-gray-600 p-8 rounded-full mb-6 border-2 border-gray-200">
                     <Keyboard className="w-16 h-16" />
                   </div>
                   
                   <div className="text-4xl font-black uppercase tracking-tight text-gray-900 mb-6">
                     KETIK MANUAL
                   </div>
                   
                   <form onSubmit={handleSearch} className="w-full flex flex-col gap-3">
                     <input 
                       type="text" 
                       placeholder="Cari BIB atau Nama..." 
                       value={query}
                       onChange={(e) => setQuery(e.target.value)}
                       className="bg-gray-50 border-2 border-gray-200 text-gray-900 px-6 py-4 rounded-2xl text-xl font-bold focus:border-gray-800 focus:bg-white focus:outline-none placeholder-gray-400 w-full transition-all text-center"
                     />
                     <button 
                       type="submit" 
                       className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-3 font-bold text-lg w-full shadow-lg"
                     >
                       <Search className="w-6 h-6" /> CARI
                     </button>
                   </form>
                 </div>
                 
               </div>
            </div>
          )}

          {/* Scanner Area */}
          {isScanning && !foundParticipant && (
            <div className="absolute inset-0 bg-stone-950/95 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-xl">
              <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-[110]">
                <button 
                  className="bg-stone-800 hover:bg-red-600 border border-stone-700 text-stone-300 hover:text-white rounded-full p-4 transition-all duration-300 shadow-2xl"
                  onClick={() => {
                    setIsScanning(false);
                    setScanError("");
                  }}
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="text-center text-white mb-10 z-[105]">
                <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter text-white drop-shadow-lg">PINDAI QR CODE</h2>
                <p className="text-stone-300 font-medium max-w-sm mx-auto text-lg bg-stone-900/50 px-6 py-2 rounded-full border border-stone-800">Arahkan kamera ke QR Code peserta</p>
              </div>

              <div className="relative w-full max-w-md aspect-square bg-stone-900 rounded-[3rem] overflow-hidden border-[12px] border-stone-800 shadow-[0_0_100px_rgba(0,0,0,0.8)] z-[105]">
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-12">
                  <div className="w-full h-full border-4 border-white/30 rounded-[2.5rem] relative">
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-8 border-l-8 border-red-500 rounded-tl-[2.5rem]" />
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-8 border-r-8 border-red-500 rounded-tr-[2.5rem]" />
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-8 border-l-8 border-red-500 rounded-bl-[2.5rem]" />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-8 border-r-8 border-red-500 rounded-br-[2.5rem]" />
                  </div>
                </div>
                <div id="rpc-qr-reader" ref={qrReaderRef} className="w-full h-full object-cover relative z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
              </div>

              {scanError && (
                <div className="mt-8 text-lg font-bold text-red-100 bg-red-900/90 px-8 py-4 rounded-full border-2 border-red-500 shadow-2xl z-[105] animate-in slide-in-from-bottom-5">
                  {scanError}
                </div>
              )}
            </div>
          )}

          {/* Participant Data Display */}
          {foundParticipant && (
            <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full animate-in fade-in zoom-in-95 duration-300 bg-white/95 backdrop-blur-xl p-8 lg:p-12 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] border-4 border-gray-100 my-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                <div>
                  <div className="text-gray-400 font-bold tracking-widest uppercase text-sm mb-2">Nama Peserta</div>
                  <h2 className="text-5xl lg:text-6xl font-black text-gray-900 uppercase tracking-tight leading-tight">
                    {foundParticipant.name}
                  </h2>
                </div>
                <div className="bg-red-50 border-4 border-dashed border-red-500 text-red-600 px-12 py-8 rounded-[2.5rem] flex flex-col items-center justify-center shrink-0 shadow-inner">
                  <span className="text-sm font-bold uppercase tracking-widest text-red-400 mb-2">Nomor BIB</span>
                  <span className="text-7xl font-black tracking-tighter drop-shadow-md">{foundParticipant.bib}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-100 border-2 border-gray-200 p-8 rounded-[2rem]">
                  <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Kategori</div>
                  <div className="text-3xl font-black text-gray-900">{foundParticipant.category || foundParticipant.sourceCategoryKey}</div>
                </div>
                <div className="bg-gray-100 border-2 border-gray-200 p-8 rounded-[2rem]">
                  <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Gender</div>
                  <div className="text-3xl font-black text-gray-900">{foundParticipant.gender || '-'}</div>
                </div>
                <div className="bg-green-50 border-2 border-green-400 p-8 rounded-[2rem]">
                  <div className="text-green-600 font-bold uppercase tracking-widest text-xs mb-2">Status</div>
                  <div className="text-3xl font-black text-green-700 flex items-center gap-3">
                    <CheckCircle className="w-8 h-8" /> Terverifikasi
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-center">
                <button 
                  onClick={() => {
                    setFoundParticipant(null);
                    setQuery("");
                  }}
                  className="bg-gray-900 hover:bg-black text-white px-10 py-5 rounded-2xl text-xl font-bold transition-all w-full md:w-auto text-center shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                  Selesai & Cari Peserta Lain
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
