import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadMasterParticipants } from "../lib/data";
import { Html5Qrcode } from "html5-qrcode";
import { Search, QrCode, X, CheckCircle } from "lucide-react";
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
      {rpcBgUrl && <div className="absolute inset-0 bg-white/60 z-0 backdrop-blur-[2px]" />}
      
      <div className="flex-1 flex flex-col p-6 lg:p-12 h-screen max-h-screen max-w-7xl mx-auto w-full relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-200 pb-6 mb-8 gap-6">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black uppercase text-gray-900 tracking-tight">{eventData.name}</h1>
            <h2 className="text-xl text-red-600 font-bold uppercase tracking-wider mt-1">Race Pack Collection</h2>
          </div>
          
          {/* Search Tools (Top Right) */}
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => { setIsScanning(!isScanning); setScanError(""); }}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-lg transition-all border-2 ${
                isScanning 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <QrCode className="w-6 h-6" />
              <span className="hidden sm:inline">{isScanning ? 'Tutup Scanner' : 'Scan QR'}</span>
            </button>
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 md:flex-initial">
              <input 
                type="text" 
                placeholder="Cari BIB atau Nama..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-white border-2 border-gray-200 text-gray-900 px-6 py-3 rounded-2xl text-lg font-bold focus:border-red-500 focus:outline-none placeholder-gray-400 w-full md:w-80 transition-colors"
              />
              <button 
                type="submit" 
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-2xl transition-all flex items-center justify-center"
              >
                <Search className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative bg-white border-2 border-dashed border-gray-300 rounded-[2.5rem] p-6 lg:p-12 overflow-hidden">
          
          {/* Scanner Area */}
          {isScanning && !foundParticipant && (
            <div className="fixed inset-0 bg-stone-950/95 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center p-4">
              <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-[110]">
                <button 
                  className="bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700 text-stone-300 hover:text-white rounded-full p-3 backdrop-blur-md transition-all duration-300"
                  onClick={() => {
                    setIsScanning(false);
                    setScanError("");
                  }}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="text-center text-white mb-8 z-[105]">
                <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tighter">Validasi Peserta</h2>
                <p className="text-stone-400 font-medium max-w-xs mx-auto text-sm">Arahkan kamera ke QR Code / Barcode tiket peserta.</p>
              </div>

              <div className="relative w-full max-w-sm aspect-square bg-stone-900 rounded-[2.5rem] overflow-hidden border-8 border-stone-800/50 shadow-2xl z-[105]">
                {/* Target reticle overlay */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-12">
                  <div className="w-full h-full border-2 border-white/20 rounded-[2rem] relative">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-[2rem]" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-[2rem]" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-[2rem]" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-[2rem]" />
                  </div>
                </div>
                <div id="rpc-qr-reader" ref={qrReaderRef} className="w-full h-full object-cover relative z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
              </div>

              {scanError && (
                <div className="mt-6 text-sm font-bold text-red-500 bg-stone-900/80 px-6 py-3 rounded-full border border-red-900/50 backdrop-blur-md z-[105]">
                  {scanError}
                </div>
              )}
            </div>
          )}

          {/* Participant Data Display */}
          {foundParticipant ? (
            <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                <div>
                  <div className="text-gray-400 font-bold tracking-widest uppercase text-sm mb-2">Nama Peserta</div>
                  <h2 className="text-5xl lg:text-6xl font-black text-gray-900 uppercase tracking-tight leading-tight">
                    {foundParticipant.name}
                  </h2>
                </div>
                <div className="bg-white border-2 border-dashed border-red-500 text-red-600 px-10 py-6 rounded-3xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-sm font-bold uppercase tracking-widest text-red-400 mb-1">Nomor BIB</span>
                  <span className="text-6xl font-black tracking-tighter">{foundParticipant.bib}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Kategori</div>
                  <div className="text-2xl font-black text-gray-900">{foundParticipant.category || foundParticipant.sourceCategoryKey}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Gender</div>
                  <div className="text-2xl font-black text-gray-900">{foundParticipant.gender || '-'}</div>
                </div>
                <div className="bg-green-50 border border-green-200 p-6 rounded-2xl">
                  <div className="text-green-600 font-bold uppercase tracking-widest text-xs mb-2">Status</div>
                  <div className="text-2xl font-black text-green-700 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6" /> Terverifikasi
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-center">
                <button 
                  onClick={() => setFoundParticipant(null)}
                  className="bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 px-8 py-4 rounded-2xl text-xl font-bold transition-all w-full md:w-auto text-center"
                >
                  Selesai & Cari Peserta Lain
                </button>
              </div>
            </div>
          ) : (
            // Idle State
            !isScanning && (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                <div className="bg-gray-100 p-8 rounded-full mb-6">
                  <Search className="w-16 h-16 text-gray-400" />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
