// src/pages/EventPage.tsx - User facing event detail page

import { useEffect, useMemo, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useParams, Link } from "react-router-dom";
import RaceClock from "../components/RaceClock";
import CategorySection from "../components/CategorySection";
import LeaderboardTable, { LeaderRow } from "../components/LeaderboardTable";
import ParticipantModal from "../components/ParticipantModal";
import InteractiveRouteMap from "../components/InteractiveRouteMap";
import Navbar from "../components/Navbar";
import { SlideToConfirm } from "../components/ui/SlideToConfirm";
import { message, Modal, Select, Button, Input } from "antd";
import {
  loadMasterParticipants,
  loadTimesMap,
  loadCheckpointTimesMap,
} from "../lib/data";
import { LS_DATA_VERSION } from "../lib/config";
import parseTimeToMs, { extractTimeOfDay, formatDuration } from "../lib/time";
import type { MasterParticipant } from "../lib/data";

function loadDQMap(eventId: string): Record<string, boolean> {
  try {
    const key = `imr_dq_map_${eventId}`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

/**
 * Match a registered participant (from DB) to a master CSV participant.
 * Strategy: name+category (most reliable) → name-only fallback.
 */
function matchRegisteredToMaster(
  participant: { name?: string; category?: { name?: string } },
  masterList: MasterParticipant[]
): MasterParticipant | undefined {
  const pName = (participant.name || '').trim().toLowerCase();
  if (!pName) return undefined;

  const pCategory = (participant.category?.name || '').trim().toLowerCase();

  // 1st pass: exact name + category
  if (pCategory) {
    const exactMatch = masterList.find(o => {
      const oName = (o.name || '').trim().toLowerCase();
      const oCat = (o.category || '').trim().toLowerCase();
      return oName === pName && oCat === pCategory;
    });
    if (exactMatch) return exactMatch;
  }

  // 2nd pass: exact name only
  const nameMatch = masterList.find(o =>
    (o.name || '').trim().toLowerCase() === pName
  );
  return nameMatch;
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
  homeImageUrl?: string | null;
  tshirtSizes?: string | null;
  bibCustomPrice?: number;
  categories?: any[];
  content?: any;
}

interface CategoryDetail {
  id: string;
  name: string;
  price: number;
  quota: number;
  sold: number;
}

interface RegistrationField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string | null;
  order: number;
}

interface TshirtStock {
  id: string;
  size: string;
  quota: number;
  sold: number;
  width?: string;
  height?: string;
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
  const [activeTab, setActiveTab] = useState<string>("Home");
  const [checkpointMap, setCheckpointMap] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState<LeaderRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recalcTick, setRecalcTick] = useState(0);
  const [gpxTrackPoints, setGpxTrackPoints] = useState<Array<[number, number]>>([]);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registeredParticipants, setRegisteredParticipants] = useState<any[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([]);
  const [customFields, setCustomFields] = useState<RegistrationField[]>([]);
  const [tshirtInventory, setTshirtInventory] = useState<TshirtStock[]>([]);
  const [bulkQty, setBulkQty] = useState(1);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [bulkParticipants, setBulkParticipants] = useState<Record<string, string>[]>([{}]);
  const [currentStep, setCurrentStep] = useState(1);
  const [scrollY, setScrollY] = useState(0);
  const [regDetailOpen, setRegDetailOpen] = useState(false);
  const [regDetailParticipant, setRegDetailParticipant] = useState<any>(null);
  const [masterParticipants, setMasterParticipants] = useState<any[]>([]);
  const [homepageBlobUrl, setHomepageBlobUrl] = useState<string | null>(null);
  const [regSearchTerm, setRegSearchTerm] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanValidResult, setScanValidResult] = useState<any | null>(null);
  const [scanErrorResult, setScanErrorResult] = useState<string | null>(null);
  const scannerStateRef = useRef({
    isPaused: false,
    timeoutId: null as any
  });

  // Scanner Logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (scannerOpen) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (scannerStateRef.current.isPaused) return;
          
          let id = decodedText;
          if (decodedText.includes('/verify/')) {
            id = decodedText.split('/verify/').pop() || decodedText;
          }
          
          const p = registeredParticipants.find(x => x.id === id);
          if (p) {
            if (p.paymentStatus === 'settlement') {
               const leader = matchRegisteredToMaster(p, masterParticipants);
               setScanValidResult({ ...p, bib: leader?.bib || '-' });
               setScanErrorResult(null);
               
               scannerStateRef.current.isPaused = true;
               if (scannerStateRef.current.timeoutId) clearTimeout(scannerStateRef.current.timeoutId);
               
               scannerStateRef.current.timeoutId = setTimeout(() => {
                 setScanValidResult(null);
                 scannerStateRef.current.isPaused = false;
               }, 4000);
            } else {
               setScanErrorResult(`Peserta (${p.name}) ditemukan, tapi status pembayaran belum lunas (${p.paymentStatus}).`);
               scannerStateRef.current.isPaused = true;
               if (scannerStateRef.current.timeoutId) clearTimeout(scannerStateRef.current.timeoutId);
               
               scannerStateRef.current.timeoutId = setTimeout(() => {
                 setScanErrorResult(null);
                 scannerStateRef.current.isPaused = false;
               }, 3000);
            }
          } else {
            setScanErrorResult("QR Code tidak dikenali atau bukan peserta event ini.");
            scannerStateRef.current.isPaused = true;
            if (scannerStateRef.current.timeoutId) clearTimeout(scannerStateRef.current.timeoutId);
            
            scannerStateRef.current.timeoutId = setTimeout(() => {
              setScanErrorResult(null);
              scannerStateRef.current.isPaused = false;
            }, 3000);
          }
        },
        () => {
          // Ignore parse errors (runs frequently when camera is scanning empty space)
        }
      ).catch(err => {
        console.error("Scanner error:", err);
      });
    }

    return () => {
      if (scannerStateRef.current.timeoutId) clearTimeout(scannerStateRef.current.timeoutId);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
      }
    };
  }, [scannerOpen, registeredParticipants, masterParticipants]);

  // Create blob URL for homepage HTML
  // Blob URL renders as a normal page (unlike srcDoc), so CSS animations, fonts, and layouts work naturally.
  useEffect(() => {
    const aboutHtml = event?.content?.about;
    if (aboutHtml && (aboutHtml.trim().toLowerCase().startsWith('<!doctype html>') || aboutHtml.trim().toLowerCase().startsWith('<html'))) {
      const blob = new Blob([aboutHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setHomepageBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setHomepageBlobUrl(null);
      };
    } else {
      setHomepageBlobUrl(null);
    }
  }, [event?.content?.about]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    dateOfBirth: '',
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
  const totalPrice = ((selectedCategoryDetail?.price || 0) + bibExtraCharge) * bulkQty;

  const handleCheckout = async () => {
    if (!regForm.categoryId) {
      message.error('Pilih kategori terlebih dahulu');
      return;
    }
    if (!emailVerified && !event?.content?.allowBulkNoOtp) {
      message.error('Silakan verifikasi email kamu terlebih dahulu.');
      return;
    }
    
    // Check if required custom fields are filled for all participants
    for (let i = 0; i < bulkQty; i++) {
      const p = bulkParticipants[i] || {};
      
      // Check required
      const missingFields = customFields.filter(f => f.required && !p[f.id]);
      if (missingFields.length > 0) {
        setActiveTabIdx(i);
        message.error(`Pelanggan ${i+1}: Harap isi kolom: ${missingFields.map(f => f.label).join(', ')}`);
        return;
      }

      // Check format for custom email and phone
      for (const field of customFields) {
        const val = p[field.id];
        if (val) {
          if (field.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(val)) {
              setActiveTabIdx(i);
              message.error(`Pelanggan ${i+1}: Format email pada '${field.label}' tidak valid`);
              return;
            }
          }
          if (field.type === 'tel') {
            const telRegex = /^[0-9+\-\s()]+$/;
            if (!telRegex.test(val)) {
              setActiveTabIdx(i);
              message.error(`Pelanggan ${i+1}: Nomor telepon pada '${field.label}' hanya boleh berisi angka, +, -, dan spasi`);
              return;
            }
          }
        }
      }
    }

    setRegistering(true);
    try {
      const participantsToSend = bulkParticipants.slice(0, bulkQty).map(p => ({
        ...regForm,
        customData: Object.keys(p).length > 0 ? p : undefined
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          eventId: event?.id, 
          ...regForm,
          bulkParticipants: participantsToSend,
        }),
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
            if (event?.id) fetchRegisteredParticipants(event.id);
          },
          onError: () => {
            message.error('Pembayaran gagal');
            if (event?.id) fetchRegisteredParticipants(event.id);
          },
          onClose: () => {
            message.info('Popup pembayaran ditutup');
            if (event?.id) fetchRegisteredParticipants(event.id);
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

          // Load custom fields
          try {
            const fieldsRes = await fetch(`/api/registration-fields?eventId=${eventData.id}`);
            if (fieldsRes.ok) {
              const fieldsData = await fieldsRes.json();
              setCustomFields(fieldsData.fields || []);
            }
          } catch {}

          // Load tshirt inventory
          try {
            const invRes = await fetch(`/api/tshirt-inventory?eventId=${eventData.id}`);
            if (invRes.ok) {
              const invData = await invRes.json();
              setTshirtInventory(invData.inventory || []);
            }
          } catch {}
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

    const sendCountKey = `otp_send_count_${regForm.email}`;
    const sendCount = parseInt(localStorage.getItem(sendCountKey) || '0', 10);
    if (sendCount >= 2) {
      message.error('Batas pengiriman OTP harian tercapai untuk email ini di browser Anda.');
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
        localStorage.setItem(sendCountKey, (sendCount + 1).toString());
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
        setMasterParticipants(master.all);
        const startMap = await loadTimesMap("start", event.id);
        const finishMap = await loadTimesMap("finish", event.id);
        const cpMap = await loadCheckpointTimesMap(event.id);
        setCheckpointMap(cpMap);

        // Use timing from event (per-event database) instead of localStorage
        const cutoffMs = event.cutoffMs ?? null;
        const dqMap = loadDQMap(event.id);
        const catStartRaw = event.categoryStartTimes ?? {};

        const normCat = (s: string) => String(s || "").trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");

        const absOverrideMs: Record<string, number | null> = {};
        const timeOnlyStr: Record<string, string | null> = {};

        Object.entries(catStartRaw).forEach(([key, raw]) => {
          const normKey = normCat(key);
          const s = String(raw || "").trim();
          if (!s) {
            absOverrideMs[normKey] = null;
            timeOnlyStr[normKey] = null;
            return;
          }
          if (/\d{4}-\d{2}-\d{2}/.test(s)) {
            const parsed = parseTimeToMs(s);
            absOverrideMs[normKey] = parsed.ms;
            timeOnlyStr[normKey] = null;
          } else {
            absOverrideMs[normKey] = null;
            timeOnlyStr[normKey] = s;
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

        if (!master?.all || master.all.length === 0) {
          registeredParticipants.filter(p => p.paymentStatus === 'settlement').forEach(p => {
            baseRows.push({
              rank: null,
              bib: p.bibName || 'RDY',
              name: p.name,
              gender: p.gender || 'U',
              category: p.category?.name || 'REG',
              sourceCategoryKey: p.category?.name || 'REG',
              finishTimeRaw: '-',
              totalTimeMs: 0,
              totalTimeDisplay: 'Registered',
              epc: p.id,
            });
          });
        } else {
          const adminCategories = event.categories || [];
          
          const resolveAdminCategory = (cat: string, gender: string) => {
            const normCatStr = normCat(cat);
            const exact = adminCategories.find(c => normCat(c) === normCatStr);
            if (exact) return exact;
            
            const genderStr = normCat(gender);
            const combined = normCat(`${cat} ${genderStr}`);
            const combinedMatch = adminCategories.find(c => normCat(c) === combined);
            if (combinedMatch) return combinedMatch;
            
            return cat;
          };

          master.all.forEach((p) => {
            const resolvedCategoryKey = resolveAdminCategory(p.sourceCategoryKey, p.gender);

            const isDQ = !!dqMap[p.epc];
            const finishEntry = finishMap.get(p.epc);

            const pushIncompleteRow = (status: string) => {
              baseRows.push({
                rank: null,
                bib: p.bib,
                name: p.name,
                gender: p.gender,
                category: p.category || resolvedCategoryKey,
                sourceCategoryKey: resolvedCategoryKey,
                finishTimeRaw: finishEntry ? extractTimeOfDay(finishEntry.raw) : '-',
                totalTimeMs: 0,
                totalTimeDisplay: isDQ ? "DSQ" : status,
                epc: p.epc,
              });
            };

            if (!finishEntry?.ms) {
              pushIncompleteRow("ACTIVE");
              return;
            }

            const catKey = normCat(resolvedCategoryKey);
            const absMs = absOverrideMs[catKey] ?? null;
            const timeOnly = timeOnlyStr[catKey] ?? null;

            let total: number | null = null;

            if (absMs != null && Number.isFinite(absMs)) {
              const delta = finishEntry.ms - absMs;
              if (Number.isFinite(delta) && delta >= 0) {
                total = delta;
              } else {
                const startEntry = startMap.get(p.epc);
                if (!startEntry?.ms) {
                  pushIncompleteRow("ACTIVE");
                  return;
                }
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
                  if (!startEntry?.ms) {
                    pushIncompleteRow("ACTIVE");
                    return;
                  }
                  total = finishEntry.ms - startEntry.ms;
                }
              } else {
                const startEntry = startMap.get(p.epc);
                if (!startEntry?.ms) {
                  pushIncompleteRow("ACTIVE");
                  return;
                }
                total = finishEntry.ms - startEntry.ms;
              }
            } else {
              const startEntry = startMap.get(p.epc);
              if (!startEntry?.ms) {
                pushIncompleteRow("ACTIVE");
                return;
              }
              total = finishEntry.ms - startEntry.ms;
            }

            if (!Number.isFinite(total) || total == null || total < 0) {
              pushIncompleteRow("ACTIVE");
              return;
            }

            const isDNF = cutoffMs != null && total > cutoffMs;

            baseRows.push({
              rank: null,
              bib: p.bib,
              name: p.name,
              gender: p.gender,
              category: p.category || resolvedCategoryKey,
              sourceCategoryKey: resolvedCategoryKey,
              finishTimeRaw: extractTimeOfDay(finishEntry.raw),
              totalTimeMs: total,
              totalTimeDisplay: isDQ ? "DSQ" : isDNF ? "DNF" : formatDuration(total),
              epc: p.epc,
            });
          });
        }

        const finishers = baseRows.filter(
          (r) => r.totalTimeDisplay !== "DNF" && r.totalTimeDisplay !== "DSQ" && r.totalTimeDisplay !== "ACTIVE"
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
          const list = finisherSorted.filter((r) => normCat(r.sourceCategoryKey) === normCat(catKey));
          list.forEach((r, i) => categoryRankByEpc.set(r.epc, i + 1));
        });

        const dnfs = baseRows
          .filter((r) => r.totalTimeDisplay === "DNF")
          .sort((a, b) => a.totalTimeMs - b.totalTimeMs);
        const dsqs = baseRows.filter((r) => r.totalTimeDisplay === "DSQ");
        const actives = baseRows.filter((r) => r.totalTimeDisplay === "ACTIVE");

        const overallFinal: LeaderRow[] = [
          ...finisherSorted,
          ...actives.map((r) => ({ ...r, rank: null })),
          ...dnfs.map((r) => ({ ...r, rank: null })),
          ...dsqs.map((r) => ({ ...r, rank: null })),
        ];

        const catMap: Record<string, LeaderRow[]> = {};
        (event.categories || []).forEach((catKey) => {
          const list = overallFinal.filter((r) => normCat(r.sourceCategoryKey) === normCat(catKey));
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
  }, [recalcTick, event?.id, event?.categories, registeredParticipants]);

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
    const baseTabs = ["Home", "Participants", "Registered"];
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
  const hasCover = !!event.bannerUrl;
  const coverImageUrl = hasCover ? event.bannerUrl : (banners.length > 0 ? banners[0].imageUrl : '');

  return (
    <>
      <Navbar />
      <div className="event-page min-h-screen bg-white">
        {/* Parallax Hero Header */}
        <div className="relative w-full h-[340px] md:h-[450px] bg-stone-900 overflow-hidden">
          {coverImageUrl ? (
            <div 
              className="absolute inset-0 bg-center bg-cover scale-105 will-change-transform"
              style={{ 
                backgroundImage: `url(${coverImageUrl})`,
                transform: `translateY(${scrollY * 0.4}px)` 
              }}
            />
          ) : (
            <div 
              className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900 will-change-transform"
              style={{ transform: `translateY(${scrollY * 0.4}px)` }}
            >
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 w-full p-4 pb-4 md:p-12 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-4 md:gap-6 w-full max-w-7xl mx-auto">
              {event.logoUrl ? (
                <img src={event.logoUrl} alt={event.name} className="w-16 h-16 md:w-40 md:h-40 object-contain border-2 md:border-4 border-white shadow-2xl bg-white flex-shrink-0 rounded-xl md:rounded-none" />
              ) : (
                <div className="w-16 h-16 md:w-40 md:h-40 border-2 md:border-4 border-stone-800 bg-stone-900 shadow-2xl flex items-center justify-center text-center p-1 flex-shrink-0 rounded-xl md:rounded-none">
                  <span className="text-stone-700 font-bold uppercase tracking-widest text-[7px] md:text-xs">No Logo</span>
                </div>
              )}
              <div className="flex-1 w-full min-w-0 pb-1 md:pb-2">
                <div className="flex items-center justify-center md:justify-start gap-2 md:gap-4 mb-2 md:mb-3 flex-wrap">
                  <span className="bg-red-600 text-white px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-black tracking-widest uppercase">
                    {event.eventDate ? new Date(event.eventDate).getFullYear() : 'RACE'}
                  </span>
                  <span className="text-stone-300 text-[10px] md:text-sm font-semibold tracking-wider uppercase">
                    {event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
                  </span>
                  {event.location && (
                    <span className="hidden md:inline text-stone-400 text-sm font-medium tracking-wide">• {event.location}</span>
                  )}
                </div>
                <h1 className="text-lg md:text-5xl font-black text-white tracking-tight md:tracking-tighter uppercase leading-tight md:leading-none drop-shadow-lg mb-1 md:mb-2 whitespace-normal">
                  {event.name}
                </h1>
                {event.location && (
                  <span className="md:hidden text-stone-300 text-xs font-semibold tracking-wide mt-1 uppercase block">{event.location}</span>
                )}
                {event.description && (
                  <p className="hidden md:block text-stone-300 text-base max-w-2xl font-medium tracking-wide mt-4 border-l-2 border-white/50 pl-4">{event.description}</p>
                )}
                
                <button 
                  onClick={() => setRegisterModalOpen(true)}
                  className="mt-3 md:mt-6 bg-white text-black font-bold py-2 md:py-3 px-6 md:px-10 rounded-full uppercase tracking-widest text-[10px] md:text-xs transition-all hover:bg-stone-100 hover:scale-105 cursor-pointer mx-auto md:mx-0 block md:inline-block"
                >
                  Daftar Sekarang →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Navigation Tabs */}
        <div className="sticky top-0 z-40 bg-stone-950 border-b border-stone-800 shadow-xl overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex overflow-x-auto hide-scrollbar gap-8">
              {tabs.map((t) => (
                <button
                  key={t}
                  data-tab={t}
                  className={`py-3 md:py-5 text-[10px] md:text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap border-b-4 ${
                    activeTab === t 
                      ? "border-white text-white" 
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
        <div className={`${activeTab === 'Home' ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 py-0 md:py-8'}`}>
          {activeTab === "Home" && (
            <div className="animate-in fade-in duration-700">
              {/* Event Hero Banner (Original Ratio) */}
              {event.homeImageUrl && (
                <div className="w-full overflow-hidden">
                  <img src={event.homeImageUrl} alt={event.name} className="w-full object-contain block mx-auto" />
                </div>
              )}

              {/* Banner Gallery */}
              {banners.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banners.map((b) => (
                    <div key={b.id} className="overflow-hidden shadow-lg group">
                      <img src={b.imageUrl} alt={b.alt || event?.name} className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  ))}
                </div>
              )}

              {/* Event Summary / Blog Content */}
              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-8">
                  {/* Homepage Content */}
                  <div className="w-full overflow-hidden">
                    {event?.content?.about ? (
                      homepageBlobUrl ? (
                        <iframe
                          title="Event Homepage"
                          src={homepageBlobUrl}
                          className="w-full border-0 overflow-hidden block"
                          style={{ minHeight: '100vh', width: '100%' }}
                          onLoad={(e) => {
                            try {
                              const iframe = e.target as HTMLIFrameElement;
                              const doc = iframe.contentWindow?.document;
                              if (!doc) return;

                              // Auto-resize iframe height
                              const resize = () => {
                                try {
                                  const h = doc.documentElement.scrollHeight;
                                  if (h > 100) iframe.style.height = h + 'px';
                                } catch {}
                              };
                              setTimeout(resize, 500);
                              setTimeout(resize, 1500);
                              setTimeout(resize, 3000);

                              try {
                                const ro = new ResizeObserver(() => resize());
                                ro.observe(doc.body);
                              } catch {}

                              // Intercept CTA clicks
                              try {
                                doc.body.addEventListener('click', (ev) => {
                                  const target = ev.target as HTMLElement;
                                  const btn = target.closest('a[href="#tickets"], a[href="#participants"], button[data-ticket], .btn-buy, .btn-fun');
                                  if (btn && (btn as HTMLElement).id !== 'backToTop') {
                                    ev.preventDefault();
                                    const participantsTab = document.querySelector('button[data-tab="Participants"]') as HTMLButtonElement;
                                    if (participantsTab) {
                                      participantsTab.click();
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                  }
                                });
                              } catch {}
                            } catch (err) {
                              console.error('iframe setup error:', err);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: event.content.about }} />
                      )
                    ) : event?.description ? (
                      <div className="bg-white p-8 shadow-sm border-t-4 border-stone-900 prose prose-stone max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase">
                        <p className="leading-relaxed">{event.description}</p>
                      </div>
                    ) : (
                      <div className="bg-white p-8 shadow-sm border-t-4 border-stone-200">
                        <p className="text-stone-400 italic">Belum ada deskripsi event.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Participants" && (
            <div className="space-y-8">
              {overall.length > 0 ? (
                <>
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
              {!(overall.some((r) => r.rank != null && r.rank <= 3)) && (
                 <RaceClock cutoffMs={event?.cutoffMs} categoryStartTimes={event?.categoryStartTimes} />
              )}
              <LeaderboardTable
                title="Overall Result Rankings"
                rows={overall}
                onSelect={onSelectParticipant}
                showTop10Badge={true}
              />
            </div>
          )}

          {activeTab === "Registered" && (
            <div className="space-y-8 bg-white p-6 shadow-sm border-t-4 border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="shrink-0">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Peserta Terdaftar</h2>
                  <span className="text-stone-500 text-sm font-medium">{registeredParticipants.filter(p => p.paymentStatus === 'settlement').length} Terdaftar</span>
                </div>
                <div className="relative w-full sm:w-80 shrink-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Cari nama atau No. BIB..." 
                    className="w-full pl-10 pr-4 py-2 border-2 border-stone-200 rounded-xl text-sm focus:border-stone-800 focus:ring-0 outline-none transition-colors font-medium text-stone-900 placeholder:text-stone-400"
                    value={regSearchTerm}
                    onChange={e => setRegSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setScannerOpen(true)}
                  className="btn primary px-4 py-2 flex items-center gap-2 rounded-xl"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v4H3v-4zM3 3h4v4H3V3zM10 3h4v4h-4V3zM3 17h4v4H3v-4zM10 17h4v4h-4v-4zM17 17h4v4h-4v-4zM17 10h4v4h-4v-4zM17 3h4v4h-4V3z" />
                  </svg>
                  Scan Peserta
                </button>
              </div>
              {(() => {
                const settled = registeredParticipants.filter(p => p.paymentStatus === 'settlement');
                const filtered = settled.filter(p => {
                  const leader = matchRegisteredToMaster(p, masterParticipants);
                  const bib = leader?.bib || '';
                  const term = regSearchTerm.toLowerCase();
                  return p.name.toLowerCase().includes(term) || bib.toLowerCase().includes(term);
                });
                return filtered.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-stone-200">
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500" style={{width: 60}}>No</th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Nama</th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">Kategori</th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">No BIB</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p: any, idx: number) => {
                          const leader = matchRegisteredToMaster(p, masterParticipants);
                          const bib = leader && leader.bib !== 'RDY' ? leader.bib : '-';
                          return (
                            <tr 
                              key={p.id} 
                              className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                              onClick={() => { setRegDetailParticipant(p); setRegDetailOpen(true); }}
                            >
                              <td className="py-3 px-2 font-mono text-stone-400">{idx + 1}</td>
                              <td className="py-3 px-2 font-bold text-stone-900">{p.name}</td>
                              <td className="py-3 px-2 text-stone-600">{p.category?.name}</td>
                              <td className="py-3 px-2 font-mono font-bold text-stone-900">{bib}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-stone-500">Belum ada peserta yang terdaftar atau ditemukan.</p>
                );
              })()}
              
              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-stone-600">
                  Pembayaran gagal, pending, atau nama tidak ditemukan? <a href={`/bantuan?eventId=${event?.id}`} className="text-blue-600 font-bold hover:underline" target="_blank" rel="noopener noreferrer">Lapor Kendala</a>
                </span>
              </div>
            </div>
          )}

          {/* Registered Participant Detail Modal */}
          {regDetailOpen && regDetailParticipant && (() => {
            const leader = matchRegisteredToMaster(regDetailParticipant, masterParticipants);
            const bib = leader && leader.bib !== 'RDY' ? leader.bib : '-';
            return (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRegDetailOpen(false)}>
                <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-stone-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black uppercase tracking-tight">Detail Peserta</h3>
                      <button onClick={() => setRegDetailOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 text-lg font-bold">✕</button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start py-2 border-b border-stone-100">
                      <span className="text-[10px] font-black text-stone-400 uppercase">Nama</span>
                      <span className="font-bold text-stone-900">{regDetailParticipant.name}</span>
                    </div>
                    <div className="flex justify-between items-start py-2 border-b border-stone-100">
                      <span className="text-[10px] font-black text-stone-400 uppercase">Kategori</span>
                      <span className="text-sm text-stone-700">{regDetailParticipant.category?.name}</span>
                    </div>
                    <div className="flex justify-between items-start py-2">
                      <span className="text-[10px] font-black text-stone-400 uppercase">No BIB</span>
                      <span className="text-sm font-mono font-bold text-stone-900">{bib}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab !== "Home" && activeTab !== "Participants" && activeTab !== "Registered" && activeTab !== "Results" && activeTab !== "Route" && (
            <div className="space-y-8">
              {!((byCategory as any)[activeTab] || []).some((r: any) => r.rank != null && r.rank <= 3) && (
                <RaceClock cutoffMs={event?.cutoffMs} categoryStartTimes={event?.categoryStartTimes} />
              )}
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
                 <div className="bg-stone-950 text-white p-8 border-t-4 border-stone-800 shadow-lg">
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

        {/* Floating CTA Button */}
        <div className="fixed bottom-6 right-6 z-50" style={{ display: registerModalOpen ? 'none' : 'block' }}>
          <button
            onClick={() => setRegisterModalOpen(true)}
            className="bg-black/80 backdrop-blur-md text-white font-bold py-3 px-6 rounded-full shadow-lg uppercase tracking-widest text-[10px] transition-all hover:bg-black hover:scale-105 cursor-pointer border border-white/10"
          >
            Daftar →
          </button>
        </div>

          <Modal
            title={null}
            open={registerModalOpen}
            onCancel={() => {
              setRegisterModalOpen(false);
              setCurrentStep(1);
            }}
            width={720}
            footer={null}
            className="registration-wizard"
            centered
          >
            <div className="p-2 sm:p-6">
              {/* Progress Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-center">Pendaftaran Event</h2>
                <div className="flex items-center justify-between relative px-4">
                  {/* Background Line */}
                  <div className="absolute left-8 right-8 top-4 h-[2px] bg-gray-200 -z-10"></div>
                  {/* Active Line */}
                  <div 
                    className="absolute left-8 top-4 h-[2px] bg-stone-300 -z-10 transition-all duration-500 overflow-hidden"
                    style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : 'calc(100% - 4rem)' }}
                  >
                    {currentStep < 3 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    )}
                  </div>
                  
                  {/* Step 1 */}
                  <div className="flex flex-col items-center gap-2 bg-white relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${currentStep === 1 ? 'bg-stone-800 text-white ring-4 ring-stone-200 scale-110 shadow-lg' : currentStep > 1 ? 'bg-stone-800 text-white' : 'bg-gray-400 text-white'}`}>
                      {currentStep > 1 ? '✓' : '1'}
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 1 ? 'text-stone-900' : 'text-gray-500'}`}>Data Diri</span>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="flex flex-col items-center gap-2 bg-white relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${currentStep === 2 ? 'bg-stone-800 text-white ring-4 ring-stone-200 scale-110 shadow-lg' : currentStep > 2 ? 'bg-stone-800 text-white' : 'bg-gray-400 text-white'}`}>
                      {currentStep > 2 ? '✓' : '2'}
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 2 ? 'text-stone-900' : 'text-gray-500'}`}>Konfirmasi</span>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-center gap-2 bg-white relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${currentStep === 3 ? 'bg-stone-800 text-white ring-4 ring-stone-200 scale-110 shadow-lg' : 'bg-gray-400 text-white'}`}>
                      3
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 3 ? 'text-stone-900' : 'text-gray-500'}`}>Pembayaran</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Category & Email */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                    <h3 className="text-lg font-black mb-4">1. Pilih Kategori</h3>
                    <Select
                      className="w-full"
                      size="large"
                      placeholder="Pilih Kategori Perlombaan"
                      value={regForm.categoryId || undefined}
                      onChange={(val) => {
                        updateRegForm('categoryId', val);
                        setBulkQty(1);
                        setBulkParticipants([{}]);
                      }}
                      options={categoryDetails.filter(c => c.quota === 0 || c.sold < c.quota).map(c => ({
                        label: `${c.name} - Rp ${c.price.toLocaleString('id-ID')}${c.quota > 0 ? ` (${c.quota - c.sold} slot)` : ''}`,
                        value: c.id,
                      }))}
                    />
                  </div>

                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                    <h3 className="text-lg font-black mb-4">2. {event?.content?.allowBulkNoOtp ? 'Alamat Email' : 'Verifikasi Email'}</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {event?.content?.allowBulkNoOtp 
                        ? 'Masukkan alamat email Anda untuk keperluan tiket dan informasi.' 
                        : 'Kode OTP akan dikirimkan ke email Anda untuk validasi pendaftaran.'}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="relative flex-1 w-full">
                        <Input 
                          placeholder="email@example.com" 
                          type="email" 
                          size="large"
                          className="w-full"
                          value={regForm.email} 
                          onChange={e => updateRegForm('email', e.target.value)} 
                          disabled={(emailVerified && !event?.content?.allowBulkNoOtp) || otpLoading}
                        />
                      </div>
                      {!event?.content?.allowBulkNoOtp && (
                        <>
                          {!emailVerified ? (
                            <Button 
                              size="large"
                              type={otpSent ? "default" : "primary"}
                              onClick={handleSendOtp} 
                              loading={otpLoading} 
                              disabled={!regForm.email || !regForm.email.includes('@')}
                              className="w-full sm:w-auto"
                            >
                              {otpSent ? 'Kirim Ulang' : 'Kirim Kode'}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg border border-stone-200 text-xs font-black text-green-600 shadow-sm whitespace-nowrap uppercase tracking-widest">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                              Terverifikasi
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!event?.content?.allowBulkNoOtp && otpSent && !emailVerified && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Masukkan 6 Digit OTP</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input 
                            placeholder="000000" 
                            size="large"
                            className="text-center font-mono tracking-[0.5em] text-xl"
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
                            className="w-full sm:w-auto"
                          >
                            Verifikasi
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      type="primary" 
                      danger 
                      size="large" 
                      className="w-full sm:w-auto px-8 font-bold uppercase tracking-widest text-xs h-14"
                      disabled={!regForm.categoryId || (!event?.content?.allowBulkNoOtp && !emailVerified) || (event?.content?.allowBulkNoOtp && (!regForm.email || !regForm.email.includes('@')))}
                      onClick={() => setCurrentStep(2)}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Custom Dynamic Fields */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                      <h3 className="text-lg font-black">Data Peserta</h3>
                      {event?.content?.allowBulkNoOtp && (
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
                          <span className="font-bold text-xs text-stone-500 uppercase">Qty</span>
                          <Select 
                            size="small"
                            bordered={false}
                            value={bulkQty} 
                            onChange={(val) => {
                              setBulkQty(val);
                              setBulkParticipants(prev => {
                                const updated = [...prev];
                                while (updated.length < val) updated.push({});
                                return updated;
                              });
                              if (activeTabIdx >= val) setActiveTabIdx(val - 1);
                            }}
                            options={(() => {
                              const selectedCat = categoryDetails.find(c => c.id === regForm.categoryId);
                              const available = selectedCat ? (selectedCat.quota > 0 ? selectedCat.quota - selectedCat.sold : 10) : 10;
                              const max = Math.min(10, available);
                              return Array.from({ length: max }, (_, i) => i + 1).map(v => ({ label: v.toString(), value: v }));
                            })()}
                            className="w-16"
                          />
                        </div>
                      )}
                    </div>

                    {bulkQty > 1 && (
                      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 border-b border-stone-100">
                        {Array.from({ length: bulkQty }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveTabIdx(idx)}
                            className={`px-4 py-2 text-xs font-bold whitespace-nowrap rounded-lg transition-colors ${activeTabIdx === idx ? 'bg-blue-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                          >
                            PELANGGAN {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {customFields.length === 0 && tshirtInventory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        Admin belum mengatur kolom pendaftaran untuk event ini.<br />
                        Klik Lanjut Pembayaran untuk meneruskan pesanan.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customFields.map(field => (
                          <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            
                            {field.type === 'dropdown' ? (
                              <Select
                                className="w-full"
                                size="large"
                                placeholder={`Pilih ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || undefined}
                                onChange={(val) => setBulkParticipants(prev => {
                                  const updated = [...prev];
                                  updated[activeTabIdx] = { ...updated[activeTabIdx], [field.id]: val };
                                  return updated;
                                })}
                                options={(field.options ? field.options.split(',') : []).map(opt => ({ label: opt.trim(), value: opt.trim() }))}
                              />
                            ) : field.type === 'textarea' ? (
                              <Input.TextArea
                                rows={3}
                                placeholder={`Masukkan ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || ''}
                                onChange={(e) => setBulkParticipants(prev => {
                                  const updated = [...prev];
                                  updated[activeTabIdx] = { ...updated[activeTabIdx], [field.id]: e.target.value };
                                  return updated;
                                })}
                              />
                            ) : (
                              <Input
                                size="large"
                                type={field.type}
                                placeholder={`Masukkan ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || ''}
                                onChange={(e) => setBulkParticipants(prev => {
                                  const updated = [...prev];
                                  updated[activeTabIdx] = { ...updated[activeTabIdx], [field.id]: e.target.value };
                                  return updated;
                                })}
                              />
                            )}
                          </div>
                        ))}

                        {tshirtInventory.length > 0 && (
                          <div className="md:col-span-2 mt-4 pt-4 border-t border-stone-200">
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                              Ukuran Kaos / Jersey <span className="text-red-500">*</span>
                            </label>
                            <Select
                              className="w-full mb-3"
                              size="large"
                              placeholder="Pilih Ukuran"
                              value={bulkParticipants[activeTabIdx]?.['tshirtSize'] || undefined}
                              onChange={(val) => setBulkParticipants(prev => {
                                  const updated = [...prev];
                                  updated[activeTabIdx] = { ...updated[activeTabIdx], tshirtSize: val };
                                  return updated;
                              })}
                              options={tshirtInventory.map(t => ({
                                label: `${t.size} ${t.quota > 0 ? (t.sold >= t.quota ? '(Habis)' : `(${t.quota - t.sold} tersisa)`) : ''}`,
                                value: t.size,
                                disabled: t.quota > 0 && t.sold >= t.quota
                              }))}
                            />
                            <div className="mt-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Size Chart Guide</span>
                                <div className="h-[1px] flex-1 bg-stone-100"></div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {tshirtInventory.map((t, idx) => (
                                  <div key={idx} className="bg-stone-50/50 border border-stone-100 rounded-xl p-3 flex flex-col items-center justify-center transition-all hover:border-red-200 hover:bg-white group">
                                    <span className="text-lg font-black text-stone-900 mb-1 group-hover:text-red-600 transition-colors">{t.size}</span>
                                    <div className="flex flex-col items-center text-[10px] text-stone-500 font-medium uppercase tracking-tighter">
                                      <span>W: {t.width || '-'} cm</span>
                                      <span>H: {t.height || '-'} cm</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[9px] text-stone-400 mt-3 italic text-center">* Ukuran dalam centimeter (cm). Toleransi ukuran ±1-2cm.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-6 gap-4">
                    <Button size="large" onClick={() => setCurrentStep(1)} className="w-full sm:w-auto h-14">
                      Kembali
                    </Button>
                    <div className="w-full sm:w-[320px]">
                      <SlideToConfirm
                        text="Lanjut Pembayaran"
                        successText="Memproses..."
                        onConfirm={() => {
                          for (let i = 0; i < bulkQty; i++) {
                            const p = bulkParticipants[i] || {};
                            const missing = customFields.filter(f => f.required && !p[f.id]);
                            if (tshirtInventory.length > 0 && !p['tshirtSize']) {
                              missing.push({ label: 'Ukuran Kaos / Jersey' } as any);
                            }
                            if (missing.length > 0) {
                              setActiveTabIdx(i);
                              message.error(`Pelanggan ${i+1}: Harap isi: ${missing.map(f => f.label).join(', ')}`);
                              return Promise.reject(new Error("Missing fields"));
                            }
                          }
                          setCurrentStep(3);
                          return Promise.resolve();
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Summary & Payment */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                    <h3 className="text-lg font-black mb-4 uppercase tracking-tight text-center">Ringkasan Pendaftaran</h3>
                    
                    <div className="space-y-3 mb-6 bg-stone-50 p-4 rounded-xl">
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Event</span>
                        <span className="font-bold">{event?.name}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500 text-sm">Kategori</span>
                        <span className="font-bold">{selectedCategoryDetail?.name}</span>
                      </div>
                      <div className="flex justify-between pb-2">
                        <span className="text-gray-500 text-sm">Email</span>
                        <span className="font-bold">{regForm.email}</span>
                      </div>
                    </div>

                    <div className="p-8 rounded-2xl flex flex-col items-center border border-stone-200 bg-stone-50/50 shadow-sm">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Total Pembayaran</span>
                      <span className="text-5xl font-black text-stone-900 tracking-tighter">Rp {totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-4">
                    <Button size="large" onClick={() => setCurrentStep(2)} className="w-full sm:w-auto h-14">
                      Kembali
                    </Button>
                    <Button 
                      type="primary" 
                      danger 
                      size="large" 
                      loading={registering} 
                      onClick={handleCheckout} 
                      className="w-full sm:w-auto px-8 font-bold uppercase tracking-widest text-xs h-14"
                      disabled={totalPrice <= 0}
                    >
                      Bayar Sekarang
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-stone-200 text-center">
                <p className="text-sm text-gray-500">
                  Ada kendala saat mendaftar? <a href={`/bantuan?eventId=${event?.id}`} className="text-stone-900 font-bold hover:underline" target="_blank" rel="noopener noreferrer">Lapor di sini</a>
                </p>
              </div>
            </div>
          </Modal>

          {/* QR Scanner Modal */}
          {scannerOpen && (
            <div className="fixed inset-0 bg-stone-950/95 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center p-4">
              <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-[110]">
                <button 
                  className="bg-stone-800/50 hover:bg-stone-700/50 border border-stone-700 text-stone-300 hover:text-white rounded-full p-3 backdrop-blur-md transition-all duration-300"
                  onClick={() => {
                    setScannerOpen(false);
                    setScanValidResult(null);
                    setScanErrorResult(null);
                  }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                <div id="reader" className="w-full h-full object-cover relative z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>
              </div>

              {/* Valid Overlay */}
              {scanValidResult && (
                <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-2xl z-[120] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-full max-w-md bg-stone-900/90 border border-stone-800 rounded-3xl p-8 flex flex-col items-center text-center backdrop-blur-xl relative overflow-hidden">
                    
                    <div className="relative w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6">
                      <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>

                    <div className="text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase mb-3">Peserta Valid</div>
                    
                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 uppercase tracking-tighter leading-tight">
                      {scanValidResult.name}
                    </h1>
                    
                    <div className="text-stone-400 font-medium mb-8 uppercase tracking-widest text-sm">
                      {scanValidResult.category?.name || '-'}
                    </div>
                    
                    <div className="w-full bg-white rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                      <div className="text-stone-400 text-[10px] font-black tracking-widest uppercase mb-1">BIB Number</div>
                      <div className="text-5xl sm:text-6xl font-black text-stone-900 tracking-tighter">
                        {scanValidResult.bib}
                      </div>
                    </div>
                    
                    <div className="mt-8 text-stone-500 text-xs font-bold uppercase tracking-widest">
                      LUMPAT
                    </div>
                  </div>
                </div>
              )}

              {/* Error Overlay */}
              {scanErrorResult && (
                <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-2xl z-[120] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-full max-w-md bg-white border border-red-500 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="text-[10px] font-black tracking-[0.2em] text-red-500 uppercase mb-3 mt-2">Akses Ditolak</div>
                    
                    <h1 className="text-3xl font-black text-stone-900 mb-4 tracking-tighter leading-tight">
                      Gagal Validasi
                    </h1>
                    
                    <div className="w-full mb-4">
                      <p className="text-stone-600 text-sm font-medium">
                        {scanErrorResult}
                      </p>
                    </div>

                    <div className="mt-4 text-stone-400 text-xs font-bold uppercase tracking-widest">
                      LUMPAT
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        <ParticipantModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          data={modalData}
          eventId={event?.id}
        />

        <style>{`
          .event-page {
            min-height: 100vh;
            background: #ffffff;
          }

          .event-banner-header {
            background: #1c1917;
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
