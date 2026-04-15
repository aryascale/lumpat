import { useMemo, useState } from "react";
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
        className={`bg-white border-l-4 p-4 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${
          isTop10 && showTop10Badge ? "border-l-yellow-400" : isSpecial ? "border-l-red-500 bg-red-50/30" : "border-l-stone-800"
        }`}
        onClick={() => onSelect?.(r)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
             <span className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg ${getPosStyle(r.rank)}`}>
               {pos}
             </span>
             <div>
               <div className="font-extrabold text-stone-900 tracking-tight leading-tight">{r.name || "-"}</div>
               <div className="text-xs font-mono font-semibold tracking-wider text-red-600 mt-0.5">BIB {r.bib || "-"}</div>
             </div>
          </div>
          <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Total Time</div>
              <div className={`font-mono text-lg font-black tracking-tighter ${isSpecial ? "text-orange-600" : "text-stone-900"}`}>
                {r.totalTimeDisplay}
              </div>
          </div>
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-stone-100 text-xs font-medium text-stone-500">
           <div>{r.gender || "-"}</div>
           <div className="w-1 h-1 rounded-full bg-stone-300 self-center"></div>
           <div>{r.category || "-"}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="editorial-table-wrapper w-full">
      {/* Champions Spotlight */}
      {top3.length > 0 && (
         <div className="mb-12 mt-4 px-4 sm:px-0">
             <div className="text-center mb-8">
               <h3 className="text-sm font-black tracking-[0.2em] text-red-600 uppercase mb-2">Podium</h3>
               <h2 className="text-3xl font-extrabold text-stone-900 tracking-tighter">Champions</h2>
             </div>
             <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-5xl mx-auto">
               
               {/* 2nd Place */}
               {top3[1] && (
                 <div onClick={() => onSelect?.(top3[1])} className="w-full md:w-1/3 order-2 md:order-1 bg-gradient-to-b from-stone-50 to-white border border-stone-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all cursor-pointer transform hover:-translate-y-2 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl italic">2</div>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-2xl font-black text-gray-800 shadow-lg mb-4 group-hover:scale-110 transition-transform">2</div>
                    <div className="font-extrabold text-xl text-stone-900 leading-tight mb-1">{top3[1].name}</div>
                    <div className="font-mono text-red-600 font-bold mb-4">BIB: {top3[1].bib}</div>
                    <div className="bg-stone-100 rounded-lg p-3">
                       <div className="text-[10px] uppercase font-bold text-stone-500 mb-1">Finish Time</div>
                       <div className="font-mono font-black text-lg text-stone-900">{top3[1].totalTimeDisplay}</div>
                    </div>
                 </div>
               )}

               {/* 1st Place */}
               {top3[0] && (
                 <div onClick={() => onSelect?.(top3[0])} className="w-full md:w-1/3 order-1 md:order-2 bg-gradient-to-b from-red-50 to-white border-2 border-red-500 rounded-2xl p-8 shadow-2xl hover:shadow-red-500/20 transition-all cursor-pointer transform md:-translate-y-8 hover:-translate-y-10 group relative overflow-hidden z-10">
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-8xl italic text-red-600">1</div>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center text-4xl font-black text-yellow-950 shadow-xl mb-6 group-hover:scale-110 transition-transform">1</div>
                    <div className="font-extrabold text-2xl text-stone-900 leading-tight mb-1">{top3[0].name}</div>
                    <div className="font-mono text-red-600 font-bold mb-6">BIB: {top3[0].bib}</div>
                    <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                       <div className="text-[11px] uppercase font-bold text-red-500 mb-1 tracking-wider">Champion Time</div>
                       <div className="font-mono font-black text-3xl tracking-tighter text-stone-900">{top3[0].totalTimeDisplay}</div>
                    </div>
                 </div>
               )}

               {/* 3rd Place */}
               {top3[2] && (
                 <div onClick={() => onSelect?.(top3[2])} className="w-full md:w-1/3 order-3 md:order-3 bg-gradient-to-b from-stone-50 to-white border border-stone-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all cursor-pointer transform hover:-translate-y-2 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl italic">3</div>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-600 flex items-center justify-center text-2xl font-black text-orange-950 shadow-lg mb-4 group-hover:scale-110 transition-transform">3</div>
                    <div className="font-extrabold text-xl text-stone-900 leading-tight mb-1">{top3[2].name}</div>
                    <div className="font-mono text-red-600 font-bold mb-4">BIB: {top3[2].bib}</div>
                    <div className="bg-stone-100 rounded-lg p-3">
                       <div className="text-[10px] uppercase font-bold text-stone-500 mb-1">Finish Time</div>
                       <div className="font-mono font-black text-lg text-stone-900">{top3[2].totalTimeDisplay}</div>
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

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden bg-white rounded-xl border-2 border-stone-100 shadow-sm">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-stone-50 border-b-2 border-stone-200 text-[11px] font-black tracking-widest text-stone-500 uppercase">
              <th className="px-6 py-4 w-16 text-center">Pos</th>
              <th className="px-6 py-4 w-24">BIB</th>
              <th className="px-6 py-4">Athlete Name</th>
              <th className="px-6 py-4">Gender</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Time of Day</th>
              <th className="px-6 py-4 text-right">Race Time</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100">
            {filtered.map((r) => {
              const pos = r.rank ?? "-";
              const isTop10 = r.rank != null && r.rank <= 10;
              const isSpecial = r.totalTimeDisplay === "DNF" || r.totalTimeDisplay === "DSQ";

              return (
                <tr
                  key={r.epc}
                  onClick={() => onSelect?.(r)}
                  className={`cursor-pointer transition-colors hover:bg-stone-50/80 ${
                    isTop10 && showTop10Badge ? "bg-yellow-50/30" : ""
                  } ${isSpecial ? "bg-red-50/50" : ""}`}
                >
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm ${getPosStyle(r.rank)}`}>
                      {pos}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      {r.bib || "-"}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="font-extrabold text-stone-900 tracking-tight">{r.name || "-"}</div>
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-stone-600">
                     {r.gender || "-"}
                  </td>
                  
                  <td className="px-6 py-4 text-sm font-medium text-stone-600">
                     {r.category || "-"}
                  </td>
                  
                  <td className="px-6 py-4 text-sm font-mono text-stone-500">
                     {r.finishTimeRaw || "-"}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-black text-lg tracking-tighter ${isSpecial ? "text-orange-600" : "text-stone-900"}`}>
                      {r.totalTimeDisplay}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center bg-stone-50">
                    <div className="font-black text-2xl text-stone-300 mb-2 tracking-tighter uppercase">No Tracking Data</div>
                    <div className="text-sm font-medium text-stone-500">
                      {rows.length === 0
                        ? "The leaderboards are currently empty."
                        : `No results found for "${q}".`}
                    </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
