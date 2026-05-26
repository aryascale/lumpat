import { useMemo, useState, useRef, useEffect } from "react";
import { exportLeaderboardCSV } from "../lib/csv";

export type LeaderRow = {
  rank: number | null;
  bib: string;
  name: string;
  gender: string;
  category: string;
  sourceCategoryKey: string;
  finishTimeRaw: string;
  totalTimeMs: number;
  totalTimeDisplay: string;
  epc: string;
};

export default function LeaderboardTable({
  title,
  rows,
  showTop10Badge = false,
  onSelect,
}: {
  title: string;
  rows: LeaderRow[];
  showTop10Badge?: boolean;
  onSelect?: (row: LeaderRow) => void;
}) {
  const [q, setQ] = useState("");
  const [isPodiumFullscreen, setIsPodiumFullscreen] = useState(false);
  const podiumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPodiumFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      podiumRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => 
      String(r.bib).toLowerCase().includes(query) || 
      (r.name && String(r.name).toLowerCase().includes(query))
    );
  }, [q, rows]);

  const top3 = useMemo(() => {
    if (q) return []; // Only show champions when not searching
    return [...rows].filter(r => r.rank != null && r.rank >= 1 && r.rank <= 3).sort((a,b) => a.rank! - b.rank!);
  }, [q, rows]);

  const handleExport = () => {
    exportLeaderboardCSV(
      filtered.map(
        (r) =>
          ({
            ...r,
            rank: r.rank ?? "-",
          } as any)
      ),
      `${title.replace(/\s+/g, "_")}.csv`
    );
  };

  const showingCount = filtered.length;

  const getPosStyle = (rank: number | null) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950 font-black shadow-lg shadow-yellow-200";
    if (rank === 2) return "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 font-black shadow-lg shadow-gray-200";
    if (rank === 3) return "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950 font-black shadow-lg shadow-orange-200/50";
    return "bg-black text-white font-bold opacity-80";
  };

  // Modern Sleek Card for Mobile
  const MobileCard = ({ r }: { r: LeaderRow }) => {
    const pos = r.rank ?? "-";
    const isTop10 = r.rank != null && r.rank <= 10;
    const isSpecial = r.totalTimeDisplay === "DNF" || r.totalTimeDisplay === "DSQ";

    return (
      <div
        className={`bg-white border-2 border-stone-200 border-b-[6px] rounded-2xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${
          isTop10 && showTop10Badge ? "border-yellow-200 bg-yellow-50/30" : isSpecial ? "border-red-300 bg-red-50/30" : ""
        }`}
        onClick={() => onSelect?.(r)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4 w-full">
             <span className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-xl ${getPosStyle(r.rank)}`}>
               {pos}
             </span>
             <div className="flex-1 min-w-0">
               <div className="font-extrabold text-stone-900 tracking-tight text-lg leading-tight mb-1 truncate">{r.name || "-"}</div>
               <span className="font-mono font-bold text-red-600 bg-red-50 border-2 border-red-100 border-b-4 px-2 py-0.5 rounded-lg text-xs inline-block">
                 BIB {r.bib || "-"}
               </span>
             </div>
          </div>
        </div>
        <div className="flex justify-between items-end pt-3 border-t-2 border-dashed border-stone-100">
           <div className="flex gap-2 text-xs font-bold text-stone-400">
             <div className="bg-stone-100 border-2 border-stone-200 border-b-[3px] px-2 py-1 rounded-lg">{r.gender || "-"}</div>
             <div className="bg-stone-100 border-2 border-stone-200 border-b-[3px] px-2 py-1 rounded-lg">{r.category || "-"}</div>
           </div>
           <div className="text-right">
              <div className="text-[10px] uppercase font-black text-stone-400 tracking-widest mb-1">Total Time</div>
              <div className={`font-mono text-xl font-black tracking-tighter bg-stone-100 border-2 border-stone-200 border-b-4 px-3 py-1 rounded-xl inline-block ${isSpecial ? "text-orange-600" : "text-stone-900"}`}>
                {r.totalTimeDisplay}
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="editorial-table-wrapper w-full">
      {/* Champions Spotlight */}
      {top3.length > 0 && (
         <div 
           ref={podiumRef}
           className={`bg-stone-50 relative overflow-hidden flex flex-col items-center shadow-sm ${
              isPodiumFullscreen ? "w-screen h-screen justify-center p-4 sm:p-8" : "mb-12 mt-4 border-2 border-stone-200 border-b-[8px] rounded-3xl p-6 sm:p-12 w-full"
           }`}
         >
             {/* Fullscreen Toggle Button */}
             <button 
               onClick={toggleFullscreen}
               className="absolute top-4 right-4 z-20 p-3 bg-white border-2 border-stone-200 border-b-[4px] rounded-xl text-stone-400 hover:text-stone-600 hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-[2px] transition-all shadow-sm"
               title={isPodiumFullscreen ? "Exit Fullscreen" : "Fullscreen"}
             >
                   {isPodiumFullscreen ? (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9h4.5M9 15v4.5M9 15H4.5M15 15v4.5M15 15h4.5" /></svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                   )}
                 </button>

                 {/* Decorative Background Elements */}
                 <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                   <div className="absolute -top-20 -left-20 w-64 h-64 bg-yellow-300 rounded-full blur-3xl"></div>
                   <div className="absolute top-40 -right-20 w-80 h-80 bg-red-300 rounded-full blur-3xl"></div>
                 </div>

                 <div className="text-center mb-8 sm:mb-12 relative z-10">
                   <h3 className="text-sm font-black tracking-[0.2em] text-red-600 uppercase mb-2">Podium</h3>
                   <h2 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tighter">Champions</h2>
                 </div>
                 
                 <div className="flex flex-row justify-center items-end gap-2 sm:gap-6 w-full max-w-5xl mx-auto relative z-10">
                   
                   {/* 2nd Place */}
                   {top3[1] && (
                     <div className="flex flex-col items-center justify-end w-1/3 order-1 group">
                        <div className="flex flex-col items-center mb-2 sm:mb-4 w-full px-1 sm:px-2 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-150">
                           <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xl sm:text-3xl font-black bg-slate-100 text-slate-500 group-hover:-translate-y-2 transition-transform">
                              {top3[1].name.charAt(0).toUpperCase()}
                           </div>
                           <div className="font-extrabold text-stone-800 text-[10px] sm:text-base text-center line-clamp-2 w-full mt-2 leading-tight">
                              {top3[1].name}
                           </div>
                           <div className="font-mono font-bold text-stone-500 text-[9px] sm:text-xs mt-0.5 mb-1 bg-white/50 px-2 rounded backdrop-blur-sm">
                              BIB {top3[1].bib}
                           </div>
                           <div className="bg-slate-200 border-2 border-slate-300 border-b-4 text-stone-900 font-mono font-black text-[10px] sm:text-sm px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-xl shadow-sm">
                              {top3[1].totalTimeDisplay}
                           </div>
                        </div>
                        
                        <div 
                          className="w-full h-32 sm:h-48 bg-slate-300 border-b-[8px] sm:border-b-[16px] border-slate-400 rounded-t-xl sm:rounded-t-3xl flex justify-center pt-4 sm:pt-8 cursor-pointer hover:brightness-105 transition-all shadow-inner"
                          onClick={() => onSelect?.(top3[1])}
                        >
                           <span className="text-5xl sm:text-7xl font-black text-black/10 drop-shadow-sm">2</span>
                        </div>
                     </div>
                   )}

                   {/* 1st Place */}
                   {top3[0] && (
                     <div className="flex flex-col items-center justify-end w-1/3 order-2 z-10 group">
                        <div className="flex flex-col items-center mb-2 sm:mb-4 w-full px-1 sm:px-2 animate-in slide-in-from-bottom-8 fade-in duration-500">
                           <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-2xl sm:text-4xl font-black bg-yellow-100 text-yellow-600 group-hover:-translate-y-2 transition-transform">
                              {top3[0].name.charAt(0).toUpperCase()}
                           </div>
                           <div className="font-extrabold text-stone-900 text-[11px] sm:text-lg text-center line-clamp-2 w-full mt-2 leading-tight">
                              {top3[0].name}
                           </div>
                           <div className="font-mono font-bold text-stone-500 text-[10px] sm:text-sm mt-0.5 mb-1 bg-white/50 px-2 rounded backdrop-blur-sm">
                              BIB {top3[0].bib}
                           </div>
                           <div className="bg-yellow-200 border-2 border-yellow-400 border-b-4 text-stone-900 font-mono font-black text-[11px] sm:text-base px-3 py-1 sm:px-5 sm:py-1.5 rounded-xl shadow-sm">
                              {top3[0].totalTimeDisplay}
                           </div>
                        </div>
                        
                        <div 
                          className="w-full h-40 sm:h-64 bg-yellow-400 border-b-[8px] sm:border-b-[16px] border-yellow-600 rounded-t-xl sm:rounded-t-3xl flex justify-center pt-4 sm:pt-10 cursor-pointer hover:brightness-105 transition-all relative overflow-hidden shadow-inner"
                          onClick={() => onSelect?.(top3[0])}
                        >
                           {/* Sparkle effect on 1st place */}
                           <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 group-hover:translate-x-full duration-700 transition-all -skew-x-12"></div>
                           <span className="text-6xl sm:text-8xl font-black text-black/10 drop-shadow-sm">1</span>
                        </div>
                     </div>
                   )}

                   {/* 3rd Place */}
                   {top3[2] && (
                     <div className="flex flex-col items-center justify-end w-1/3 order-3 group">
                        <div className="flex flex-col items-center mb-2 sm:mb-4 w-full px-1 sm:px-2 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300">
                           <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xl sm:text-3xl font-black bg-orange-100 text-orange-600 group-hover:-translate-y-2 transition-transform">
                              {top3[2].name.charAt(0).toUpperCase()}
                           </div>
                           <div className="font-extrabold text-stone-800 text-[10px] sm:text-base text-center line-clamp-2 w-full mt-2 leading-tight">
                              {top3[2].name}
                           </div>
                           <div className="font-mono font-bold text-stone-500 text-[9px] sm:text-xs mt-0.5 mb-1 bg-white/50 px-2 rounded backdrop-blur-sm">
                              BIB {top3[2].bib}
                           </div>
                           <div className="bg-orange-200 border-2 border-orange-300 border-b-4 text-stone-900 font-mono font-black text-[10px] sm:text-sm px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-xl shadow-sm">
                              {top3[2].totalTimeDisplay}
                           </div>
                        </div>
                        
                        <div 
                          className="w-full h-24 sm:h-40 bg-orange-400 border-b-[8px] sm:border-b-[16px] border-orange-600 rounded-t-xl sm:rounded-t-3xl flex justify-center pt-3 sm:pt-6 cursor-pointer hover:brightness-105 transition-all shadow-inner"
                          onClick={() => onSelect?.(top3[2])}
                        >
                           <span className="text-5xl sm:text-7xl font-black text-black/10 drop-shadow-sm">3</span>
                        </div>
                     </div>
                   )}
                 </div>
             </div>
      )}

      {/* Main Table Tools */}
      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 border-b-2 border-stone-900 pb-4 mb-6">
        <div>
          {title && <h2 className="text-2xl font-black tracking-tighter text-stone-900 uppercase">{title}</h2>}
          <div className="text-sm font-medium text-stone-500 tracking-wide mt-1">
            Displaying <span className="font-bold text-red-600">{showingCount}</span> verified entries
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full sm:w-64 pl-9 pr-4 py-2 border-2 border-stone-200 rounded-lg font-medium text-stone-800 placeholder-stone-400 focus:border-red-500 focus:ring-0 outline-none transition-colors"
              type="text"
              placeholder="Search BIB or Name..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="px-5 py-2 font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-transparent" onClick={() => setQ("")}>
            Reset
          </button>
          <button onClick={handleExport} className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-md hover:shadow-lg transition-all border border-red-700">
            Export CSV
          </button>
        </div>
      </div>

      {/* Mobile Feed View */}
      <div className="md:hidden space-y-4">
        {filtered.map((r) => (
          <MobileCard key={r.epc} r={r} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200 px-4">
            <div className="font-black text-xl text-stone-300 mb-2">NO RECORDS FOUND</div>
            <div className="text-sm font-medium text-stone-400">
              {rows.length === 0
                ? "Starting block is empty. Awaiting timing data."
                : "No matching BIBs or Names found."}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table View (Duolingo Style) */}
      <div className="hidden md:flex flex-col gap-3">
        {/* Header */}
        <div className="grid grid-cols-[80px_120px_minmax(200px,1fr)_120px_140px_120px_140px] gap-4 px-6 py-2 text-[11px] font-black tracking-widest text-stone-400 uppercase">
             <div className="text-center">Pos</div>
             <div>BIB</div>
             <div>Athlete Name</div>
             <div>Gender</div>
             <div>Category</div>
             <div>Time of Day</div>
             <div className="text-right">Race Time</div>
        </div>

        {/* Rows */}
        {filtered.map((r) => {
             const pos = r.rank ?? "-";
             const isTop10 = r.rank != null && r.rank <= 10;
             const isSpecial = r.totalTimeDisplay === "DNF" || r.totalTimeDisplay === "DSQ";
             
             return (
                 <div key={r.epc} onClick={() => onSelect?.(r)} className={`grid grid-cols-[80px_120px_minmax(200px,1fr)_120px_140px_120px_140px] gap-4 items-center px-6 py-4 bg-white rounded-2xl border-2 border-stone-200 border-b-[6px] cursor-pointer hover:-translate-y-1 hover:border-stone-300 transition-all ${isTop10 && showTop10Badge ? 'border-yellow-200 bg-yellow-50/50' : ''} ${isSpecial ? 'border-red-200 bg-red-50/50' : ''}`}>
                    <div className="text-center">
                       <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-lg ${getPosStyle(r.rank)}`}>
                          {pos}
                       </span>
                    </div>
                    <div>
                       <span className="font-mono font-bold text-red-600 bg-red-50 border-2 border-red-100 border-b-[4px] px-3 py-1.5 rounded-xl inline-block">
                          {r.bib || "-"}
                       </span>
                    </div>
                    <div>
                       <div className="font-extrabold text-stone-900 tracking-tight text-xl">{r.name || "-"}</div>
                    </div>
                    <div>
                       <span className="text-sm font-bold text-stone-500 bg-stone-100 border-2 border-stone-200 border-b-[3px] px-3 py-1.5 rounded-xl inline-block">{r.gender || "-"}</span>
                    </div>
                    <div>
                       <span className="text-sm font-bold text-stone-500 bg-stone-100 border-2 border-stone-200 border-b-[3px] px-3 py-1.5 rounded-xl inline-block">{r.category || "-"}</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-stone-400">{r.finishTimeRaw || "-"}</div>
                    <div className="text-right">
                       <span className={`font-mono font-black text-xl tracking-tighter bg-stone-100 border-2 border-stone-200 border-b-[4px] px-4 py-2 rounded-xl inline-block ${isSpecial ? "text-orange-600" : "text-stone-900"}`}>
                          {r.totalTimeDisplay}
                       </span>
                    </div>
                 </div>
             )
        })}

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center bg-stone-50 border-2 border-stone-200 border-b-[6px] rounded-2xl">
              <div className="font-black text-2xl text-stone-300 mb-2 tracking-tighter uppercase">No Tracking Data</div>
              <div className="text-sm font-medium text-stone-500">
                {rows.length === 0
                  ? "The leaderboards are currently empty."
                  : `No results found for "${q}".`}
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
