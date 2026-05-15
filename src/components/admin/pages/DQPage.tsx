import { useMemo, useState } from "react";
import type { LeaderRow } from "../../LeaderboardTable";

interface DQPageProps {
  allRows: LeaderRow[];
  onConfigChanged: () => void;
  onDataVersionBump: () => void;
  eventId: string;
}

function loadDQMap(eventId: string): Record<string, boolean> {
  try {
    const key = `imr_dq_map_${eventId}`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveDQMap(map: Record<string, boolean>, eventId: string) {
  const key = `imr_dq_map_${eventId}`;
  localStorage.setItem(key, JSON.stringify(map));
}

export default function DQPage({ allRows, onConfigChanged, onDataVersionBump, eventId }: DQPageProps) {
  const [q, setQ] = useState("");
  const [dqMap, setDqMap] = useState<Record<string, boolean>>(loadDQMap(eventId));

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return allRows;
    return allRows.filter(
      (r) =>
        (r.bib || "").toLowerCase().includes(qq) ||
        (r.name || "").toLowerCase().includes(qq)
    );
  }, [q, allRows]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentRows = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [q]);

  const toggleDQ = async (epc: string) => {
    const next = { ...dqMap, [epc]: !dqMap[epc] };
    if (!next[epc]) delete next[epc];
    setDqMap(next);
    saveDQMap(next, eventId);
    onDataVersionBump();
    onConfigChanged();
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* DSQ Management */}
      <div className="card flex-1 flex flex-col mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Disqualification (Manual)</h2>
            <div className="subtle text-sm">
              Toggle DSQ per runner (by EPC). DSQ tetap tampil di tabel tapi tanpa rank.
            </div>
          </div>
          <input
            className="search w-full sm:w-64"
            placeholder="Search BIB / Name…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
          />
        </div>

        <div className="flex-1 overflow-auto">
          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block table-wrap">
            <table className="f1-table compact">
              <thead>
                <tr>
                  <th className="col-bib">BIB</th>
                  <th>NAME</th>
                  <th className="col-gender">GENDER</th>
                  <th className="col-cat">CATEGORY</th>
                  <th style={{ width: 100 }}>STATUS</th>
                  <th style={{ width: 120 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty py-20">
                      Tidak ada peserta ditemukan.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((r) => {
                    const isDQ = !!dqMap[r.epc];
                    return (
                      <tr key={r.epc} className="row-hover">
                        <td className="mono text-xs font-bold">{r.bib}</td>
                        <td className="name-cell text-sm">{r.name}</td>
                        <td className="text-xs uppercase">{r.gender}</td>
                        <td className="text-xs">{r.category}</td>
                        <td>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${isDQ ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {isDQ ? "DSQ" : "OK"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn ghost sm"
                            onClick={() => toggleDQ(r.epc)}
                          >
                            {isDQ ? "Undo DSQ" : "Disqualify"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible only on mobile */}
          <div className="md:hidden space-y-3">
            {currentRows.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Tidak ada peserta ditemukan.</div>
            ) : (
              currentRows.map((r) => {
                const isDQ = !!dqMap[r.epc];
                return (
                  <div key={r.epc} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{r.name}</div>
                        <div className="text-sm text-gray-500">
                          <span className="mono font-bold">BIB: {r.bib}</span>
                          <span className="mx-2">·</span>
                          <span className="uppercase text-xs">{r.gender}</span>
                        </div>
                        <div className="text-xs text-gray-400">{r.category}</div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          isDQ 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isDQ ? "DSQ" : "OK"}
                      </span>
                    </div>
                    <button
                      className={`btn w-full text-xs font-bold uppercase ${isDQ ? '' : 'ghost'}`}
                      onClick={() => toggleDQ(r.epc)}
                    >
                      {isDQ ? "Undo DSQ" : "Disqualify"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> runners
            </div>
            <div className="flex gap-1">
              <button
                className="btn ghost sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Simple windowing for page numbers
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 3 + i + 1;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return p;
              }).map(page => (
                <button
                  key={page}
                  className={`btn sm w-8 h-8 p-0 flex items-center justify-center ${currentPage === page ? '' : 'ghost'}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="btn ghost sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs font-medium">
          <strong>Summary:</strong> {Object.values(dqMap).filter(Boolean).length} runners disqualified.
        </div>
      </div>
    </div>
  );
}
