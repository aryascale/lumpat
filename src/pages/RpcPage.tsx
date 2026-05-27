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
        const res = await fetch(`/api/events/slug/${slug}`);
        if (!res.ok) throw new Error("Event not found");
        const data = await res.json();
        setEventData(data);

        // Load master data
        if (data && data.id) {
          const loadedParticipants = await loadMasterParticipants(data.id);
          setParticipants(loadedParticipants);
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
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="animate-pulse text-3xl font-black tracking-widest text-white">LOADING...</div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-3xl font-black text-red-500 uppercase tracking-widest">Event Not Found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans flex flex-col relative overflow-hidden">
      {/* Decorative Background for Videotron */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-yellow-500 rounded-full blur-[150px] translate-y-1/3 -translate-x-1/3"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-8 lg:p-16 h-screen max-h-screen">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-4 border-stone-800 pb-8 mb-12">
          <div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter uppercase text-white mb-2">{eventData.name}</h1>
            <h2 className="text-2xl lg:text-3xl text-red-500 font-bold tracking-widest">RACE PACK COLLECTION</h2>
          </div>
          
          {/* Search Tools (Top Right) */}
          <div className="flex gap-4">
            <button 
              onClick={() => { setIsScanning(!isScanning); setScanError(""); }}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-2xl transition-all ${isScanning ? 'bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)]' : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'}`}
            >
              <QrCode className="w-8 h-8" />
              {isScanning ? 'Tutup Scanner' : 'Scan QR'}
            </button>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Cari BIB / Nama..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-stone-800 border-2 border-stone-700 text-white px-8 py-4 rounded-2xl text-2xl font-bold focus:border-red-500 focus:outline-none placeholder-stone-500 w-96"
              />
              <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl">
                <Search className="w-8 h-8" />
              </button>
            </form>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center relative">
          
          {/* Scanner Overlay */}
          {isScanning && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-900/90 backdrop-blur-md rounded-3xl border-4 border-stone-700 p-8">
              <h3 className="text-3xl font-bold text-white mb-8 flex items-center gap-4">
                <QrCode className="w-10 h-10 text-red-500" />
                Arahkan QR Code Peserta ke Kamera
              </h3>
              <div className="relative w-[500px] h-[500px] rounded-3xl overflow-hidden border-8 border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.3)] bg-black">
                <div id="rpc-qr-reader" ref={qrReaderRef} className="w-full h-full" />
              </div>
              {scanError && (
                <div className="mt-8 text-2xl text-red-400 bg-red-900/50 px-8 py-4 rounded-xl border border-red-800">
                  {scanError}
                </div>
              )}
              <button 
                onClick={() => setIsScanning(false)}
                className="mt-8 bg-stone-800 text-white px-10 py-4 rounded-full text-xl font-bold hover:bg-stone-700 flex items-center gap-3"
              >
                <X className="w-6 h-6" /> Batalkan Scan
              </button>
            </div>
          )}

          {/* Participant Data Display */}
          {foundParticipant ? (
            <div className="w-full max-w-7xl w-full mx-auto bg-gradient-to-br from-stone-800 to-stone-900 border-l-[16px] border-red-600 rounded-[3rem] p-16 lg:p-24 shadow-2xl animate-in slide-in-from-bottom-12 fade-in duration-700 relative overflow-hidden">
              
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="flex flex-col gap-12 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-stone-400 font-bold tracking-[0.3em] uppercase text-2xl mb-4">Participant Name</div>
                    <h2 className="text-7xl lg:text-8xl font-black text-white leading-tight uppercase tracking-tighter">
                      {foundParticipant.name}
                    </h2>
                  </div>
                  <div className="bg-red-600 text-white px-12 py-6 rounded-3xl flex flex-col items-center justify-center shadow-xl transform rotate-3">
                    <span className="text-xl font-bold uppercase tracking-widest opacity-80 mb-2">BIB Number</span>
                    <span className="text-7xl font-black font-mono tracking-tighter">{foundParticipant.bib}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-8 pt-12 border-t-4 border-stone-700/50">
                  <div className="bg-stone-950/50 p-8 rounded-3xl border border-stone-800">
                    <div className="text-stone-500 font-bold uppercase tracking-widest text-lg mb-2">Kategori</div>
                    <div className="text-4xl font-black text-white">{foundParticipant.category || foundParticipant.sourceCategoryKey}</div>
                  </div>
                  <div className="bg-stone-950/50 p-8 rounded-3xl border border-stone-800">
                    <div className="text-stone-500 font-bold uppercase tracking-widest text-lg mb-2">Gender</div>
                    <div className="text-4xl font-black text-white">{foundParticipant.gender || '-'}</div>
                  </div>
                  <div className="bg-stone-950/50 p-8 rounded-3xl border border-stone-800">
                    <div className="text-stone-500 font-bold uppercase tracking-widest text-lg mb-2">Status</div>
                    <div className="text-4xl font-black text-green-400 flex items-center gap-3">
                      <CheckCircle className="w-10 h-10" /> Terverifikasi
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mt-8">
                  <button 
                    onClick={() => setFoundParticipant(null)}
                    className="text-stone-400 hover:text-white text-xl font-medium border-b-2 border-stone-600 hover:border-white transition-all pb-1"
                  >
                    Tutup & Cari Baru
                  </button>
                </div>
              </div>

            </div>
          ) : (
            // Idle State
            !isScanning && (
              <div className="text-center opacity-30 flex flex-col items-center">
                <Search className="w-32 h-32 mb-8" />
                <h3 className="text-5xl font-black uppercase tracking-widest">Silakan Cari Peserta</h3>
                <p className="text-2xl mt-4">Ketik nama/BIB atau scan QR code peserta.</p>
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}
