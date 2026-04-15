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

  const toggleDQ = async (epc: string) => {
    const next = { ...dqMap, [epc]: !dqMap[epc] };
    if (!next[epc]) delete next[epc];
    setDqMap(next);
    saveDQMap(next, eventId);
    onDataVersionBump();
    onConfigChanged();
  };

  return (
    <>
      {/* DSQ Management */}
      <div className="card">
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
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Desktop Table - hidden on mobile */}
        <div className="hidden md:block table-wrap">
          <table className="f1-table">
            <thead>
              <tr>
                <th className="col-bib">BIB</th>
                <th>NAME</th>
                <th className="col-gender">GENDER</th>
                <th className="col-cat">CATEGORY</th>
                <th style={{ width: 120 }}>STATUS</th>
                <th style={{ width: 120 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isDQ = !!dqMap[r.epc];
                return (
                  <tr key={r.epc} className="row-hover">
                    <td className="mono">{r.bib}</td>
                    <td className="name-cell">{r.name}</td>
                    <td>{r.gender}</td>
                    <td>{r.category}</td>
                    <td className="mono strong">{isDQ ? "DSQ" : "OK"}</td>
                    <td>
                      <button
                        className="btn ghost"
                        onClick={() => toggleDQ(r.epc)}
                      >
                        {isDQ ? "Undo DSQ" : "Disqualify"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Tidak ada peserta yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - visible only on mobile */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Tidak ada peserta yang cocok.</div>
          ) : (
            filtered.map((r) => {
              const isDQ = !!dqMap[r.epc];
              return (
                <div key={r.epc} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">{r.name}</div>
                      <div className="text-sm text-gray-500">
                        <span className="mono">BIB: {r.bib}</span>
                        <span className="mx-2">·</span>
                        <span>{r.gender}</span>
                      </div>
                      <div className="text-xs text-gray-400">{r.category}</div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        isDQ 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {isDQ ? "DSQ" : "OK"}
                    </span>
                  </div>
                  <button
                    className={`btn w-full text-sm ${isDQ ? '' : 'ghost'}`}
                    onClick={() => toggleDQ(r.epc)}
                  >
                    {isDQ ? "Undo DSQ" : "Disqualify"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-400 rounded-lg text-blue-900 text-sm">
          <strong>Info:</strong> Total {Object.values(dqMap).filter(Boolean).length} peserta di-DSQ.
        </div>
      </div>
    </>
  );
}
