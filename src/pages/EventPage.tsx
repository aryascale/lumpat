// src/pages/EventPage.tsx - User facing event detail page

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import RaceClock from "../components/RaceClock";
import CategorySection from "../components/CategorySection";
import LeaderboardTable, { LeaderRow } from "../components/LeaderboardTable";
import ParticipantModal from "../components/ParticipantModal";
import InteractiveRouteMap from "../components/InteractiveRouteMap";
import Navbar from "../components/Navbar";
import {
  loadMasterParticipants,
  loadTimesMap,
  loadCheckpointTimesMap,
} from "../lib/data";
import { LS_DATA_VERSION } from "../lib/config";
import parseTimeToMs, { extractTimeOfDay, formatDuration } from "../lib/time";

function loadDQMap(eventId: string): Record<string, boolean> {
  try {
    const key = `imr_dq_map_${eventId}`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  eventDate: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gpxFile?: string;
  categories: string[];
  isActive: boolean;
  cutoffMs?: number | null;
  categoryStartTimes?: Record<string, string> | null;
}

interface Banner {
  id: string;
  imageUrl: string;
  alt?: string;
  order: number;
  isActive: boolean;
}

type LoadState =
  | { status: "loading"; msg: string }
  | { status: "error"; msg: string }
  | { status: "ready" };

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    msg: "Memuat data event...",
  });

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [overall, setOverall] = useState<LeaderRow[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, LeaderRow[]>>({});
  const [activeTab, setActiveTab] = useState<string>("Participants");
  const [checkpointMap, setCheckpointMap] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState<LeaderRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recalcTick, setRecalcTick] = useState(0);
  const [gpxTrackPoints, setGpxTrackPoints] = useState<Array<[number, number]>>([]);

  // Load event info
  useEffect(() => {
    if (!slug) return;

    (async () => {
      try {
        const response = await fetch(`/api/events?eventId=${slug}`);
        if (response.ok) {
          const eventData = await response.json();
          setEvent(eventData);
        } else {
          setState({ status: "error", msg: "Event tidak ditemukan" });
        }
      } catch (error) {
        setState({ status: "error", msg: "Gagal memuat data event" });
      }
    })();
  }, [slug]);

  // Load banners
  useEffect(() => {
    if (!event?.id) return;

    (async () => {
      try {
        const response = await fetch(`/api/banners?eventId=${event.id}`);
        if (response.ok) {
          const data = await response.json();
          const activeBanners = (Array.isArray(data) ? data : [])
            .filter((b: Banner) => b.isActive)
            .sort((a: Banner, b: Banner) => a.order - b.order);
          setBanners(activeBanners);
        }
      } catch (error) {
        console.error('Failed to load banners:', error);
      }
    })();
  }, [event?.id]);

  // Removed banner auto-rotate (using parallax hero)

  // Load GPX data
  useEffect(() => {
    if (!event?.gpxFile) {
      setGpxTrackPoints([]);
      return;
    }

    const gpxUrl = event.gpxFile;

    (async () => {
      try {
        const response = await fetch(gpxUrl);
        if (!response.ok) {
          console.error('Failed to load GPX file');
          return;
        }
        
        const gpxText = await response.text();
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
        
        // Parse track points
        const trackPoints: Array<[number, number]> = [];
        const trkpts = gpxDoc.querySelectorAll('trkpt');
        
        trkpts.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute('lat') || '0');
          const lon = parseFloat(pt.getAttribute('lon') || '0');
          if (lat && lon) {
            trackPoints.push([lat, lon]);
          }
        });
        
        // Also check for route points (rtept)
        if (trackPoints.length === 0) {
          const rtepts = gpxDoc.querySelectorAll('rtept');
          rtepts.forEach((pt) => {
            const lat = parseFloat(pt.getAttribute('lat') || '0');
            const lon = parseFloat(pt.getAttribute('lon') || '0');
            if (lat && lon) {
              trackPoints.push([lat, lon]);
            }
          });
        }
        
        setGpxTrackPoints(trackPoints);
      } catch (error) {
        console.error('Error parsing GPX:', error);
      }
    })();
  }, [event?.gpxFile]);

  // Load race data (participants, results)
  useEffect(() => {
    if (!event?.id) return;

    (async () => {
      try {
        if (!hasLoadedOnce) {
          setState({ status: "loading", msg: "Load data peserta..." });
        }

        const master = await loadMasterParticipants(event.id);
        const startMap = await loadTimesMap("start", event.id);
        const finishMap = await loadTimesMap("finish", event.id);
        const cpMap = await loadCheckpointTimesMap(event.id);
        setCheckpointMap(cpMap);

        // Use timing from event (per-event database) instead of localStorage
        const cutoffMs = event.cutoffMs ?? null;
        const dqMap = loadDQMap(event.id);
        const catStartRaw = event.categoryStartTimes ?? {};

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

          const isDQ = !!dqMap[p.epc];
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

        const finishers = baseRows.filter(
          (r) => r.totalTimeDisplay !== "DNF" && r.totalTimeDisplay !== "DSQ"
        );

        const finisherSorted = [...finishers]
          .sort((a, b) => a.totalTimeMs - b.totalTimeMs)
          .map((r, i) => ({ ...r, rank: i + 1 }));

        const finisherRankByEpc = new Map(finisherSorted.map((r) => [r.epc, r.rank!]));
        const genderRankByEpc = new Map<string, number>();
        const genders = Array.from(new Set(finisherSorted.map((r) => (r.gender || "").toLowerCase())));
        genders.forEach((g) => {
          const list = finisherSorted.filter((r) => (r.gender || "").toLowerCase() === g);
          list.forEach((r, i) => genderRankByEpc.set(r.epc, i + 1));
        });

        const categoryRankByEpc = new Map<string, number>();
        (event.categories || []).forEach((catKey: string) => {
          const list = finisherSorted.filter((r) => r.sourceCategoryKey === catKey);
          list.forEach((r, i) => categoryRankByEpc.set(r.epc, i + 1));
        });

        const dnfs = baseRows
          .filter((r) => r.totalTimeDisplay === "DNF")
          .sort((a, b) => a.totalTimeMs - b.totalTimeMs);
        const dsqs = baseRows.filter((r) => r.totalTimeDisplay === "DSQ");

        const overallFinal: LeaderRow[] = [
          ...finisherSorted,
          ...dnfs.map((r) => ({ ...r, rank: null })),
          ...dsqs.map((r) => ({ ...r, rank: null })),
        ];

        const catMap: Record<string, LeaderRow[]> = {};
        (event.categories || []).forEach((catKey) => {
          const list = overallFinal.filter((r) => r.sourceCategoryKey === catKey);
          catMap[catKey] = list;
        });

        setOverall(overallFinal);
        setByCategory(catMap);

        (EventPage as any)._rankMaps = {
          finisherRankByEpc,
          genderRankByEpc,
          categoryRankByEpc,
        };

        setState({ status: "ready" });
        setHasLoadedOnce(true);
      } catch (e: any) {
        // Allow page to render even without data - don't block UI
        setState({ status: "ready" });
        setHasLoadedOnce(true);
      }
    })();
  }, [recalcTick, event?.id, event?.categories]);

  // Refresh when data changes
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LS_DATA_VERSION) {
        setRecalcTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const tabs = useMemo(() => {
    const baseTabs = ["Participants"];
    // Add Route tab if GPX file exists, next to Participants
    if (event?.gpxFile || (event?.latitude && event?.longitude)) {
      baseTabs.push("Route");
    }
    baseTabs.push("Results");
    
    // Append categories
    return [...baseTabs, ...(event?.categories || [])];
  }, [event?.categories, event?.gpxFile, event?.latitude, event?.longitude]);

  const onSelectParticipant = (row: LeaderRow) => {
    setSelected(row);
    setModalOpen(true);
  };

  const modalData = useMemo(() => {
    if (!selected) return null;
    const maps = (EventPage as any)._rankMaps;
    const overallRank = maps?.finisherRankByEpc?.get(selected.epc) ?? null;
    const genderRank = maps?.genderRankByEpc?.get(selected.epc) ?? null;
    const categoryRank = maps?.categoryRankByEpc?.get(selected.epc) ?? null;

    return {
      name: selected.name,
      bib: selected.bib,
      gender: selected.gender,
      category: selected.category,
      finishTimeRaw: selected.finishTimeRaw,
      totalTimeDisplay: selected.totalTimeDisplay,
      checkpointTimes: checkpointMap.get(selected.epc) || [],
      overallRank,
      genderRank,
      categoryRank,
    };
  }, [selected, checkpointMap]);

  if (!event) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            {state.status === "loading" ? (
              <>
                <div className="loading-spinner" />
                <p>{state.msg}</p>
              </>
            ) : (
              <>
                <h2>Event tidak ditemukan</h2>
                <Link to="/events" className="btn" style={{ marginTop: '1rem' }}>
                  Kembali ke Events
                </Link>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Get first banner as main logo/image
  const mainBanner = banners.length > 0 ? banners[0] : null;

  return (
    <>
      <Navbar />
      <div className="event-page bg-stone-50 min-h-screen">
        {/* Parallax Hero Header */}
        <div className="relative w-full h-[450px] bg-stone-900 bg-fixed bg-center bg-cover overflow-hidden" style={{ backgroundImage: `url(${mainBanner?.imageUrl || ''})` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-end justify-between z-10">
            <div className="flex items-end gap-6 w-full">
              {mainBanner ? (
                <img src={mainBanner.imageUrl} alt={event.name} className="w-32 h-32 md:w-48 md:h-48 object-cover border-4 border-white shadow-2xl bg-white" />
              ) : (
                <div className="w-32 h-32 md:w-48 md:h-48 border-4 border-stone-800 bg-stone-900 shadow-2xl flex items-center justify-center">
                  <span className="text-stone-700 font-bold uppercase tracking-widest text-xs">Event Logo</span>
                </div>
              )}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-4 mb-3">
                  <span className="bg-red-600 text-white px-3 py-1 text-xs font-black tracking-widest uppercase">
                    {event.eventDate ? new Date(event.eventDate).getFullYear() : 'RACE'}
                  </span>
                  <span className="text-stone-300 text-sm font-semibold tracking-wider uppercase">
                    {event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
                  </span>
                  {event.location && (
                    <>
                      <span className="w-1 h-1 bg-stone-500 rounded-full"></span>
                      <span className="text-stone-400 text-sm font-medium tracking-wide">{event.location}</span>
                    </>
                  )}
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none drop-shadow-lg mb-2">
                  {event.name}
                </h1>
                {event.description && (
                  <p className="text-stone-300 text-sm md:text-base max-w-2xl font-medium tracking-wide mt-4 border-l-2 border-red-600 pl-4">{event.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Navigation Tabs */}
        <div className="sticky top-0 z-40 bg-stone-950 border-b border-stone-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex overflow-x-auto hide-scrollbar gap-8">
              {tabs.map((t) => (
                <button
                  key={t}
                  className={`py-5 text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap border-b-4 ${
                    activeTab === t 
                      ? "border-red-600 text-white" 
                      : "border-transparent text-stone-500 hover:text-stone-300 hover:border-stone-700"
                  }`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          {activeTab === "Participants" && (
            <div className="space-y-8">
              {overall.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                     <div className="bg-white border-l-4 border-stone-900 p-6 shadow-sm">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Total Participants</div>
                        <div className="text-5xl font-black tracking-tighter text-stone-900">{overall.length}</div>
                     </div>
                     <div className="bg-white border-l-4 border-red-600 p-6 shadow-sm">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Finishers Validated</div>
                        <div className="text-5xl font-black tracking-tighter text-red-600">
                           {overall.filter(r => r.totalTimeDisplay !== "DNF" && r.totalTimeDisplay !== "DSQ").length}
                        </div>
                     </div>
                     <div className="bg-white border-l-4 border-stone-300 p-6 shadow-sm">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Race Categories</div>
                        <div className="text-5xl font-black tracking-tighter text-stone-900">{event.categories?.length || 0}</div>
                     </div>
                  </div>
                  <LeaderboardTable
                    title="Participant Roster"
                    rows={overall}
                    onSelect={onSelectParticipant}
                  />
                </>
              ) : (
                <div className="text-center py-20 bg-white border-2 border-dashed border-stone-200">
                  <div className="text-xl font-black text-stone-300 mb-2 tracking-widest uppercase">No Active Roster</div>
                  <div className="text-sm text-stone-500 font-medium">Participants will appear here once the timing master list is uploaded.</div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Results" && (
            <div className="space-y-8">
              <RaceClock cutoffMs={event?.cutoffMs} categoryStartTimes={event?.categoryStartTimes} />
              <LeaderboardTable
                title="Overall Result Rankings"
                rows={overall}
                onSelect={onSelectParticipant}
                showTop10Badge={true}
              />
            </div>
          )}

          {activeTab !== "Participants" && activeTab !== "Results" && activeTab !== "Route" && (
            <div className="space-y-8">
              <RaceClock cutoffMs={event?.cutoffMs} categoryStartTimes={event?.categoryStartTimes} />
              <CategorySection
                categoryKey={activeTab}
                rows={(byCategory as any)[activeTab] || []}
                onSelect={onSelectParticipant}
              />
            </div>
          )}

          {activeTab === "Route" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white border border-stone-200 shadow-xl overflow-hidden relative min-h-[400px] lg:min-h-[600px]">
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 border border-stone-200 shadow-lg pointer-events-none">
                  <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Official Route Map</div>
                  <div className="text-xl font-black tracking-tighter text-stone-900">{event.name}</div>
                </div>
                {(gpxTrackPoints.length > 0 || (event?.latitude && event?.longitude)) ? (
                  <InteractiveRouteMap 
                    trackPoints={gpxTrackPoints} 
                    fallbackLat={event?.latitude} 
                    fallbackLng={event?.longitude} 
                  />
                ) : (
                  <div className="w-full h-[600px] bg-stone-100 flex flex-col items-center justify-center">
                    <span className="text-stone-300 font-black text-2xl tracking-widest uppercase mb-2">No GPS Data</span>
                    <span className="text-stone-500 text-sm font-medium">The race director has not uploaded a GPX file.</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                 {/* Details Box */}
                 <div className="bg-stone-950 text-white p-8 border-t-4 border-red-600 shadow-lg">
                    <h3 className="text-white font-black text-2xl uppercase tracking-tighter mb-6 pb-4 border-b border-stone-800">Route Telemetry</h3>
                    
                    <div className="space-y-6">
                       <div>
                         <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Track Points</div>
                         <div className="font-mono text-2xl text-red-500 font-black">{gpxTrackPoints.length > 0 ? gpxTrackPoints.length : 'N/A'}</div>
                       </div>
                       
                       <div>
                         <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Status</div>
                         <div className="text-sm font-bold tracking-wide text-green-400">
                           {gpxTrackPoints.length > 0 ? 'GPS ACTIVE' : 'AWAITING UPLOAD'}
                         </div>
                       </div>
                    </div>
                 </div>

                 {/* Extra decorative box to make it feel like a real racing dashboard */}
                 <div className="bg-stone-100 p-6 border border-stone-200">
                   <div className="text-[10px] uppercase font-bold text-stone-500 tracking-widest mb-4">Official E-Certificates</div>
                   <p className="text-sm text-stone-600 font-medium leading-relaxed">
                     Finishers can download their official verified e-certificates directly from the results table by clicking on their BIB number. The generated file will include authenticated timing telemetries.
                   </p>
                 </div>
              </div>
            </div>
          )}
        </div>

        <ParticipantModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          data={modalData}
          eventId={event?.id}
        />

        <style>{`
          .event-page {
            min-height: 100vh;
            background: #f8f9fa;
          }

          .event-banner-header {
            background: linear-gradient(135deg, #c62828, #e53935);
            padding: 0;
            min-height: 80px;
          }

          .banner-carousel {
            position: relative;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            height: 200px;
            overflow: hidden;
          }

          .banner-container {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .banner-image {
            position: absolute;
            max-height: 100%;
            max-width: 100%;
            object-fit: contain;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
          }

          .banner-image.active {
            opacity: 1;
          }

          .banner-indicators {
            position: absolute;
            bottom: 1rem;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 0.5rem;
          }

          .indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: none;
            background: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            transition: all 0.3s;
          }

          .indicator.active {
            background: white;
            width: 24px;
            border-radius: 5px;
          }

          .event-info-section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem 2rem;
            display: flex;
            align-items: flex-start;
            gap: 1.5rem;
            background: white;
            border-bottom: 1px solid #e5e7eb;
          }

          .event-logo-container {
            flex-shrink: 0;
          }

          .event-logo {
            width: 100px;
            height: 100px;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            padding: 8px;
          }

          .event-logo-placeholder {
            width: 100px;
            height: 100px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .event-details {
            flex: 1;
          }

          .event-meta-line {
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
          }

          .event-meta-line .separator {
            margin: 0 0.5rem;
          }

          .event-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 0.5rem 0;
            line-height: 1.3;
          }

          .event-description {
            font-size: 0.9rem;
            color: #6b7280;
            margin: 0;
            line-height: 1.5;
          }

          .event-tabs-container {
            background: white;
            border-bottom: 1px solid #e5e7eb;
            position: relative;
          }

          .event-tabs {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            gap: 0;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .event-tabs::-webkit-scrollbar {
            display: none;
          }

          /* Scroll fade indicators */
          .event-tabs-container::before,
          .event-tabs-container::after {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            width: 30px;
            pointer-events: none;
            z-index: 2;
            opacity: 0;
            transition: opacity 0.3s;
          }

          .event-tabs-container::before {
            left: 0;
            background: linear-gradient(to right, white 30%, transparent);
          }

          .event-tabs-container::after {
            right: 0;
            background: linear-gradient(to left, white 30%, transparent);
          }

          .event-tab {
            padding: 1rem 1.5rem;
            border: none;
            background: none;
            font-size: 0.9rem;
            font-weight: 500;
            color: #6b7280;
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .event-tab:hover {
            color: #c62828;
          }

          .event-tab.active {
            color: #c62828;
            border-bottom-color: #c62828;
          }

          .event-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem 2rem;
            width: 100%;
          }

          .content-section {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            overflow-x: hidden;
          }

          .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #c62828;
            margin: 0 0 1rem 0;
          }

          /* Simple stats - no gradient */
          .simple-stats {
            display: flex;
            gap: 2rem;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e5e7eb;
          }

          .simple-stat {
            display: flex;
            flex-direction: column;
          }

          .stat-number {
            font-size: 1.75rem;
            font-weight: 700;
            color: #1f2937;
          }

          .stat-text {
            font-size: 0.8rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .empty-state {
            text-align: center;
            padding: 3rem;
            color: #6b7280;
          }

          .empty-state svg {
            margin-bottom: 1rem;
          }

          .empty-state p {
            font-size: 1.1rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }

          .empty-state .subtle {
            font-size: 0.875rem;
            color: #9ca3af;
          }

          .route-map-container {
            margin-top: 1rem;
          }

          .route-map-container iframe {
            width: 100%;
            height: 500px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .route-info {
            margin-top: 1rem;
            padding: 0.75rem 1rem;
            background: #f9fafb;
            border-radius: 6px;
            font-size: 0.875rem;
            color: #6b7280;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f4f6;
            border-top-color: #c62828;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @media (max-width: 768px) {
            .event-info-section {
              flex-direction: column;
              align-items: center;
              text-align: center;
              padding: 1rem;
            }

            .event-logo {
              width: 80px;
              height: 80px;
            }

            .event-title {
              font-size: 1.25rem;
            }

            .event-tabs-container {
              position: relative;
            }

            .event-tabs-container::after {
              opacity: 1;
            }

            .event-tabs {
              padding: 0 0.75rem;
              gap: 0.25rem;
            }

            .event-tab {
              padding: 0.875rem 1rem;
              font-size: 0.8rem;
              min-width: fit-content;
            }

            .event-content {
              padding: 0;
              margin: 0;
              max-width: 100%;
              width: 100%;
            }

            .content-section {
              padding: 1rem;
              margin: 1rem;
              border-radius: 0;
            }

            .simple-stats {
              flex-wrap: wrap;
              justify-content: center;
              gap: 1.5rem;
            }

            .simple-stat {
              align-items: center;
              min-width: 80px;
            }

            .banner-carousel {
              height: 150px;
            }

            .route-map-container iframe {
              height: 300px;
            }

            /* Fix table overflow on mobile */
            .content-section .table-wrap {
              width: calc(100% + 2rem);
              margin-left: -1rem;
              margin-right: -1rem;
              border-left: none;
              border-right: none;
              border-radius: 0;
            }

            .content-section .card {
              border-radius: 0;
              border-left: none;
              border-right: none;
            }
          }

          @media (max-width: 480px) {
            .event-tabs {
              padding: 0 0.5rem;
            }

            .event-tab {
              padding: 0.75rem 0.75rem;
              font-size: 0.75rem;
            }

            .event-title {
              font-size: 1.1rem;
            }

            .simple-stats {
              gap: 1rem;
            }

            .stat-number {
              font-size: 1.5rem;
            }

            .route-map-container iframe {
              height: 250px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
