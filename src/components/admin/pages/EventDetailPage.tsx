// Admin Event Detail Page - for managing individual event data, CSV uploads, banners, categories
import { useState, useEffect, useMemo } from "react";
import { putCsvFile, deleteCsvFile, listCsvMeta } from "../../../lib/idb";
import { parseCsv, countDataRows } from "../../../lib/csvParse";
import { uploadBannerViaApi } from "../../../lib/storage";
import type { CsvKind } from "../../../lib/config";
import { LS_DATA_VERSION } from "../../../lib/config";
import { loadMasterParticipants, loadTimesMap } from "../../../lib/data";
import parseTimeToMs, { extractTimeOfDay, formatDuration } from "../../../lib/time";
import type { LeaderRow } from "../../LeaderboardTable";

interface EventDetailPageProps {
  eventId: string;
  eventSlug: string;
  eventName: string;
  onBack: () => void;
}

interface Banner {
  id: string;
  imageUrl: string;
  alt?: string;
  order: number;
  isActive: boolean;
}

// Helper function for timestamp formatting
function formatNowAsTimestamp(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`;
}

export default function EventDetailPage({ eventId, eventSlug, eventName, onBack }: EventDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'data' | 'banners' | 'categories' | 'route' | 'timing' | 'dq' | 'certified'>('data');
  const [csvMeta, setCsvMeta] = useState<Array<{ key: CsvKind; filename: string; updatedAt: number; rows: number }>>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Banner upload state
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Category state
  const [newCategory, setNewCategory] = useState('');

  // GPX upload state
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [uploadingGpx, setUploadingGpx] = useState(false);
  const [currentGpxPath, setCurrentGpxPath] = useState<string | null>(null);

  // Timing state
  const [cutoffHours, setCutoffHours] = useState("");
  const [catStart, setCatStart] = useState<Record<string, string>>({});
  const [savingTiming, setSavingTiming] = useState(false);

  // DQ state
  const [allRows, setAllRows] = useState<LeaderRow[]>([]);
  const [dqSearch, setDqSearch] = useState("");
  const [dqMap, setDqMap] = useState<Record<string, boolean>>({});
  const [eventData, setEventData] = useState<any>(null);

  // Certificate state
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certData, setCertData] = useState<{ hasCertificate: boolean; files: Array<{ filename: string; url: string; size: number; updatedAt: number }> }>({ hasCertificate: false, files: [] });

  // Load data
  useEffect(() => {
    loadAllData();
  }, [eventId]);

  // Load DQ data when switching to DQ tab
  useEffect(() => {
    if (activeTab === 'dq') {
      loadDQData();
    }
    if (activeTab === 'certified') {
      loadCertData();
    }
  }, [activeTab, eventId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load CSV meta
      const meta = await listCsvMeta(eventId);
      setCsvMeta(meta as any);

      // Load banners
      const bannersRes = await fetch(`/api/banners?eventId=${eventId}`);
      if (bannersRes.ok) {
        const data = await bannersRes.json();
        setBanners(Array.isArray(data) ? data : []);
      }

      // Load categories
      const catRes = await fetch(`/api/categories?eventId=${eventId}`);
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
      }

      // Load event data to get GPX file path and timing
      const eventRes = await fetch(`/api/events?eventId=${eventId}`);
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEventData(eventData);
        setCurrentGpxPath(eventData.gpxFile || null);

        // Load timing data
        if (eventData.cutoffMs != null) {
          setCutoffHours(String(eventData.cutoffMs / 3600000));
        } else {
          setCutoffHours("");
        }
        if (eventData.categoryStartTimes) {
          setCatStart(eventData.categoryStartTimes);
        } else {
          setCatStart({});
        }
      }
    } catch (error) {
      console.error('Failed to load event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDQData = async () => {
    try {
      const master = await loadMasterParticipants(eventId);
      const startMap = await loadTimesMap("start", eventId);
      const finishMap = await loadTimesMap("finish", eventId);

      const cutoffMs = eventData?.cutoffMs ?? null;
      const catStartRaw: Record<string, string> = (eventData?.categoryStartTimes as Record<string, string>) ?? {};

      // Load DQ map from localStorage
      const dqKey = `imr_dq_map_${eventId}`;
      let dqData: Record<string, boolean> = {};
      try {
        dqData = JSON.parse(localStorage.getItem(dqKey) || "{}");
      } catch {
        dqData = {};
      }
      setDqMap(dqData);

      const absOverrideMs: Record<string, number | null> = {};
      const timeOnlyStr: Record<string, string | null> = {};

      Object.entries(catStartRaw).forEach(([key, raw]) => {
        const s = String(raw || "").trim();
        if (!s) {
          absOverrideMs[key] = null;
          timeOnlyStr[key] = null;
          return;
        }
        if (/\d{4}-\d{2}-\d{2}/.test(s)) {
          const parsed = parseTimeToMs(s);
          absOverrideMs[key] = parsed.ms;
          timeOnlyStr[key] = null;
        } else {
          absOverrideMs[key] = null;
          timeOnlyStr[key] = s;
        }
      });

      function buildOverrideFromFinishDate(finishMs: number, timeStr: string): number | null {
        const m = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/);
        if (!m) return null;

        const h = Number(m[1] || 0);
        const mi = Number(m[2] || 0);
        const se = Number(m[3] || 0);
        const ms = m[4] ? Number(String(m[4]).padEnd(3, "0").slice(0, 3)) : 0;

        const d = new Date(finishMs);
        const override = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi, se, ms);
        return override.getTime();
      }

      const baseRows: LeaderRow[] = [];

      master.all.forEach((p) => {
        const finishEntry = finishMap.get(p.epc);
        if (!finishEntry?.ms) return;

        const catKey = p.sourceCategoryKey;
        const absMs = absOverrideMs[catKey] ?? null;
        const timeOnly = timeOnlyStr[catKey] ?? null;

        let total: number | null = null;

        if (absMs != null && Number.isFinite(absMs)) {
          const delta = finishEntry.ms - absMs;
          if (Number.isFinite(delta) && delta >= 0) {
            total = delta;
          } else {
            const startEntry = startMap.get(p.epc);
            if (!startEntry?.ms) return;
            total = finishEntry.ms - startEntry.ms;
          }
        } else if (timeOnly) {
          const builtOverride = buildOverrideFromFinishDate(finishEntry.ms, timeOnly);
          if (builtOverride != null) {
            const delta = finishEntry.ms - builtOverride;
            if (Number.isFinite(delta) && delta >= 0) {
              total = delta;
            } else {
              const startEntry = startMap.get(p.epc);
              if (!startEntry?.ms) return;
              total = finishEntry.ms - startEntry.ms;
            }
          } else {
            const startEntry = startMap.get(p.epc);
            if (!startEntry?.ms) return;
            total = finishEntry.ms - startEntry.ms;
          }
        } else {
          const startEntry = startMap.get(p.epc);
          if (!startEntry?.ms) return;
          total = finishEntry.ms - startEntry.ms;
        }

        if (!Number.isFinite(total) || total == null || total < 0) return;

        const isDQ = !!dqData[p.epc];
        const isDNF = cutoffMs != null && total > cutoffMs;

        baseRows.push({
          rank: null,
          bib: p.bib,
          name: p.name,
          gender: p.gender,
          category: p.category || p.sourceCategoryKey,
          sourceCategoryKey: p.sourceCategoryKey,
          finishTimeRaw: extractTimeOfDay(finishEntry.raw),
          totalTimeMs: total,
          totalTimeDisplay: isDQ ? "DSQ" : isDNF ? "DNF" : formatDuration(total),
          epc: p.epc,
        });
      });

      setAllRows(baseRows);
    } catch (error) {
      console.error('Failed to load DQ data:', error);
    }
  };

  const bumpDataVersion = () => {
    localStorage.setItem(LS_DATA_VERSION, String(Date.now()));
  };

  // CSV Upload handlers
  const uploadCsv = async (kind: CsvKind, file: File) => {
    const text = await file.text();
    const grid = parseCsv(text);

    if (!grid || grid.length === 0) {
      alert(`CSV '${kind}': File kosong atau tidak valid.`);
      return;
    }

    const headers = (grid[0] || []).map((x) => String(x || "").trim());
    const headersNorm = headers.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim());

    const headerAliases: Record<string, string[]> = {
      epc: ["epc", "uid", "tag", "rfid", "chip epc", "epc code"],
      times: ["times", "time", "timestamp", "start time", "finish time", "jam"],
    };

    if (kind === "master") {
      const epcAliases = headerAliases.epc.map((s) => s.toLowerCase());
      const hasEpc = headersNorm.some((h) => epcAliases.some((alias) => h === alias || h.includes(alias)));
      if (!hasEpc) {
        alert(`CSV '${kind}': kolom EPC tidak ditemukan.\nFormat Master CSV harus memiliki kolom EPC.`);
        return;
      }
    }

    if (kind !== "master") {
      const epcAliases = headerAliases.epc.map((s) => s.toLowerCase());
      const timesAliases = headerAliases.times.map((s) => s.toLowerCase());
      const hasEpc = headersNorm.some((h) => epcAliases.some((alias) => h === alias || h.includes(alias)));
      const hasTimes = headersNorm.some((h) => timesAliases.some((alias) => h === alias || h.includes(alias)));

      if (!hasEpc || !hasTimes) {
        alert(`CSV '${kind}': kolom EPC atau Times tidak ditemukan.`);
        return;
      }
    }

    const rows = countDataRows(grid);
    await putCsvFile({ kind, text, filename: file.name, rows, eventId });
    bumpDataVersion();
    
    // Reload CSV meta
    const meta = await listCsvMeta(eventId);
    setCsvMeta(meta as any);
    
    alert(`'${kind}' berhasil diupload (${rows} baris)`);
  };

  const clearCsv = async (kind: CsvKind) => {
    if (!confirm(`Reset CSV '${kind}'?`)) return;
    await deleteCsvFile(kind, eventId);
    bumpDataVersion();
    const meta = await listCsvMeta(eventId);
    setCsvMeta(meta as any);
    alert(`CSV '${kind}' telah dihapus`);
  };

  const clearAllCsv = async () => {
    if (!confirm("Reset semua CSV yang sudah diupload?")) return;
    for (const k of ["master", "start", "finish", "checkpoint"] as CsvKind[]) {
      await deleteCsvFile(k, eventId);
    }
    bumpDataVersion();
    const meta = await listCsvMeta(eventId);
    setCsvMeta(meta as any);
    alert("Semua CSV telah dihapus");
  };

  // Banner handlers
  const handleBannerUpload = async () => {
    if (!bannerFile) {
      alert('Please select an image file');
      return;
    }

    setUploadingBanner(true);
    try {
      await uploadBannerViaApi(eventId, bannerFile);
      setBannerFile(null);
      const fileInput = document.getElementById('banner-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Reload banners
      const res = await fetch(`/api/banners?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : []);
      }
      alert('Banner uploaded successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const toggleBannerActive = async (bannerId: string) => {
    const banner = banners.find((b) => b.id === bannerId);
    if (!banner) return;

    try {
      await fetch('/api/update-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerId, isActive: !banner.isActive }),
      });
      
      const res = await fetch(`/api/banners?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to toggle banner:', error);
    }
  };

  const deleteBanner = async (bannerId: string, imageUrl: string) => {
    if (!confirm('Delete this banner?')) return;

    try {
      await fetch(`/api/delete-banner?bannerId=${bannerId}&imageUrl=${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE',
      });
      
      const res = await fetch(`/api/banners?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : []);
      }
      alert('Banner deleted!');
    } catch (error) {
      alert('Failed to delete banner');
    }
  };

  // Category handlers
  const addCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('Category already exists');
      return;
    }

    const updated = [...categories, trimmed];
    await saveCategories(updated);
    setNewCategory('');
  };

  const removeCategory = async (cat: string) => {
    if (!confirm(`Remove category "${cat}"?`)) return;
    const updated = categories.filter((c) => c !== cat);
    await saveCategories(updated);
  };

  const saveCategories = async (cats: string[]) => {
    try {
      const res = await fetch(`/api/categories?eventId=${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: cats }),
      });
      
      if (res.ok) {
        setCategories(cats);
        bumpDataVersion();
      } else {
        alert('Failed to save categories');
      }
    } catch (error) {
      alert('Failed to save categories');
    }
  };

  // GPX Upload handler
  const handleGpxUpload = async () => {
    if (!gpxFile) {
      alert('Please select a GPX file');
      return;
    }

    setUploadingGpx(true);
    try {
      const content = await gpxFile.text();
      
      const response = await fetch('/api/gpx-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          content,
          filename: gpxFile.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload GPX');
      }

      const result = await response.json();
      setCurrentGpxPath(result.url);
      setGpxFile(null);
      
      const fileInput = document.getElementById('gpx-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      alert('GPX file uploaded successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to upload GPX file');
    } finally {
      setUploadingGpx(false);
    }
  };

  const clearGpxFile = async () => {
    if (!confirm('Remove GPX route file?')) return;
    
    try {
      // Update event to remove GPX path
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpxFile: null }),
      });

      if (response.ok) {
        setCurrentGpxPath(null);
        alert('GPX file removed');
      } else {
        alert('Failed to remove GPX file');
      }
    } catch (error) {
      alert('Failed to remove GPX file');
    }
  };

  // Save timing rules
  const saveTiming = async () => {
    setSavingTiming(true);
    try {
      const h = Number(cutoffHours);
      let cutoffMs: number | null = null;
      if (Number.isFinite(h) && h > 0) {
        cutoffMs = h * 3600000;
      }

      const res = await fetch(`/api/timing?eventId=${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutoffMs, categoryStartTimes: catStart }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      bumpDataVersion();
      alert("Timing rules berhasil disimpan!");
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSavingTiming(false);
    }
  };

  // Toggle DQ
  const toggleDQ = (epc: string) => {
    const next = { ...dqMap, [epc]: !dqMap[epc] };
    if (!next[epc]) delete next[epc];
    setDqMap(next);

    const dqKey = `imr_dq_map_${eventId}`;
    localStorage.setItem(dqKey, JSON.stringify(next));

    bumpDataVersion();

    // Update all rows to reflect DQ status
    const updatedRows = allRows.map(row =>
      row.epc === epc
        ? { ...row, totalTimeDisplay: next[epc] ? "DSQ" : formatDuration(row.totalTimeMs) }
        : row
    );
    setAllRows(updatedRows);
  };

  // Certificate handlers
  const loadCertData = async () => {
    try {
      const res = await fetch(`/api/certificate?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setCertData(data);
      }
    } catch (error) {
      console.error('Failed to load certificate data:', error);
    }
  };

  const handleCertUpload = async () => {
    if (!certFile) {
      alert('Please select a certificate template file');
      return;
    }

    setUploadingCert(true);
    try {
      const formData = new FormData();
      formData.append('file', certFile);
      formData.append('eventId', eventId);

      const res = await fetch('/api/upload-certificate', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload certificate');
      }

      setCertFile(null);
      const fileInput = document.getElementById('cert-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      await loadCertData();
      alert('Certificate template uploaded!');
    } catch (error: any) {
      alert(error.message || 'Failed to upload certificate');
    } finally {
      setUploadingCert(false);
    }
  };

  const deleteCert = async (filename: string) => {
    if (!confirm('Delete this certificate template?')) return;

    try {
      const res = await fetch(`/api/certificate?eventId=${eventId}&filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadCertData();
        alert('Certificate template deleted!');
      }
    } catch (error) {
      alert('Failed to delete certificate');
    }
  };

  // Filter rows for DQ tab
  const filteredDqRows = useMemo(() => {
    const query = dqSearch.trim().toLowerCase();
    if (!query) return allRows;
    return allRows.filter(
      (r) =>
        (r.bib || "").toLowerCase().includes(query) ||
        (r.name || "").toLowerCase().includes(query)
    );
  }, [dqSearch, allRows]);

  const metaByKind: Partial<Record<CsvKind, { filename: string; updatedAt: number; rows: number }>> = {};
  csvMeta.forEach((x) => {
    metaByKind[x.key] = { filename: x.filename, updatedAt: x.updatedAt, rows: x.rows };
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
        <p className="mt-4">Loading event data...</p>
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">{eventName}</h1>
          <span className="text-gray-500 text-sm">/{eventSlug}</span>
        </div>
        <button 
          className="btn w-full sm:w-auto" 
          onClick={() => window.open(`/event/${eventSlug}`, '_blank')}
        >
          View Public Page
        </button>
      </div>

      {/* Tabs - scrollable on mobile */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2 border-b-2 border-gray-200 -mx-3 px-3 md:mx-0 md:px-0">
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          Data Upload
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'timing' ? 'active' : ''}`}
          onClick={() => setActiveTab('timing')}
        >
          Timing Rules
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'banners' ? 'active' : ''}`}
          onClick={() => setActiveTab('banners')}
        >
          Banners ({banners.length})
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories ({categories.length})
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => setActiveTab('route')}
        >
          Route {currentGpxPath ? '(1)' : '(0)'}
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'dq' ? 'active' : ''}`}
          onClick={() => setActiveTab('dq')}
        >
          DQ / DNF
        </button>
        <button
          className={`detail-tab whitespace-nowrap ${activeTab === 'certified' ? 'active' : ''}`}
          onClick={() => setActiveTab('certified')}
        >
          Certified {certData.hasCertificate ? '✓' : ''}
        </button>
      </div>

      {/* Data Upload Tab */}
      {activeTab === 'data' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title">CSV Upload</h2>
              <div className="subtle text-sm">
                Upload CSV data untuk event ini. Master & Finish wajib.
              </div>
            </div>
            <button className="btn ghost w-full sm:w-auto" onClick={clearAllCsv}>
              Reset All CSV
            </button>
          </div>

          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block table-wrap">
            <table className="f1-table compact">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Type</th>
                  <th>Upload</th>
                  <th style={{ width: 280 }}>Current File</th>
                  <th style={{ width: 100 }}>Rows</th>
                  <th style={{ width: 150 }}>Updated</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(["master", "start", "finish", "checkpoint"] as CsvKind[]).map((kind) => {
                  const meta = metaByKind[kind];
                  return (
                    <tr key={kind} className="row-hover">
                      <td className="mono strong">{kind.toUpperCase()}</td>
                      <td>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (f) uploadCsv(kind, f);
                          }}
                        />
                      </td>
                      <td className="mono">{meta?.filename || "-"}</td>
                      <td className="mono">{meta?.rows ?? "-"}</td>
                      <td className="mono">
                        {meta?.updatedAt ? new Date(meta.updatedAt).toLocaleString() : "-"}
                      </td>
                      <td>
                        {meta && (
                          <button className="btn ghost" onClick={() => clearCsv(kind)}>
                            Clear
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible only on mobile */}
          <div className="md:hidden space-y-3">
            {(["master", "start", "finish", "checkpoint"] as CsvKind[]).map((kind) => {
              const meta = metaByKind[kind];
              const isRequired = kind === "master" || kind === "finish";
              return (
                <div key={kind} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="mono font-bold">{kind.toUpperCase()}</span>
                      {isRequired && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Required</span>
                      )}
                    </div>
                    {meta ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Uploaded
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                        Empty
                      </span>
                    )}
                  </div>
                  
                  {meta && (
                    <div className="text-sm text-gray-600 mb-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">File:</span>
                        <span className="mono truncate max-w-[150px]">{meta.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rows:</span>
                        <span className="mono">{meta.rows}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="block w-full text-sm text-gray-500
                          file:mr-2 file:py-2 file:px-3
                          file:rounded-lg file:border-0
                          file:text-xs file:font-medium
                          file:bg-gray-100 file:text-gray-700
                          hover:file:bg-gray-200
                          cursor-pointer"
                        onChange={(e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) uploadCsv(kind, f);
                        }}
                      />
                    </label>
                    {meta && (
                      <button className="btn ghost text-sm" onClick={() => clearCsv(kind)}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Banners Tab */}
      {activeTab === 'banners' && (
        <div className="card">
          <div className="header-row mb-4">
            <div>
              <h2 className="section-title">Banner Images</h2>
              <div className="subtle text-sm">
                Upload banner images yang akan ditampilkan di halaman event.
              </div>
            </div>
          </div>

          {/* Banner Upload */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="subtle mb-2 font-medium text-sm">Upload New Banner</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <button
                className="btn w-full sm:w-auto"
                onClick={handleBannerUpload}
                disabled={!bannerFile || uploadingBanner}
              >
                {uploadingBanner ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block table-wrap">
            <table className="f1-table compact">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Preview</th>
                  <th>URL</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">No banners uploaded yet</td>
                  </tr>
                ) : (
                  banners.map((banner) => (
                    <tr key={banner.id} className="row-hover">
                      <td>
                        <img
                          src={banner.imageUrl}
                          alt={banner.alt || "Banner"}
                          style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      </td>
                      <td className="mono" style={{ fontSize: '11px' }}>
                        {banner.imageUrl.slice(0, 50)}...
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: banner.isActive ? '#dcfce7' : '#f3f4f6',
                          color: banner.isActive ? '#166534' : '#6b7280',
                        }}>
                          {banner.isActive ? "Active" : "Hidden"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn ghost" onClick={() => toggleBannerActive(banner.id)}>
                            {banner.isActive ? 'Hide' : 'Show'}
                          </button>
                          <button 
                            className="btn ghost" 
                            style={{ color: '#dc2626' }}
                            onClick={() => deleteBanner(banner.id, banner.imageUrl)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible only on mobile */}
          <div className="md:hidden space-y-3">
            {banners.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No banners uploaded yet</div>
            ) : (
              banners.map((banner) => (
                <div key={banner.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <img
                    src={banner.imageUrl}
                    alt={banner.alt || "Banner"}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{
                          background: banner.isActive ? '#dcfce7' : '#f3f4f6',
                          color: banner.isActive ? '#166534' : '#6b7280',
                        }}
                      >
                        {banner.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn ghost flex-1 text-sm" onClick={() => toggleBannerActive(banner.id)}>
                        {banner.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button 
                        className="btn ghost flex-1 text-sm" 
                        style={{ color: '#dc2626' }}
                        onClick={() => deleteBanner(banner.id, banner.imageUrl)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="card">
          <div className="header-row mb-4">
            <div>
              <h2 className="section-title">Race Categories</h2>
              <div className="subtle text-sm">
                Kelola kategori lomba untuk event ini.
              </div>
            </div>
          </div>

          {/* Add Category */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              className="search flex-1"
              placeholder="e.g., 10K Laki-laki"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <button className="btn w-full sm:w-auto" onClick={addCategory} disabled={!newCategory.trim()}>
              + Add Category
            </button>
          </div>

          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block table-wrap">
            <table className="f1-table compact">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Category Name</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">No categories yet</td>
                  </tr>
                ) : (
                  categories.map((cat, index) => (
                    <tr key={cat} className="row-hover">
                      <td className="mono">{index + 1}</td>
                      <td className="name-cell">{cat}</td>
                      <td>
                        <button 
                          className="btn ghost" 
                          style={{ color: '#dc2626' }}
                          onClick={() => removeCategory(cat)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible only on mobile */}
          <div className="md:hidden space-y-2">
            {categories.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No categories yet</div>
            ) : (
              categories.map((cat, index) => (
                <div key={cat} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">{cat}</span>
                    <span className="text-xs text-gray-400 ml-2">#{index + 1}</span>
                  </div>
                  <button 
                    className="btn ghost text-sm" 
                    style={{ color: '#dc2626' }}
                    onClick={() => removeCategory(cat)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Route Tab */}
      {activeTab === 'route' && (
        <div className="card">
          <div className="header-row mb-4">
            <div>
              <h2 className="section-title">GPX Route File</h2>
              <div className="subtle text-sm">
                Upload file GPX untuk menampilkan rute lomba di peta.
              </div>
            </div>
          </div>

          {/* GPX Upload */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="subtle mb-2 font-medium text-sm">Upload GPX File</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="gpx-upload"
                type="file"
                accept=".gpx,application/gpx+xml"
                onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <button
                className="btn w-full sm:w-auto"
                onClick={handleGpxUpload}
                disabled={!gpxFile || uploadingGpx}
              >
                {uploadingGpx ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Format yang didukung: .gpx (GPS Exchange Format)
            </div>
          </div>

          {/* Current GPX */}
          {currentGpxPath ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                    Uploaded
                  </span>
                  <p className="mono text-xs text-gray-600 mt-2 break-all">{currentGpxPath}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn ghost flex-1 sm:flex-none"
                    onClick={() => window.open(currentGpxPath, '_blank')}
                  >
                    View
                  </button>
                  <button 
                    className="btn ghost flex-1 sm:flex-none" 
                    style={{ color: '#dc2626' }}
                    onClick={clearGpxFile}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg">
              No GPX file uploaded yet
            </div>
          )}

          {/* Info box */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-400 rounded text-blue-900 text-sm">
            <strong>Info:</strong> File GPX akan ditampilkan sebagai rute di halaman event publik.
          </div>
        </div>
      )}

      {/* Timing Rules Tab */}
      {activeTab === 'timing' && (
        <div className="space-y-4">
          {/* Cut Off Time */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="section-title">Cut Off Settings</h2>
                <div className="subtle text-sm">
                  Cut off time dihitung dari start masing-masing pelari / kategori.
                </div>
              </div>
              <button className="btn w-full sm:w-auto" onClick={saveTiming} disabled={savingTiming}>
                {savingTiming ? "Saving..." : "Save Timing Rules"}
              </button>
            </div>

            <div className="admin-cutoff">
              <div className="label font-medium text-sm mb-1">Cut Off Duration (hours)</div>
              <div className="tools">
                <input
                  className="search w-full"
                  placeholder="e.g. 3.5"
                  value={cutoffHours}
                  onChange={(e) => setCutoffHours(e.target.value)}
                />
              </div>
              <div className="subtle text-sm mt-2">Jika kosong / 0 → cut off nonaktif.</div>
            </div>
          </div>

          {/* Category Start Time Overrides */}
          <div className="card">
            <div className="mb-4">
              <h2 className="section-title">Category Start Times</h2>
              <div className="subtle text-sm">
                Set start time per kategori. Jika diisi, sistem akan menghitung{" "}
                <b>total time = finish time - start time kategori</b>.
              </div>
            </div>

            {/* Desktop Table - hidden on mobile */}
            <div className="hidden md:block table-wrap">
              <table className="f1-table compact">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Start Time (datetime)</th>
                    <th style={{ width: 200 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty">No categories defined yet. Add categories first.</td>
                    </tr>
                  ) : (
                    categories.map((catKey) => (
                      <tr key={catKey} className="row-hover">
                        <td className="name-cell">{catKey}</td>
                        <td>
                          <input
                            className="search"
                            style={{ width: "100%" }}
                            placeholder="contoh: 2025-11-23 07:00:00.000"
                            value={catStart[catKey] || ""}
                            onChange={(e) =>
                              setCatStart((prev) => ({
                                ...prev,
                                [catKey]: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              className="btn ghost"
                              onClick={() =>
                                setCatStart((prev) => ({
                                  ...prev,
                                  [catKey]: formatNowAsTimestamp(),
                                }))
                              }
                            >
                              Set Now
                            </button>
                            <button
                              className="btn ghost"
                              onClick={() =>
                                setCatStart((prev) => ({
                                  ...prev,
                                  [catKey]: "",
                                }))
                              }
                            >
                              Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards - visible only on mobile */}
            <div className="md:hidden space-y-3">
              {categories.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No categories defined yet. Add categories first.</div>
              ) : (
                categories.map((catKey) => (
                  <div key={catKey} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="font-medium text-gray-900 mb-2">{catKey}</div>
                    <input
                      className="search w-full mb-2 text-sm"
                      placeholder="2025-11-23 07:00:00.000"
                      value={catStart[catKey] || ""}
                      onChange={(e) =>
                        setCatStart((prev) => ({
                          ...prev,
                          [catKey]: e.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn ghost flex-1 text-sm"
                        onClick={() =>
                          setCatStart((prev) => ({
                            ...prev,
                            [catKey]: formatNowAsTimestamp(),
                          }))
                        }
                      >
                        Set Now
                      </button>
                      <button
                        className="btn ghost flex-1 text-sm"
                        onClick={() =>
                          setCatStart((prev) => ({
                            ...prev,
                            [catKey]: "",
                          }))
                        }
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="subtle text-sm mt-4">
              Gunakan format tanggal &amp; jam yang sama dengan di CSV timing
              (misal: <code>2025-11-23 07:00:00.000</code>). Kamu juga bisa klik <b>Set Now</b>
              untuk mengisi otomatis berdasarkan jam saat ini.
            </div>
          </div>
        </div>
      )}

      {/* DQ / DNF Tab */}
      {activeTab === 'dq' && (
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
              value={dqSearch}
              onChange={(e) => setDqSearch(e.target.value)}
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
                {filteredDqRows.map((r) => {
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
                {filteredDqRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {allRows.length === 0
                        ? "Upload data CSV terlebih dahulu di tab Data Upload."
                        : "Tidak ada peserta yang cocok."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible only on mobile */}
          <div className="md:hidden space-y-3">
            {filteredDqRows.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {allRows.length === 0
                  ? "Upload data CSV terlebih dahulu di tab Data Upload."
                  : "Tidak ada peserta yang cocok."}
              </div>
            ) : (
              filteredDqRows.map((r) => {
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
      )}

      {/* Certified Tab */}
      {activeTab === 'certified' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title">Certificate Template</h2>
              <div className="subtle text-sm">
                Upload template sertifikat untuk event ini. Setiap event memiliki template sertifikat sendiri.
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="subtle mb-2 font-medium text-sm">Upload Template Sertifikat</div>
            <div className="text-xs text-gray-500 mb-3">
              Format yang didukung: PNG, JPG, PDF. Template akan digunakan sebagai background sertifikat peserta.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="cert-upload"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <button
                className="btn w-full sm:w-auto"
                onClick={handleCertUpload}
                disabled={!certFile || uploadingCert}
              >
                {uploadingCert ? 'Uploading...' : 'Upload Template'}
              </button>
            </div>
          </div>

          {/* Current Template */}
          {certData.hasCertificate && certData.files.length > 0 ? (
            <div className="space-y-3">
              {certData.files.map((file) => (
                <div key={file.filename} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Preview */}
                    <div className="flex-shrink-0">
                      {file.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                        <img
                          src={file.url}
                          alt="Certificate template"
                          className="w-full sm:w-48 h-32 object-contain bg-gray-100 rounded border"
                        />
                      ) : (
                        <div className="w-full sm:w-48 h-32 bg-gray-100 rounded border flex items-center justify-center">
                          <div className="text-center">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#9ca3af" className="mx-auto mb-1">
                              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                            <span className="text-xs text-gray-500">PDF</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">{file.filename}</div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <div>Size: {(file.size / 1024).toFixed(1)} KB</div>
                        <div>Updated: {new Date(file.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn ghost text-sm"
                        >
                          Preview
                        </a>
                        <button
                          className="btn ghost text-sm"
                          onClick={() => deleteCert(file.filename)}
                          style={{ color: '#dc2626' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#d1d5db" className="mx-auto mb-3">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <p className="text-gray-600 font-medium">Belum ada template sertifikat</p>
              <p className="text-sm text-gray-400 mt-1">Upload template sertifikat untuk event ini</p>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-400 rounded-lg text-blue-900 text-sm">
            <strong>Info:</strong> Template sertifikat akan digunakan sebagai background. Nama dan waktu peserta akan di-overlay secara otomatis.
          </div>
        </div>
      )}
      <style>{`
        .event-detail-page {
          padding: 0;
        }

        .detail-tab {
          padding: 0.5rem 1rem;
          background: none;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }

        .detail-tab:hover {
          color: #111827;
        }

        .detail-tab.active {
          color: #dc2626;
        }

        .detail-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: #dc2626;
        }
      `}</style>
    </div>
  );
}
