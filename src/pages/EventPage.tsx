// src/pages/EventPage.tsx - User facing event detail page

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import RaceClock from "../components/RaceClock";
import CategorySection from "../components/CategorySection";
import LeaderboardTable, { LeaderRow } from "../components/LeaderboardTable";
import ParticipantModal from "../components/ParticipantModal";
import InteractiveRouteMap from "../components/InteractiveRouteMap";
import Navbar from "../components/Navbar";
import { message, Modal, Select, Button, Input } from "antd";
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
  isActive: boolean;
  cutoffMs?: number | null;
  categoryStartTimes?: Record<string, string> | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  tshirtSizes?: string | null;
  bibCustomPrice?: number;
  categories?: any[];
}

interface CategoryDetail {
  id: string;
  name: string;
  price: number;
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

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registeredParticipants, setRegisteredParticipants] = useState<any[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([]);

  // Registration form state
  const [regForm, setRegForm] = useState({
    categoryId: '',
    name: '',
    email: '',
    phoneNumber: '',
    gender: '',
    bloodType: '',
    emergencyName: '',
    emergencyPhone: '',
    tshirtSize: '',
    bibName: '',
    notes: '',
  });

  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const updateRegForm = (field: string, value: string) => {
    setRegForm(prev => ({ ...prev, [field]: value }));
    // Reset verification if email changes
    if (field === 'email' && emailVerified) {
      setEmailVerified(false);
      setOtpSent(false);
      setOtpCode('');
    }
  };

  const fetchRegisteredParticipants = async (eventId: string) => {
    try {
      const res = await fetch(`/api/registrations?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredParticipants(data.participants || []);
      }
    } catch (err) {
      console.error('Failed to load participants', err);
    }
  };

  const fetchCategoryDetails = async (eventId: string) => {
    try {
      const res = await fetch(`/api/categories?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setCategoryDetails(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const selectedCategoryDetail = categoryDetails.find(c => c.id === regForm.categoryId);
  const bibExtraCharge = regForm.bibName ? (event?.bibCustomPrice || 0) : 0;
  const totalPrice = (selectedCategoryDetail?.price || 0) + bibExtraCharge;

  const handleCheckout = async () => {
    if (!regForm.categoryId || !regForm.name || !regForm.email || !regForm.phoneNumber || !regForm.gender) {
      message.error('Lengkapi semua field wajib');
      return;
    }
    if (!emailVerified) {
      message.error('Silakan verifikasi email kamu terlebih dahulu.');
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event?.id, ...regForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Gagal checkout');
        return;
      }

      if (data.snapToken && (window as any).snap) {
        (window as any).snap.pay(data.snapToken, {
          onSuccess: () => {
            message.success('Pembayaran berhasil! Kamu terdaftar.');
            setRegisterModalOpen(false);
            if (event?.id) fetchRegisteredParticipants(event.id);
          },
          onPending: () => {
            message.info('Menunggu pembayaran...');
            setRegisterModalOpen(false);
          },
          onError: () => {
            message.error('Pembayaran gagal');
          },
          onClose: () => {
            message.info('Popup pembayaran ditutup');
          },
        });
      } else {
        message.success('Registrasi berhasil disimpan (Midtrans belum dikonfigurasi)');
        setRegisterModalOpen(false);
      }
    } catch (err) {
      message.error('Terjadi kesalahan');
    } finally {
      setRegistering(false);
    }
  };

  // Load event info
  useEffect(() => {
    if (!slug) return;

    (async () => {
      try {
        const response = await fetch(`/api/events?eventId=${slug}`);
        if (response.ok) {
          const eventData = await response.json();
          setEvent(eventData);
          fetchRegisteredParticipants(eventData.id);
          fetchCategoryDetails(eventData.id);
        } else {
          setState({ status: "error", msg: "Event tidak ditemukan" });
        }
      } catch (error) {
        setState({ status: "error", msg: "Gagal memuat data event" });
      }
    })();
  }, [slug]);

  // Load Midtrans Snap Script
  useEffect(() => {
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
    if (!clientKey) {
      console.warn('VITE_MIDTRANS_CLIENT_KEY is missing. Midtrans will not load.');
      return;
    }

    const scriptId = 'midtrans-snap-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true' 
        ? 'https://app.midtrans.com/snap/snap.js' 
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleSendOtp = async () => {
    if (!regForm.email) {
      message.error('Masukkan alamat email terlebih dahulu');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regForm.email)) {
      message.error('Format email tidak valid');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regForm.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        message.success(data.message || 'Kode verifikasi telah dikirim');
      } else {
        message.error(data.error || 'Gagal mengirim kode verifikasi');
      }
    } catch (err) {
      message.error('Terjadi kesalahan saat mengirim kode');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      message.error('Masukkan 6 digit kode verifikasi');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regForm.email, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setEmailVerified(true);
        message.success(data.message || 'Email berhasil diverifikasi');
      } else {
        message.error(data.error || 'Kode verifikasi salah atau expired');
      }
    } catch (err) {
      message.error('Terjadi kesalahan saat verifikasi kode');
    } finally {
      setOtpLoading(false);
    }
  };

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
    const baseTabs = ["Participants", "Registered"];
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

  // Fallback logic for cover banner
  const hasCover = !!event.bannerUrl && event.bannerUrl.startsWith('http');
  const coverImageUrl = hasCover ? event.bannerUrl : (banners.length > 0 ? banners[0].imageUrl : '');

  return (
    <>
      <Navbar />
      <div className="event-page bg-stone-50 min-h-screen">
        {/* Parallax Hero Header */}
        <div className="relative w-full h-[450px] bg-stone-900 bg-fixed bg-center bg-cover overflow-hidden" style={{ backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : 'none' }}>
          {!coverImageUrl && (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-end justify-between z-10">
            <div className="flex items-end gap-6 w-full">
              {event.logoUrl ? (
                <img src={event.logoUrl} alt={event.name} className="w-32 h-32 md:w-48 md:h-48 object-contain border-4 border-white shadow-2xl bg-white" />
              ) : (
                <div className="w-32 h-32 md:w-48 md:h-48 border-4 border-stone-800 bg-stone-900 shadow-2xl flex items-center justify-center text-center p-2">
                  <span className="text-stone-700 font-bold uppercase tracking-widest text-xs">No Logo</span>
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
                
                <button 
                  onClick={() => setRegisterModalOpen(true)}
                  className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded uppercase tracking-widest text-sm transition-colors cursor-pointer"
                >
                  Daftar Sekarang
                </button>
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

          {activeTab === "Registered" && (
            <div className="space-y-8 bg-white p-6 shadow-sm border-t-4 border-red-600">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Peserta Terdaftar</h2>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">{registeredParticipants.length} Terdaftar</span>
              </div>
              {registeredParticipants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-stone-200">
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">No</th>
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Nama</th>
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Kategori</th>
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">BIB</th>
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Size</th>
                        <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Tgl Bayar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registeredParticipants.map((p: any, idx: number) => (
                        <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-3 px-2 font-mono text-stone-400">{idx + 1}</td>
                          <td className="py-3 px-2 font-bold text-stone-900">{p.name}</td>
                          <td className="py-3 px-2 text-stone-600">{p.category?.name}</td>
                          <td className="py-3 px-2 font-mono text-stone-500">{p.bibName || '-'}</td>
                          <td className="py-3 px-2 text-stone-500">{p.tshirtSize || '-'}</td>
                          <td className="py-3 px-2 text-stone-400 text-xs">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-stone-500">Belum ada peserta yang terdaftar.</p>
              )}
            </div>
          )}

          {activeTab !== "Participants" && activeTab !== "Registered" && activeTab !== "Results" && activeTab !== "Route" && (
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

          <Modal
            title={<span className="text-lg font-black uppercase tracking-tight">Pendaftaran Event</span>}
            open={registerModalOpen}
            onCancel={() => setRegisterModalOpen(false)}
            width={640}
            footer={[
              <Button key="back" onClick={() => setRegisterModalOpen(false)}>Batal</Button>,
              <Button key="submit" type="primary" danger loading={registering} onClick={handleCheckout} disabled={totalPrice <= 0 || !emailVerified}>
                {totalPrice > 0 ? `Bayar Rp ${totalPrice.toLocaleString('id-ID')}` : 'Pilih Kategori'}
              </Button>,
            ]}
          >
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-500 mb-2">Lengkapi data berikut untuk mendaftar <strong>{event?.name}</strong>.</p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kategori & Harga *</label>
                <Select
                  className="w-full"
                  placeholder="Pilih Kategori"
                  value={regForm.categoryId || undefined}
                  onChange={(val) => updateRegForm('categoryId', val)}
                  options={categoryDetails.map(c => ({ label: `${c.name} - Rp ${c.price.toLocaleString('id-ID')}`, value: c.id }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap *</label>
                  <Input placeholder="Nama lengkap" value={regForm.name} onChange={e => updateRegForm('name', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Pendaftar *</label>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="email@example.com" 
                        type="email" 
                        size="large"
                        className="flex-1"
                        value={regForm.email} 
                        onChange={e => updateRegForm('email', e.target.value)} 
                        disabled={emailVerified || otpLoading}
                      />
                      {!emailVerified && (
                        <Button 
                          size="large"
                          type={otpSent ? "default" : "primary"}
                          onClick={handleSendOtp} 
                          loading={otpLoading} 
                          disabled={!regForm.email || !regForm.email.includes('@')}
                        >
                          {otpSent ? 'Kirim Ulang' : 'Kirim Kode'}
                        </Button>
                      )}
                    </div>
                    
                    {emailVerified && (
                      <div className="mt-2 flex items-center text-green-600 text-xs font-black uppercase tracking-wider bg-green-50 p-2 rounded-lg border border-green-100">
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        Email Terverifikasi
                      </div>
                    )}

                    {otpSent && !emailVerified && (
                      <div className="mt-3 pt-3 border-t border-gray-200 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Masukkan 6 Digit Kode OTP</p>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="000000" 
                            size="large"
                            className="text-center font-mono tracking-[0.5em] text-lg"
                            maxLength={6}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                          />
                          <Button 
                            type="primary" 
                            danger
                            size="large"
                            onClick={handleVerifyOtp} 
                            loading={otpLoading} 
                            disabled={otpCode.length !== 6}
                          >
                            Verifikasi
                          </Button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">Cek kotak masuk atau folder spam email kamu.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">No. Telepon *</label>
                  <Input placeholder="08xxxxxxxxxx" value={regForm.phoneNumber} onChange={e => updateRegForm('phoneNumber', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Kelamin *</label>
                  <Select className="w-full" placeholder="Pilih" value={regForm.gender || undefined} onChange={val => updateRegForm('gender', val)}
                    options={[{ label: 'Laki-laki', value: 'L' }, { label: 'Perempuan', value: 'P' }]} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Golongan Darah</label>
                  <Select className="w-full" placeholder="Pilih" value={regForm.bloodType || undefined} onChange={val => updateRegForm('bloodType', val)} allowClear
                    options={[{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'AB', value: 'AB' }, { label: 'O', value: 'O' }]} />
                </div>
                {event?.tshirtSizes && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ukuran Jersey</label>
                    <Select className="w-full" placeholder="Pilih ukuran" value={regForm.tshirtSize || undefined} onChange={val => updateRegForm('tshirtSize', val)} allowClear
                      options={event.tshirtSizes.split(',').map(s => ({ label: s.trim(), value: s.trim() }))} />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-bold text-gray-700 mb-2">Kontak Darurat</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Nama kontak darurat" value={regForm.emergencyName} onChange={e => updateRegForm('emergencyName', e.target.value)} />
                  <Input placeholder="No. HP kontak darurat" value={regForm.emergencyPhone} onChange={e => updateRegForm('emergencyPhone', e.target.value)} />
                </div>
              </div>

              {(event?.bibCustomPrice || 0) > 0 && (
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Custom BIB Name (+Rp {(event?.bibCustomPrice || 0).toLocaleString('id-ID')})</label>
                  <Input placeholder="Maks. 12 huruf (opsional)" maxLength={12} value={regForm.bibName} onChange={e => updateRegForm('bibName', e.target.value)} />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Tambahan</label>
                <Input.TextArea placeholder="Alergi, kondisi medis, atau catatan lainnya (opsional)" rows={2} value={regForm.notes} onChange={e => updateRegForm('notes', e.target.value)} />
              </div>

              {totalPrice > 0 && (
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg">
                  <div className="flex justify-between text-sm"><span>Kategori</span><span>Rp {(selectedCategoryDetail?.price || 0).toLocaleString('id-ID')}</span></div>
                  {bibExtraCharge > 0 && <div className="flex justify-between text-sm"><span>Custom BIB "{regForm.bibName}"</span><span>Rp {bibExtraCharge.toLocaleString('id-ID')}</span></div>}
                  <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-stone-300"><span>Total</span><span>Rp {totalPrice.toLocaleString('id-ID')}</span></div>
                </div>
              )}
            </div>
          </Modal>

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
