import { useMemo, useState, useEffect } from "react";
import type { LeaderRow } from "../../LeaderboardTable";

interface DQPageProps {
  allRows: LeaderRow[];
  onConfigChanged: () => void;
  onDataVersionBump: () => void;
  eventId: string;
}

export default function DQPage({ allRows, onConfigChanged, onDataVersionBump, eventId }: DQPageProps) {
  const [q, setQ] = useState("");
  const [dqMap, setDqMap] = useState<Record<string, boolean>>({});
  const [dqReasonMap, setDqReasonMap] = useState<Record<string, string>>({});
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>({});
  const [dqModalRunner, setDqModalRunner] = useState<{
    epc: string;
    bib: string;
    name: string;
    category?: string;
    reason: string;
  } | null>(null);
  const [savingDqReason, setSavingDqReason] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/runner-status?eventId=${eventId}`);
        if (res.ok) {
          const data = await res.json();
          const nextDq: Record<string, boolean> = {};
          const nextDqReasons: Record<string, string> = {};
          const nextHidden: Record<string, boolean> = {};
          if (Array.isArray(data)) {
            data.forEach((s: any) => {
              if (s.isDQ) {
                nextDq[s.epc] = true;
                if (s.dqReason) nextDqReasons[s.epc] = s.dqReason;
              }
              if (s.isHidden) nextHidden[s.epc] = true;
            });
          }
          setDqMap(nextDq);
          setDqReasonMap(nextDqReasons);
          setHiddenMap(nextHidden);
        }
      } catch (err) {
        console.error("Failed to load runner status:", err);
      }
    }
    loadStatus();
  }, [eventId]);

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

  const toggleDQ = async (epc: string, bib: string) => {
    const nextVal = !dqMap[epc];
    const next = { ...dqMap };
    const nextReasons = { ...dqReasonMap };
    if (!nextVal) {
      delete next[epc];
      delete nextReasons[epc];
    } else {
      next[epc] = true;
    }
    setDqMap(next);
    setDqReasonMap(nextReasons);
    
    try {
      await fetch('/api/runner-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          epc,
          bib,
          isDQ: nextVal,
          dqReason: nextVal ? (nextReasons[epc] || null) : null,
          isHidden: !!hiddenMap[epc]
        })
      });
    } catch (e) { console.error(e); }

    onDataVersionBump();
    onConfigChanged();
  };

  const handleSaveDQ = async (epc: string, bib: string, reason: string) => {
    setSavingDqReason(true);
    const trimmedReason = reason.trim();
    const next = { ...dqMap, [epc]: true };
    const nextReasons = { ...dqReasonMap };
    if (trimmedReason) {
      nextReasons[epc] = trimmedReason;
    } else {
      delete nextReasons[epc];
    }
    setDqMap(next);
    setDqReasonMap(nextReasons);

    try {
      await fetch('/api/runner-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          epc,
          bib,
          isDQ: true,
          dqReason: trimmedReason || null,
          isHidden: !!hiddenMap[epc]
        })
      });
      onDataVersionBump();
      onConfigChanged();
      setDqModalRunner(null);
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan diskualifikasi');
    } finally {
      setSavingDqReason(false);
    }
  };

  const toggleHide = async (epc: string, bib: string) => {
    const nextVal = !hiddenMap[epc];
    const next = { ...hiddenMap, [epc]: nextVal };
    if (!nextVal) delete next[epc];
    setHiddenMap(next);
    
    try {
      await fetch('/api/runner-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, epc, bib, isDQ: !!dqMap[epc], isHidden: nextVal })
      });
    } catch (e) { console.error(e); }

    onDataVersionBump();
    onConfigChanged();
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* DSQ Management */}
      <div className="card flex-1 flex flex-col mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Disqualification & Hidden (Manual)</h2>
            <div className="subtle text-sm">
              Toggle DSQ per runner (by EPC). DSQ tetap tampil di tabel tapi tanpa rank. <br/>
              Toggle Hide untuk menyembunyikan runner dari result (Soft Delete).
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
                  <th style={{ minWidth: 180, maxWidth: 240 }}>STATUS</th>
                  <th style={{ minWidth: 200, width: 220 }}>ACTION</th>
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
                        <td className="text-xs">
                          <div>{r.category}</div>
                          {r.ageCategory && (
                            <div className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {r.ageCategory}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-normal break-words" style={{ minWidth: 180, maxWidth: 240 }}>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${isDQ ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {isDQ ? "DSQ" : "OK"}
                          </span>
                          {hiddenMap[r.epc] && (
                            <span className="inline-block ml-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-stone-200 text-stone-600">
                              HIDDEN
                            </span>
                          )}
                          {isDQ && dqReasonMap[r.epc] && (
                            <div className="text-[11px] text-red-500 font-normal italic mt-0.5 whitespace-normal break-words leading-tight" title={dqReasonMap[r.epc]}>
                              &ldquo;{dqReasonMap[r.epc]}&rdquo;
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1 items-center">
                            {isDQ ? (
                              <>
                                <button
                                  className="btn ghost sm"
                                  onClick={() =>
                                    setDqModalRunner({
                                      epc: r.epc,
                                      bib: r.bib || '',
                                      name: r.name,
                                      category: r.category,
                                      reason: dqReasonMap[r.epc] || '',
                                    })
                                  }
                                >
                                  Reason
                                </button>
                                <button
                                  className="btn ghost sm"
                                  onClick={() => toggleDQ(r.epc, r.bib || '')}
                                >
                                  Undo DSQ
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn ghost sm"
                                onClick={() =>
                                  setDqModalRunner({
                                    epc: r.epc,
                                    bib: r.bib || '',
                                    name: r.name,
                                    category: r.category,
                                    reason: '',
                                  })
                                }
                              >
                                Disqualify
                              </button>
                            )}
                            <button
                              className="btn ghost sm"
                              style={{ color: '#dc2626' }}
                              onClick={() => toggleHide(r.epc, r.bib || '')}
                            >
                              {hiddenMap[r.epc] ? "Unhide" : "Hide"}
                            </button>
                          </div>
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
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{r.name}</div>
                        <div className="text-sm text-gray-500">
                          <span className="mono font-bold">BIB: {r.bib}</span>
                          <span className="mx-2">·</span>
                          <span className="uppercase text-xs">{r.gender}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {r.category}
                          {r.ageCategory && <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold">{r.ageCategory}</span>}
                        </div>
                        {isDQ && dqReasonMap[r.epc] && (
                          <div className="text-[11px] text-red-500 font-normal italic mt-1 break-words leading-tight">
                            &ldquo;{dqReasonMap[r.epc]}&rdquo;
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                            isDQ 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {isDQ ? "DSQ" : "OK"}
                        </span>
                        {hiddenMap[r.epc] && (
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-stone-200 text-stone-600">
                            HIDDEN
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isDQ ? (
                        <>
                          <button
                            className="btn ghost w-full text-xs font-bold uppercase"
                            onClick={() =>
                              setDqModalRunner({
                                epc: r.epc,
                                bib: r.bib || '',
                                name: r.name,
                                category: r.category,
                                reason: dqReasonMap[r.epc] || '',
                              })
                            }
                          >
                            Reason
                          </button>
                          <button
                            className="btn ghost w-full text-xs font-bold uppercase"
                            onClick={() => toggleDQ(r.epc, r.bib || '')}
                          >
                            Undo DSQ
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn ghost w-full text-xs font-bold uppercase"
                          onClick={() =>
                            setDqModalRunner({
                              epc: r.epc,
                              bib: r.bib || '',
                              name: r.name,
                              category: r.category,
                              reason: '',
                            })
                          }
                        >
                          Disqualify
                        </button>
                      )}
                      <button
                        className="btn ghost w-full text-xs font-bold uppercase"
                        style={{ color: '#dc2626' }}
                        onClick={() => toggleHide(r.epc, r.bib || '')}
                      >
                        {hiddenMap[r.epc] ? "Unhide" : "Hide"}
                      </button>
                    </div>
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
          <strong>Summary:</strong> {Object.values(dqMap).filter(Boolean).length} runners disqualified, {Object.values(hiddenMap).filter(Boolean).length} runners hidden.
        </div>

        {/* DSQ Reason Modal */}
        {dqModalRunner && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setDqModalRunner(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 font-black text-sm">
                    DSQ
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">
                      {dqMap[dqModalRunner.epc] ? "Ubah Alasan Diskualifikasi" : "Diskualifikasi Peserta"}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Tetapkan status dan alasan DSQ untuk peserta
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDqModalRunner(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 pt-5 pb-3">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase font-extrabold tracking-wider text-gray-400">Peserta</div>
                    <div className="text-base font-black text-gray-900">{dqModalRunner.name}</div>
                    {dqModalRunner.category && (
                      <div className="text-xs text-gray-500 font-semibold">{dqModalRunner.category}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase font-extrabold tracking-wider text-gray-400">BIB</div>
                    <div className="text-base font-mono font-black text-red-600">{dqModalRunner.bib || "-"}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Pilihan Alasan Cepat
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Memotong rute lari (Shortcut)",
                      "Melewati batas cut-off waktu",
                      "Menggunakan nomor BIB orang lain",
                      "Bantuan tidak sah dari pihak luar",
                      "Perilaku tidak sportif",
                      "Tidak melalui checkpoint resmi",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setDqModalRunner((prev) => (prev ? { ...prev, reason: preset } : null))
                        }
                        className="text-[11px] font-semibold px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 rounded-lg border border-gray-200 transition-colors text-left"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Alasan Diskualifikasi <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full text-sm rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                    placeholder="Tuliskan alasan diskualifikasi secara jelas..."
                    value={dqModalRunner.reason}
                    onChange={(e) =>
                      setDqModalRunner((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                    }
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Alasan ini akan ditampilkan langsung di preview hasil peserta.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setDqModalRunner(null)}
                  disabled={savingDqReason}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn sm bg-red-600 hover:bg-red-700 text-white font-bold border-none"
                  disabled={savingDqReason}
                  onClick={() =>
                    handleSaveDQ(dqModalRunner.epc, dqModalRunner.bib, dqModalRunner.reason)
                  }
                >
                  {savingDqReason ? "Menyimpan..." : "Simpan Diskualifikasi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
