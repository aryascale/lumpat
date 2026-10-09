// src/pages/EventPage.tsx - User facing event detail page

import { useEffect, useMemo, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import RaceClock from "../components/RaceClock";
import CategorySection from "../components/CategorySection";
import LeaderboardTable, { LeaderRow } from "../components/LeaderboardTable";
import InteractiveRouteMap from "../components/InteractiveRouteMap";
import Navbar from "../components/Navbar";
import { message, Modal, Button } from "antd";
import {
  loadMasterParticipants,
  loadTimesMap,
  loadCheckpointTimesMap,
} from "../lib/data";
import { LS_DATA_VERSION } from "../lib/config";
import parseTimeToMs, { extractTimeOfDay, formatDuration, buildOverrideFromFinishDate } from "../lib/time";
import type { MasterParticipant } from "../lib/data";
import { useLiveTiming } from "../hooks/useLiveTiming";
import * as Flags3x2 from "country-flag-icons/react/3x2";

// Windows has no flag emoji font — render SVG flags instead of the unicode ones.
// Data format stays "🇮🇩 Indonesia" so existing rows keep parsing.
const emojiToCode = (emoji: string): string | null => {
  const m = emoji?.match(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/);
  if (!m) return null;
  const a = m[0].codePointAt(0)! - 0x1f1e6;
  const b = m[0].codePointAt(2)! - 0x1f1e6;
  return String.fromCharCode(65 + a, 65 + b);
};

export const FlagImg = ({ emoji, name }: { emoji?: string; name?: string }) => {
  const code = emojiToCode(emoji || "");
  const Flag = code ? (Flags3x2 as any)[code] : null;
  if (!Flag) return null;
  return <Flag className="inline-block w-[18px] h-[13px] mr-1.5 align-[-1px] shadow-sm" title={name} />;
};
import { useAuth, normalizeUserRole } from "../contexts/AuthContext";

function formatLocalTime(ms: number, tzOffset: number, includeMs = true): string {
  const d = new Date(ms + tzOffset * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  if (includeMs) {
    const msec = String(d.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${msec}`;
  }
  return `${hh}:${mm}:${ss}`;
}

/**
 * Match a registered participant (from DB) to a master CSV participant.
 * Strategy: BIB (synced from master upload — strongest) → name+category
 * → name-only fallback.
 */
function matchRegisteredToMaster(
  participant: { name?: string; category?: { name?: string }; bibNumber?: string | null },
  masterList: MasterParticipant[],
): MasterParticipant | undefined {
  const pBib = String(participant.bibNumber || "").trim();
  if (pBib) {
    const byBib = masterList.find(
      (o) => String(o.bib || "").trim() === pBib,
    );
    if (byBib) return byBib;
  }

  const pName = (participant.name || "").trim().toLowerCase();
  if (!pName) return undefined;

  const pCategory = (participant.category?.name || "").trim().toLowerCase();

  // 1st pass: exact name + category
  if (pCategory) {
    const exactMatch = masterList.find((o) => {
      const oName = (o.name || "").trim().toLowerCase();
      const oCat = (o.category || "").trim().toLowerCase();
      return oName === pName && oCat === pCategory;
    });
    if (exactMatch) return exactMatch;
  }

  // 2nd pass: exact name only
  const nameMatch = masterList.find(
    (o) => (o.name || "").trim().toLowerCase() === pName,
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
  manualStartTime?: string | null;
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
  isHidden?: boolean;
  isClosed?: boolean;
  distanceKm?: number | null;
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

// Helper functions for Age Category calculation
// DOB values arrive from master CSVs, registration customData and the DB
// column — in practice a mix of 1990-05-12, 12/05/1990 (Indonesian
// day-first) and 12 Mei 1990. new Date() alone reads day-first dates as
// US month-first and returns NaN for Indonesian month names, silently
// killing the age category — parse all three shapes explicitly.
const MONTHS_ID: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
  agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agu: 7, agt: 7,
  sep: 8, okt: 9, nov: 10, des: 11,
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6,
  august: 7, october: 9, december: 11,
};

function parseDob(dobStr: string): Date | null {
  const s = String(dobStr || "").trim();
  if (!s) return null;
  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy — Indonesian day-first
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // 12 Mei 1990 / 12 May 1990
  const txt = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (txt) {
    const mo = MONTHS_ID[txt[2].toLowerCase()];
    if (mo !== undefined) {
      return new Date(Number(txt[3]), mo, Number(txt[1]));
    }
  }
  // ISO yyyy-mm-dd and anything else JS handles natively
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function calculateAgeOnRaceDay(
  dobStr: string,
  raceDateStr: string,
): number | null {
  if (!dobStr || !raceDateStr) return null;
  const dob = parseDob(dobStr);
  const raceDate = new Date(raceDateStr);
  if (!dob || isNaN(raceDate.getTime())) return null;

  let age = raceDate.getFullYear() - dob.getFullYear();
  const m = raceDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && raceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Age brackets are admin-configurable via event.content.ageCategories
// (Event Detail → Kategori Usia). Defaults keep the legacy grouping.
export type AgeBracket = { name: string; min: number; max: number | null };

const DEFAULT_AGE_BRACKETS: AgeBracket[] = [
  { name: "Student", min: 8, max: 17 },
  { name: "Open", min: 18, max: 39 },
  { name: "Master", min: 40, max: null },
];

export function parseAgeBrackets(raw: any): AgeBracket[] {
  if (!Array.isArray(raw)) return DEFAULT_AGE_BRACKETS;
  const parsed = raw
    .map((b: any) => ({
      name: String(b?.name || "").trim(),
      min: Number(b?.min),
      max: b?.max == null || b?.max === "" ? null : Number(b?.max),
    }))
    .filter((b: AgeBracket) => b.name && Number.isFinite(b.min) && b.min >= 0);
  return parsed.length > 0 ? parsed : DEFAULT_AGE_BRACKETS;
}

export function getAgeCategory(
  age: number | null,
  brackets: AgeBracket[] = DEFAULT_AGE_BRACKETS,
): string {
  if (age === null) return "";
  const b = brackets.find(
    (br) => age >= br.min && (br.max == null || age <= br.max),
  );
  return b ? b.name : "";
}

// Registration DOB lives in the dateOfBirth column, with a customData
// fallback for events whose form stored it as a custom field.
function findDobInCustomData(customData: any): string | null {
  if (!customData) return null;
  const dobKeys = [
    "date of birth", "tanggal lahir", "tgl lahir", "dob",
    "birth date", "birthdate", "birthday",
  ];
  const entry = Object.entries(customData).find(([k]) =>
    dobKeys.some((dk) => k.toLowerCase().includes(dk)),
  );
  return entry && entry[1] ? String(entry[1]) : null;
}

function resolveRegistrationAgeCategory(
  reg: any,
  raceDateStr: string,
  brackets: AgeBracket[],
): string {
  const dob = reg?.dateOfBirth || findDobInCustomData(reg?.customData);
  if (!dob) return "";
  const age = calculateAgeOnRaceDay(String(dob), raceDateStr);
  return getAgeCategory(age, brackets);
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const isStaffUser = !!authUser && normalizeUserRole(authUser.role) !== "user";
  const [event, setEvent] = useState<EventData | null>(null);
  const tzOffset = (event as any)?.timezoneOffset ?? 7;
  const ageBrackets = useMemo(
    () => parseAgeBrackets((event?.content as any)?.ageCategories),
    [event?.content],
  );
  const [banners, setBanners] = useState<Banner[]>([]);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    msg: "Loading event data...",
  });

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [overall, setOverall] = useState<LeaderRow[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, LeaderRow[]>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTabState, setActiveTabState] = useState<string>(
    searchParams.get("tab") || "Home",
  );

  const activeTab = searchParams.get("tab") || activeTabState;
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams(
      (prev) => {
        prev.set("tab", tab);
        return prev;
      },
      { replace: true },
    );
  };
  const [activeRouteCategory, setActiveRouteCategory] = useState<string>("");
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [checkpointMap, setCheckpointMap] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [recalcTick, setRecalcTick] = useState(0);
  const { recordsByEpc, checkpoints } = useLiveTiming(event?.id || "default");
  const [gpxTrackPoints, setGpxTrackPoints] = useState<Array<[number, number]>>(
    [],
  );

  const [registeredParticipants, setRegisteredParticipants] = useState<any[]>(
    [],
  );
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([]);

  const visibleEventCategories = useMemo(() => {
    const hiddenNames = new Set(
      categoryDetails.filter((c) => c.isHidden).map((c) => c.name)
    );
    return (event?.categories || []).filter(
      (catName) => !hiddenNames.has(catName)
    );
  }, [event?.categories, categoryDetails]);

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
    timeoutId: null as any,
  });

  // Scanner Logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (scannerOpen) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (scannerStateRef.current.isPaused) return;

            let id = decodedText;
            if (decodedText.includes("/verify/")) {
              id = decodedText.split("/verify/").pop() || decodedText;
            }

            const p = registeredParticipants.find((x) => x.id === id);
            if (p) {
              if (p.paymentStatus === "settlement") {
                const leader = matchRegisteredToMaster(p, masterParticipants);
                setScanValidResult({ ...p, bib: leader?.bib || "-" });
                setScanErrorResult(null);

                scannerStateRef.current.isPaused = true;
                if (scannerStateRef.current.timeoutId)
                  clearTimeout(scannerStateRef.current.timeoutId);

                scannerStateRef.current.timeoutId = setTimeout(() => {
                  setScanValidResult(null);
                  scannerStateRef.current.isPaused = false;
                }, 4000);
              } else {
                setScanErrorResult(
                  `Peserta (${p.name}) ditemukan, tapi status pembayaran belum lunas (${p.paymentStatus}).`,
                );
                scannerStateRef.current.isPaused = true;
                if (scannerStateRef.current.timeoutId)
                  clearTimeout(scannerStateRef.current.timeoutId);

                scannerStateRef.current.timeoutId = setTimeout(() => {
                  setScanErrorResult(null);
                  scannerStateRef.current.isPaused = false;
                }, 3000);
              }
            } else {
              setScanErrorResult(
                "QR Code tidak dikenali atau bukan peserta event ini.",
              );
              scannerStateRef.current.isPaused = true;
              if (scannerStateRef.current.timeoutId)
                clearTimeout(scannerStateRef.current.timeoutId);

              scannerStateRef.current.timeoutId = setTimeout(() => {
                setScanErrorResult(null);
                scannerStateRef.current.isPaused = false;
              }, 3000);
            }
          },
          () => {
            // Ignore parse errors (runs frequently when camera is scanning empty space)
          },
        )
        .catch((err) => {
          console.error("Scanner error:", err);
        });
    }

    return () => {
      if (scannerStateRef.current.timeoutId)
        clearTimeout(scannerStateRef.current.timeoutId);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode
          .stop()
          .then(() => html5QrCode?.clear())
          .catch(console.error);
      }
    };
  }, [scannerOpen, registeredParticipants, masterParticipants]);

  // Create blob URL for homepage HTML
  // Blob URL renders as a normal page (unlike srcDoc), so CSS animations, fonts, and layouts work naturally.
  useEffect(() => {
    const aboutHtml = event?.content?.about;
    if (
      aboutHtml &&
      (aboutHtml.trim().toLowerCase().startsWith("<!doctype html>") ||
        aboutHtml.trim().toLowerCase().startsWith("<html"))
    ) {
      const blob = new Blob([aboutHtml], { type: "text/html;charset=utf-8" });
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

  const [downloadImage, setDownloadImage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchRegisteredParticipants = async (eventId: string) => {
    try {
      const res = await fetch(`/api/registrations?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredParticipants(data.participants || []);
      }
    } catch (err) {
      console.error("Failed to load participants", err);
    }
  };

  const fetchCategoryDetails = async (eventId: string) => {
    try {
      const res = await fetch(`/api/categories?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        const categories = data.categories || [];
        setCategoryDetails(categories);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  // Post-payment return: order_id in the URL means the user just came back
  // from checkout — poll the payment and confirm via toast + list refresh.
  const orderIdParam = searchParams.get("order_id");
  useEffect(() => {
    if (!event?.id || !orderIdParam) return;
    let alive = true;
    const delays = [1000, 4000, 8000, 15000, 25000];
    let i = 0;
    (async () => {
      while (alive) {
        try {
          const res = await fetch("/api/check-payment-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: orderIdParam }),
          });
          const result = await res.json();
          if (result?.status === "settlement") {
            message.success("Pembayaran berhasil dikonfirmasi! Kamu terdaftar.");
            fetchRegisteredParticipants(event.id);
            return;
          }
          if (result?.status === "cancel" || result?.status === "expire") return;
        } catch {}
        if (i >= delays.length - 1) return;
        await new Promise((r) => setTimeout(r, delays[i]));
        i++;
      }
    })();
    return () => {
      alive = false;
    };
  }, [event?.id, orderIdParam]);

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
        console.error("Failed to load banners:", error);
      }
    })();
  }, [event?.id]);

  // Removed banner auto-rotate (using parallax hero)

  // Load GPX data
  useEffect(() => {
    const routeGpxFiles = event?.content?.routeGpxFiles || {};
    const routeCategories = Object.keys(routeGpxFiles);

    // Auto-select first category if none selected but available
    if (!activeRouteCategory && routeCategories.length > 0) {
      setActiveRouteCategory(routeCategories[0]);
      return; // effect will re-run
    }

    const gpxUrl = activeRouteCategory
      ? routeGpxFiles[activeRouteCategory]
      : event?.gpxFile;

    if (!gpxUrl) {
      setGpxTrackPoints([]);
      return;
    }

    (async () => {
      try {
        const response = await fetch(gpxUrl);
        if (!response.ok) {
          console.error("Failed to load GPX file");
          return;
        }

        const gpxText = await response.text();
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, "text/xml");

        // Parse track points
        const trackPoints: Array<[number, number]> = [];
        const trkpts = gpxDoc.querySelectorAll("trkpt");

        trkpts.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute("lat") || "0");
          const lon = parseFloat(pt.getAttribute("lon") || "0");
          if (lat && lon) {
            trackPoints.push([lat, lon]);
          }
        });

        // Also check for route points (rtept)
        if (trackPoints.length === 0) {
          const rtepts = gpxDoc.querySelectorAll("rtept");
          rtepts.forEach((pt) => {
            const lat = parseFloat(pt.getAttribute("lat") || "0");
            const lon = parseFloat(pt.getAttribute("lon") || "0");
            if (lat && lon) {
              trackPoints.push([lat, lon]);
            }
          });
        }

        setGpxTrackPoints(trackPoints);
      } catch (error) {
        console.error("Error parsing GPX:", error);
      }
    })();
  }, [event?.gpxFile, event?.content?.routeGpxFiles, activeRouteCategory]);

  // Load race data (participants, results)
  useEffect(() => {
    if (!event?.id) return;

    (async () => {
      try {
        if (!hasLoadedOnce) {
          setState({
            status: "loading",
            msg: searchParams.get("participant")
              ? "Menyiapkan hasil peserta..."
              : "Loading participant data...",
          });
        }

        // All inputs below are independent — fetch in parallel so the
        // leaderboard (and participant deep-links) resolve as fast as the
        // slowest single request instead of the sum of all of them.
        const fetchJsonArray = (url: string) =>
          fetch(url)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);

        const [
          master,
          startMap,
          finishMap,
          cpMap,
          statusData,
          penData,
          msData,
          mfData,
        ] = await Promise.all([
          loadMasterParticipants(event.id),
          loadTimesMap("start", event.id, tzOffset),
          loadTimesMap("finish", event.id, tzOffset),
          loadCheckpointTimesMap(event.id),
          fetchJsonArray(`/api/runner-status?eventId=${event.id}`),
          fetchJsonArray(`/api/penalty?eventId=${event.id}`),
          fetchJsonArray(`/api/manual-start-bib?eventId=${event.id}&_t=${Date.now()}`),
          fetchJsonArray(`/api/manual-finish-bib?eventId=${event.id}&_t=${Date.now()}`),
        ]);

        setMasterParticipants(master.all);
        setCheckpointMap(cpMap);

        // Use timing from event (per-event database) instead of localStorage
        const cutoffMs = event.cutoffMs ?? null;

        // Runner status map
        const dqMap: Record<string, boolean> = {};
        const dnsMap: Record<string, boolean> = {};
        const dnfMap: Record<string, boolean> = {};
        const hiddenMap: Record<string, boolean> = {};
        if (Array.isArray(statusData)) {
          statusData.forEach((s: any) => {
            if (s.isDQ) dqMap[s.epc] = true;
            if (s.isDNS) dnsMap[s.epc] = true;
            if (s.isDNF) dnfMap[s.epc] = true;
            if (s.isHidden) hiddenMap[s.epc] = true;
          });
        }
        const catStartRaw = event.categoryStartTimes ?? {};

        // Penalty map
        const penaltyMap = new Map<string, number>();
        if (Array.isArray(penData)) {
          penData.forEach((p: any) => penaltyMap.set(p.epc, p.penaltyMs || 0));
        }

        // Manual start map
        const manualStartMap = new Map<string, string>();
        if (Array.isArray(msData)) {
          msData.forEach((ms: any) => manualStartMap.set(ms.epc, ms.timeStr));
        }

        // Manual finish map
        const manualFinishMap = new Map<string, string>();
        if (Array.isArray(mfData)) {
          mfData.forEach((mf: any) => manualFinishMap.set(mf.epc, mf.timeStr));
        }

        const normCat = (s: string) =>
          String(s || "")
            .trim()
            .toLowerCase()
            .replace(/-/g, " ")
            .replace(/\s+/g, " ");

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
            const parsed = parseTimeToMs(s, tzOffset);
            absOverrideMs[normKey] = parsed.ms;
            timeOnlyStr[normKey] = null;
          } else {
            absOverrideMs[normKey] = null;
            timeOnlyStr[normKey] = s;
          }
        });

        const baseRows: LeaderRow[] = [];

        if (!master?.all || master.all.length === 0) {
          registeredParticipants
            .filter((p) => p.paymentStatus === "settlement")
            .forEach((p) => {
              baseRows.push({
                rank: null,
                bib: p.bibName || "RDY",
                name: p.name,
                gender: p.gender || "U",
                category: p.category?.name || "REG",
                sourceCategoryKey: p.category?.name || "REG",
                ageCategory: resolveRegistrationAgeCategory(
                  p,
                  event?.eventDate || "",
                  ageBrackets,
                ),
                finishTimeRaw: "-",
                totalTimeMs: 0,
                totalTimeDisplay: "Registered",
                epc: p.id,
                distanceKm: categoryDetails.find((c) => c.name === (p.category?.name || "REG"))?.distanceKm ?? null,
              });
            });
        } else {
          const adminCategories = visibleEventCategories;

          // Map master rows to their registration so age category can be
          // derived from the participant's date of birth when the CSV master
          // has no age column. matchRegisteredToMaster tries BIB first
          // (synced from master upload), then name+category, then name.
          const regByMasterEpc = new Map<string, any>();
          registeredParticipants.forEach((reg: any) => {
            const m = matchRegisteredToMaster(reg, master.all);
            if (m && !regByMasterEpc.has(m.epc)) {
              regByMasterEpc.set(m.epc, reg);
            }
          });
          const resolveDobAgeCategory = (epc: string) =>
            resolveRegistrationAgeCategory(
              regByMasterEpc.get(epc) ?? null,
              event?.eventDate || "",
              ageBrackets,
            );

          const resolveAdminCategory = (cat: string, gender: string) => {
            const normCatStr = normCat(cat);
            const exact = adminCategories.find(
              (c) => normCat(c) === normCatStr,
            );
            if (exact) return exact;

            const genderStr = normCat(gender);
            const combined = normCat(`${cat} ${genderStr}`);
            const combinedMatch = adminCategories.find(
              (c) => normCat(c) === combined,
            );
            if (combinedMatch) return combinedMatch;

            // Try word boundary match (e.g., "10k" matches "10k laki-laki" but not "110k")
            const partial = adminCategories.find((c) => {
              const nc = normCat(c);
              const regex = new RegExp(`(?:^|\\s)${nc}(?:\\s|$)`, "i");
              return regex.test(normCatStr);
            });
            if (partial) return partial;

            return cat;
          };

          master.all.forEach((p) => {
            const resolvedCategoryKey = resolveAdminCategory(
              p.sourceCategoryKey,
              p.gender,
            );

            const isDQ = !!dqMap[p.epc];
            const isDNS = !!dnsMap[p.epc];
            const manualDNF = !!dnfMap[p.epc];
            if (hiddenMap[p.epc]) return;
            // CSV age category wins; then CSV DOB, then registration DOB
            const effAgeCategory =
              p.ageCategory ||
              (p.dob
                ? getAgeCategory(
                    calculateAgeOnRaceDay(p.dob, event?.eventDate || ""),
                    ageBrackets,
                  )
                : "") ||
              resolveDobAgeCategory(p.epc);
            let finishEntry = finishMap.get(p.epc);

            const manualFinishStr = manualFinishMap.get(p.epc);
            const epsRecords = recordsByEpc[p.epc];

            // ================= LOOP MODE LOGIC =================
            // Only apply automatic Loop Mode logic if there's no manual CSV finish override
            if (
              (event as any)?.isLoopMode &&
              !manualFinishStr &&
              epsRecords &&
              epsRecords.length > 0
            ) {
              const minLapMs =
                (event as any).minLapTimeMs != null
                  ? (event as any).minLapTimeMs
                  : 300000;
              const maxLaps = (event as any).content?.maxLaps
                ? parseInt((event as any).content.maxLaps)
                : null;

              const startEntry = startMap.get(p.epc);
              let baseStartTime = (event as any)?.manualStartTime
                ? parseTimeToMs((event as any).manualStartTime, tzOffset).ms
                : startEntry?.ms || null;
              let rawStartStrForDisplay = startEntry?.raw || null;

              const validLaps: any[] = [];
              let total: number | null = null;
              let finishEntryLocal: any = null;

              if (epsRecords && epsRecords.length > 0) {
                const sortedRecords = [...epsRecords].sort(
                  (a, b) =>
                    new Date(a.time).getTime() - new Date(b.time).getTime(),
                );
                if (!baseStartTime) {
                  baseStartTime = new Date(sortedRecords[0].time).getTime();
                  rawStartStrForDisplay = formatLocalTime(baseStartTime, tzOffset);
                }

                const lastTimeByCp: Record<string, number> = {};
                lastTimeByCp[sortedRecords[0].checkpointName] = baseStartTime;

                let lapCounter = 1;

                for (let i = 1; i < sortedRecords.length; i++) {
                  const rec = sortedRecords[i];
                  const cpName = rec.checkpointName;
                  const t = new Date(rec.time).getTime();

                  const lastTimeForThisCp = lastTimeByCp[cpName] || 0;

                  if (t - lastTimeForThisCp >= minLapMs) {
                    if (maxLaps != null && lapCounter > maxLaps) {
                      break;
                    }

                    validLaps.push({
                      time: t,
                      name: cpName,
                      lapIndex: lapCounter,
                    });
                    lastTimeByCp[cpName] = t;

                    const cpLower = cpName.toLowerCase();
                    if (cpLower.includes("finish") || cpLower.includes("end")) {
                      lapCounter++;
                    }
                  }
                }

                if (validLaps.length > 0) {
                  const lastCrossing = validLaps[validLaps.length - 1].time;
                  total = lastCrossing - baseStartTime;
                  finishEntryLocal = {
                    ms: lastCrossing,
                    raw: formatLocalTime(lastCrossing, tzOffset, false),
                  };
                }
              }

              if (total != null && total > 0) {
                // We have a valid Loop Mode calculation, execute early return
                const penMs = penaltyMap.get(p.epc) || 0;
                total += penMs;

                const isDNF = cutoffMs != null && total > cutoffMs;

                const lapsDisplay = validLaps.map((lap) => {
                  const duration = lap.time - baseStartTime!;
                  let displayName = lap.name;
                  if (
                    displayName.toUpperCase() === "START/FINISH" ||
                    displayName.toUpperCase() === "START / FINISH"
                  ) {
                    displayName = "FINISH";
                  }
                  return {
                    label: `L${lap.lapIndex} - ${displayName}`,
                    timeDisplay: formatDuration(duration),
                    isDuration: true,
                  };
                });

                baseRows.push({
                  rank: null,
                  bib: p.bib,
                  name: p.name,
                  gender: p.gender,
                  category: p.category || resolvedCategoryKey,
                  sourceCategoryKey: resolvedCategoryKey,
                  ageCategory: effAgeCategory,
                  startTimeRaw: rawStartStrForDisplay
                    ? extractTimeOfDay(rawStartStrForDisplay)
                    : baseStartTime
                      ? formatLocalTime(baseStartTime, tzOffset)
                      : "-",
                  finishTimeRaw: extractTimeOfDay(finishEntryLocal?.raw || ""),
                  totalTimeMs: total ?? 0,
                  totalTimeDisplay: isDQ ? "DSQ" : isDNS ? "DNS" : manualDNF ? "DNF" : isDNF ? "DNF" : formatDuration(total),
                  penaltyMs: penMs,
                  epc: p.epc,
                  laps: lapsDisplay,
                  distanceKm: categoryDetails.find((c) => c.name === (p.category || resolvedCategoryKey))?.distanceKm ?? null,
                });

                return;
              }
            }
            // ================= END LOOP MODE LOGIC =================

            if (manualFinishStr) {
              const mfMs = buildOverrideFromFinishDate(
                Date.now(),
                manualFinishStr,
                tzOffset
              );
              if (mfMs) {
                finishEntry = { ms: mfMs, raw: manualFinishStr };
              }
            }

            // Fallback to Live Record for FINISH checkpoint
            if (!finishEntry?.ms && epsRecords && epsRecords.length > 0) {
              const finishRecord = epsRecords.find(
                (r) =>
                  r.checkpointName.toLowerCase().includes("finish") ||
                  r.identitas.toLowerCase().includes("finish") ||
                  r.order === 999 ||
                  checkpoints
                    .find((cp) => cp.identitas === r.identitas)
                    ?.name.toLowerCase()
                    .includes("finish"),
              );
              if (finishRecord) {
                const finishMs = new Date(finishRecord.time).getTime();
                const finishRawLocal = formatLocalTime(finishMs, tzOffset);
                finishEntry = {
                  ms: finishMs,
                  raw: finishRawLocal,
                };
              }
            }

            const pushIncompleteRow = (
              statusText: string,
              computedStartMs?: number | null,
              rawStart?: string | null,
            ) => {
              baseRows.push({
                rank: null,
                bib: p.bib,
                name: p.name,
                gender: p.gender,
                category: p.category || resolvedCategoryKey,
                sourceCategoryKey: resolvedCategoryKey,
                ageCategory: effAgeCategory,
                startTimeRaw: rawStart
                  ? extractTimeOfDay(rawStart)
                  : computedStartMs
                    ? formatLocalTime(computedStartMs, tzOffset)
                    : "-",
                finishTimeRaw: extractTimeOfDay(finishEntry?.raw || "-"),
                totalTimeMs: 0,
                totalTimeDisplay: isDQ ? "DSQ" : isDNS ? "DNS" : manualDNF ? "DNF" : statusText,
                epc: p.epc,
                distanceKm: categoryDetails.find((c) => c.name === (p.category || resolvedCategoryKey))?.distanceKm ?? null,
              });
            };

            const catKey = normCat(resolvedCategoryKey);
            let absMs = absOverrideMs[catKey] ?? null;
            let timeOnly = timeOnlyStr[catKey] ?? null;

            // Global T0 priority: manualStartMs > startEntry.ms
            const manualStartMs = (event as any)?.manualStartTime
              ? parseTimeToMs((event as any).manualStartTime, tzOffset).ms
              : null;
            const startEntry = startMap.get(p.epc);
            let fallbackStartMs = manualStartMs || startEntry?.ms || null;

            // Individual per-BIB Manual Start Priority overrides Global AND Category Start
            const bibManualStartStr = manualStartMap.get(p.epc);
            let rawStartStr = startEntry?.raw;

            // Fallback to Live Record for START checkpoint
            if (!fallbackStartMs && epsRecords && epsRecords.length > 0) {
              const startRecord = epsRecords.find(
                (r) =>
                  r.checkpointName.toLowerCase().includes("start") ||
                  r.identitas.toLowerCase().includes("start") ||
                  r.order === 0 ||
                  checkpoints
                    .find((cp) => cp.identitas === r.identitas)
                    ?.name.toLowerCase()
                    .includes("start"),
              );
              if (startRecord) {
                fallbackStartMs = new Date(startRecord.time).getTime();
                rawStartStr = formatLocalTime(fallbackStartMs, tzOffset);
              }
            }

            if (bibManualStartStr) {
              const builtOverride = finishEntry?.ms
                ? buildOverrideFromFinishDate(finishEntry.ms, bibManualStartStr, tzOffset)
                : buildOverrideFromFinishDate(Date.now(), bibManualStartStr, tzOffset);
              if (builtOverride != null) {
                fallbackStartMs = builtOverride;
                absMs = null;
                timeOnly = null;
                rawStartStr = bibManualStartStr;
              }
            }

            if (!finishEntry?.ms) {
              pushIncompleteRow(
                fallbackStartMs ? "Active" : "-",
                fallbackStartMs,
                rawStartStr,
              );
              return;
            }

            let total: number | null = null;

            if (absMs != null && Number.isFinite(absMs)) {
              const delta = finishEntry.ms - absMs;
              if (Number.isFinite(delta)) {
                total = delta;
              } else if (fallbackStartMs) {
                total = finishEntry.ms - fallbackStartMs;
              }
            } else if (timeOnly) {
              const builtOverride = buildOverrideFromFinishDate(
                finishEntry.ms,
                timeOnly,
                tzOffset
              );
              if (builtOverride != null) {
                const delta = finishEntry.ms - builtOverride;
                if (Number.isFinite(delta)) {
                  total = delta;
                } else if (fallbackStartMs) {
                  total = finishEntry.ms - fallbackStartMs;
                }
              } else if (fallbackStartMs) {
                total = finishEntry.ms - fallbackStartMs;
              }
            } else if (fallbackStartMs) {
              total = finishEntry.ms - fallbackStartMs;
            }

            if (!Number.isFinite(total) || total == null) {
              pushIncompleteRow("NO START TIME", fallbackStartMs, rawStartStr);
              return;
            }

            // Add penalty time
            const penMs = penaltyMap.get(p.epc) || 0;
            total += penMs;

            const isDNF = cutoffMs != null && total > cutoffMs;

            let t0Ms: number | null = null;
            if (absMs != null && Number.isFinite(absMs)) {
              t0Ms = absMs;
            } else {
              t0Ms = fallbackStartMs || null;
            }

            const matchedLaps = checkpoints.map((cpDef: any, index: number) => {
              const cpId = cpDef.identitas || cpDef.id;
              let label = cpDef.name || cpDef.identitas || cpDef.id;

              if (
                label.toUpperCase() === "START/FINISH" ||
                label.toUpperCase() === "START / FINISH"
              ) {
                if (index === 0 && checkpoints.length > 1) {
                  label = "START";
                } else {
                  label = "FINISH";
                }
              }

              // Find if this EPC has a record for this checkpoint
              const recordForCp = epsRecords?.find(
                (rec: any) => rec.identitas === cpId,
              );

              if (!recordForCp)
                return { label, timeDisplay: "-", isDuration: false };

              const cpTime = new Date(recordForCp.time);

              // If we have a start time, show relative duration, otherwise show time of day
              if (t0Ms) {
                const diffMs = cpTime.getTime() - t0Ms;
                if (diffMs > 0) {
                  return {
                    label,
                    timeDisplay: formatDuration(diffMs),
                    isDuration: true,
                  };
                }
              }

              const cpTimeStr = formatLocalTime(cpTime.getTime(), tzOffset, false);
              return { label, timeDisplay: cpTimeStr, isDuration: false };
            });

            baseRows.push({
              rank: null,
              bib: p.bib,
              name: p.name,
              gender: p.gender,
              category: p.category || resolvedCategoryKey,
              sourceCategoryKey: resolvedCategoryKey,
              ageCategory: effAgeCategory,
              startTimeRaw: rawStartStr
                ? extractTimeOfDay(rawStartStr)
                : t0Ms
                  ? formatLocalTime(t0Ms, tzOffset)
                  : "-",
              finishTimeRaw: extractTimeOfDay(finishEntry.raw),
              totalTimeMs: total,
              totalTimeDisplay: isDQ
                ? "DSQ"
                : isDNS
                  ? "DNS"
                  : (manualDNF || isDNF)
                    ? "DNF"
                    : formatDuration(total),
              penaltyMs: penMs,
              epc: p.epc,
              laps: matchedLaps,
              distanceKm: categoryDetails.find((c) => c.name === (p.category || resolvedCategoryKey))?.distanceKm ?? null,
            });
          });
        }

        const finishers = baseRows.filter(
          (r) =>
            r.totalTimeDisplay !== "DNF" &&
            r.totalTimeDisplay !== "DSQ" &&
            r.totalTimeDisplay !== "ACTIVE" &&
            r.totalTimeDisplay !== "Active" &&
            r.totalTimeDisplay !== "RUNNER" &&
            r.totalTimeDisplay !== "NO START TIME" &&
            r.totalTimeDisplay !== "Registered" &&
            r.totalTimeDisplay !== "DNS" &&
            r.totalTimeDisplay !== "-",
        );

        const finisherSorted = [...finishers]
          .sort((a, b) => {
            const aLaps = a.laps?.length || 0;
            const bLaps = b.laps?.length || 0;
            if (aLaps !== bLaps) return bLaps - aLaps;
            return a.totalTimeMs - b.totalTimeMs;
          })
          .map((r, i) => ({ ...r, rank: i + 1 }));

        const finisherRankByEpc = new Map(
          finisherSorted.map((r) => [r.epc, r.rank!]),
        );
        const categoryRankByEpc = new Map<string, number>();
        const genderRankByEpc = new Map<string, number>();
        const ageRankByEpc = new Map<string, number>();

        const eventCategories = visibleEventCategories;
        const eventCategoriesToLoop =
          eventCategories.length > 0
            ? eventCategories
            : Array.from(
                new Set(finisherSorted.map((r) => r.sourceCategoryKey)),
              );

        eventCategoriesToLoop.forEach((catKey: string) => {
          // Category Rank: Scoped by Distance (Category)
          const catList = finisherSorted.filter(
            (r) => r.sourceCategoryKey === catKey,
          );
          catList.forEach((r, i) => categoryRankByEpc.set(r.epc, i + 1));

          // Gender Rank: Scoped by Distance + Gender
          const genders = Array.from(
            new Set(catList.map((r) => (r.gender || "").toLowerCase())),
          );
          genders.forEach((g) => {
            const genderList = catList.filter(
              (r) => (r.gender || "").toLowerCase() === g,
            );
            genderList.forEach((r, i) => genderRankByEpc.set(r.epc, i + 1));

            // Age Rank: Scoped by Distance + Gender + Age Category
            const ageCategories = Array.from(
              new Set(genderList.map((r) => (r.ageCategory || "").trim())),
            );
            ageCategories.forEach((age) => {
              if (!age || age === "-") return;
              const ageList = genderList.filter(
                (r) => (r.ageCategory || "").trim() === age,
              );
              ageList.forEach((r, i) => ageRankByEpc.set(r.epc, i + 1));
            });
          });
        });

        const dnfs = baseRows
          .filter((r) => r.totalTimeDisplay === "DNF")
          .sort((a, b) => a.totalTimeMs - b.totalTimeMs);
        const dsqs = baseRows.filter((r) => r.totalTimeDisplay === "DSQ");
        const actives = baseRows.filter(
          (r) => r.totalTimeDisplay === "ACTIVE" || r.totalTimeDisplay === "Active" || r.totalTimeDisplay === "RUNNER"
        );
        const registereds = baseRows.filter(
          (r) => r.totalTimeDisplay === "Registered",
        );
        const noStartTimes = baseRows.filter(
          (r) => r.totalTimeDisplay === "NO START TIME",
        );

        const overallFinal: LeaderRow[] = [
          ...finisherSorted,
          ...actives.map((r) => ({ ...r, rank: null })),
          ...dnfs.map((r) => ({ ...r, rank: null })),
          ...dsqs.map((r) => ({ ...r, rank: null })),
          ...noStartTimes.map((r) => ({ ...r, rank: null })),
          ...registereds.map((r) => ({ ...r, rank: null })),
        ];

        const catMap: Record<string, LeaderRow[]> = {};
        visibleEventCategories.forEach((catKey) => {
          const list = overallFinal.filter(
            (r) => normCat(r.sourceCategoryKey) === normCat(catKey),
          );
          catMap[catKey] = list;
        });

        setOverall(overallFinal);
        setByCategory(catMap);

        (EventPage as any)._rankMaps = {
          finisherRankByEpc,
          genderRankByEpc,
          categoryRankByEpc,
          ageRankByEpc,
        };

        setState({ status: "ready" });
        setHasLoadedOnce(true);
      } catch (e: any) {
        console.error("fetchData error:", e);
        // Allow page to render even without data - don't block UI
        setState({ status: "ready" });
        setHasLoadedOnce(true);
      }
    })();
  }, [
    recalcTick,
    event?.id,
    visibleEventCategories,
    registeredParticipants,
    recordsByEpc,
    checkpoints,
  ]);

  // Patch latestCp from live timing directly into rows
  const overallWithLatestCp = useMemo(() => {
    if (Object.keys(recordsByEpc).length === 0) return overall;
    return overall.map((row) => {
      const recs = recordsByEpc[row.epc];
      if (!recs || recs.length === 0) return row;
      const latest = recs[recs.length - 1];
      const cpTimeStr = formatLocalTime(new Date(latest.time).getTime(), tzOffset, false);
      return { ...row, latestCp: `${latest.checkpointName} (${cpTimeStr})` };
    });
  }, [overall, recordsByEpc]);

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
    const routeGpxFiles = event?.content?.routeGpxFiles || {};
    const hasRoute =
      event?.gpxFile ||
      Object.keys(routeGpxFiles).length > 0 ||
      (event?.latitude && event?.longitude);
    if (hasRoute) {
      baseTabs.push("Route");
    }
    if (event?.content?.galleryUrls && event.content.galleryUrls.length > 0) {
      baseTabs.push("Gallery");
    }
    baseTabs.push("Results");

    // Append categories
    return [...baseTabs, ...visibleEventCategories];
  }, [
    visibleEventCategories,
    event?.gpxFile,
    event?.content?.routeGpxFiles,
    event?.latitude,
    event?.longitude,
    event?.content?.galleryUrls,
  ]);

  const onSelectParticipant = (row: LeaderRow, opts?: { replace?: boolean }) => {
    // Exclude unranked status values to compute correct finisher ranks
    const finishers = overall.filter(
      (r) =>
        r.totalTimeDisplay !== "DNF" &&
        r.totalTimeDisplay !== "DSQ" &&
        r.totalTimeDisplay !== "ACTIVE" &&
        r.totalTimeDisplay !== "Active" &&
        r.totalTimeDisplay !== "RUNNER" &&
        r.totalTimeDisplay !== "NO START TIME" &&
        r.totalTimeDisplay !== "Registered" &&
        r.totalTimeDisplay !== "DNS" &&
        r.totalTimeDisplay !== "-"
    );

    // Sort by laps completed (descending) and time (ascending)
    const sortedOverall = [...finishers].sort((a, b) => {
      const aLaps = a.laps?.length || 0;
      const bLaps = b.laps?.length || 0;
      if (aLaps !== bLaps) return bLaps - aLaps;
      return a.totalTimeMs - b.totalTimeMs;
    });

    const overallIndex = sortedOverall.findIndex((r) => r.epc === row.epc);
    const overallRank = overallIndex !== -1 ? overallIndex + 1 : null;

    // Category Rank (scoped by distance / category)
    const sortedCategory = sortedOverall.filter((r) => r.category === row.category);
    const categoryIndex = sortedCategory.findIndex((r) => r.epc === row.epc);
    const categoryRank = categoryIndex !== -1 ? categoryIndex + 1 : null;

    // Gender Rank (scoped by category + gender)
    const sortedGender = sortedCategory.filter(
      (r) => (r.gender || "").toLowerCase() === (row.gender || "").toLowerCase()
    );
    const genderIndex = sortedGender.findIndex((r) => r.epc === row.epc);
    const genderRank = genderIndex !== -1 ? genderIndex + 1 : null;

    // Age Category Rank (scoped by category + gender + ageCategory)
    const rowAge = (row.ageCategory || "").trim();
    const sortedAge = rowAge && rowAge !== "-" 
      ? sortedGender.filter((r) => (r.ageCategory || "").trim() === rowAge)
      : [];
    const ageIndex = sortedAge.findIndex((r) => r.epc === row.epc);
    const ageRank = ageIndex !== -1 ? ageIndex + 1 : null;

    const data = {
      name: row.name,
      bib: row.bib,
      gender: row.gender,
      category: row.category,
      ageCategory: row.ageCategory,
      startTimeRaw: row.startTimeRaw ?? "-",
      finishTimeRaw: row.finishTimeRaw,
      totalTimeDisplay: row.totalTimeDisplay,
      checkpointTimes: checkpointMap.get(row.epc) || [],
      penaltyMs: row.penaltyMs || 0,
      totalTimeMs: row.totalTimeMs,
      overallRank,
      genderRank,
      categoryRank,
      ageRank,
      distanceKm: row.distanceKm,
    };

    navigate(`/event/${slug}/participant/${row.epc}`, {
      state: { modalData: data, eventId: event?.id, eventName: event?.name },
      replace: !!opts?.replace,
    });
  };

  // Rehydrate participant deep-links (?participant=<epc|bib>) — direct URL access
  // and refresh bounce here first because the participant page needs leaderboard
  // state that only exists in memory. Once rows are ready, forward to the
  // participant route (with full state), or render its not-found state.
  const deepLinkEpc = searchParams.get("participant");
  useEffect(() => {
    if (!deepLinkEpc || overall.length === 0) return;
    const row = overall.find((r) => r.epc === deepLinkEpc || r.bib === deepLinkEpc);
    if (row) {
      onSelectParticipant(row, { replace: true });
    } else {
      navigate(`/event/${slug}/participant/${deepLinkEpc}`, {
        state: { notFound: true, eventId: event?.id, eventName: event?.name },
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkEpc, overall]);



  if (!event) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div
            className="card"
            style={{ textAlign: "center", padding: "3rem" }}
          >
            {state.status === "loading" ? (
              <>
                <div className="loading-spinner" />
                <p>{state.msg}</p>
              </>
            ) : (
              <>
                <h2>Event tidak ditemukan</h2>
                <Link
                  to="/events"
                  className="btn"
                  style={{ marginTop: "1rem" }}
                >
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
  const coverImageUrl = hasCover
    ? event.bannerUrl
    : banners.length > 0
      ? banners[0].imageUrl
      : "";

  const executeDownload = async () => {
    if (!downloadImage) return;
    setIsDownloading(true);
    try {
      const response = await fetch(downloadImage);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `gallery-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setDownloadImage(null);
    } catch (err) {
      message.error("Gagal mengunduh gambar");
    } finally {
      setIsDownloading(false);
    }
  };

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
                transform: `translateY(${scrollY * 0.4}px)`,
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
                <img
                  src={event.logoUrl}
                  alt={event.name}
                  className="w-16 h-16 md:w-40 md:h-40 object-contain border-2 md:border-4 border-white shadow-2xl bg-white flex-shrink-0 rounded-xl md:rounded-none"
                />
              ) : (
                <div className="w-16 h-16 md:w-40 md:h-40 border-2 md:border-4 border-stone-800 bg-stone-900 shadow-2xl flex items-center justify-center text-center p-1 flex-shrink-0 rounded-xl md:rounded-none">
                  <span className="text-stone-700 font-bold uppercase tracking-widest text-[7px] md:text-xs">
                    No Logo
                  </span>
                </div>
              )}
              <div className="flex-1 w-full min-w-0 pb-1 md:pb-2">
                <div className="flex items-center justify-center md:justify-start gap-2 md:gap-4 mb-2 md:mb-3 flex-wrap">
                  <span className="bg-red-600 text-white px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-black tracking-widest uppercase">
                    {event.eventDate
                      ? new Date(event.eventDate).getFullYear()
                      : "RACE"}
                  </span>
                  <span className="text-stone-300 text-[10px] md:text-sm font-semibold tracking-wider uppercase">
                    {event.eventDate
                      ? event.content?.isDateTBA
                        ? new Date(event.eventDate).toLocaleDateString(
                            "en-US",
                            { month: "long" },
                          )
                        : new Date(event.eventDate).toLocaleDateString(
                            "en-US",
                            { month: "long", day: "numeric" },
                          )
                      : ""}
                  </span>
                  {event.location && (
                    <span className="hidden md:inline text-stone-400 text-sm font-medium tracking-wide">
                      • {event.location}
                    </span>
                  )}
                </div>
                <h1 className="text-lg md:text-5xl font-black text-white tracking-tight md:tracking-tighter uppercase leading-tight md:leading-none drop-shadow-lg mb-1 md:mb-2 whitespace-normal">
                  {event.name}
                </h1>
                {event.location && (
                  <span className="md:hidden text-stone-300 text-xs font-semibold tracking-wide mt-1 uppercase block">
                    {event.location}
                  </span>
                )}
                {event.description && (
                  <p className="hidden md:block text-stone-300 text-base max-w-2xl font-medium tracking-wide mt-4 border-l-2 border-white/50 pl-4">
                    {event.description}
                  </p>
                )}

                {event.eventDate &&
                new Date(event.eventDate).setHours(0, 0, 0, 0) <
                  new Date().setHours(0, 0, 0, 0) ? (
                  <button
                    disabled
                    className="mt-3 md:mt-6 bg-stone-500 text-stone-300 font-bold py-2 md:py-3 px-6 md:px-10 rounded-full uppercase tracking-widest text-[10px] md:text-xs mx-auto md:mx-0 block md:inline-block cursor-not-allowed opacity-80"
                  >
                    Event Selesai
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/event/${slug}/daftar`)}
                    className="mt-3 md:mt-6 bg-white text-black mix-blend-difference font-bold py-2 md:py-3 px-6 md:px-10 rounded-full uppercase tracking-widest text-[10px] md:text-xs transition-transform hover:scale-105 cursor-pointer mx-auto md:mx-0 block md:inline-block shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                  >
                    Daftar Sekarang →
                  </button>
                )}
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
        <div
          className={`${activeTab === "Home" ? "w-full" : "max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-0 md:py-8"}`}
        >
          {activeTab === "Home" && (
            <div className="animate-in fade-in duration-700">
              {/* Event Hero Banner (Original Ratio) */}
              {event.homeImageUrl && (
                <div className="w-full overflow-hidden">
                  <img
                    src={event.homeImageUrl}
                    alt={event.name}
                    className="w-full object-contain block mx-auto"
                  />
                </div>
              )}

              {/* Banner Gallery */}
              {banners.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banners.map((b) => (
                    <div key={b.id} className="overflow-hidden shadow-lg group">
                      <img
                        src={b.imageUrl}
                        alt={b.alt || event?.name}
                        className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105"
                      />
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
                          style={{ minHeight: "100vh", width: "100%" }}
                          onLoad={(e) => {
                            try {
                              const iframe = e.target as HTMLIFrameElement;
                              const doc = iframe.contentWindow?.document;
                              if (!doc) return;

                              // Auto-resize iframe height
                              const resize = () => {
                                try {
                                  const h = doc.documentElement.scrollHeight;
                                  if (h > 100) iframe.style.height = h + "px";
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
                                doc.body.addEventListener("click", (ev) => {
                                  const target = ev.target as HTMLElement;
                                  const btn = target.closest(
                                    'a[href="#tickets"], a[href="#participants"], button[data-ticket], .btn-buy, .btn-fun, .rp-badge, .rp-coming, .rp-submit-btn',
                                  );
                                  if (
                                    btn &&
                                    (btn as HTMLElement).id !== "backToTop"
                                  ) {
                                    ev.preventDefault();
                                    
                                    if (btn.classList.contains('rp-badge') || btn.classList.contains('rp-coming') || btn.classList.contains('rp-submit-btn')) {
                                      navigate(`/event/${slug}/daftar`);
                                      return;
                                    }

                                    const participantsTab =
                                      document.querySelector(
                                        'button[data-tab="Participants"]',
                                      ) as HTMLButtonElement;
                                    if (participantsTab) {
                                      participantsTab.click();
                                      window.scrollTo({
                                        top: 0,
                                        behavior: "smooth",
                                      });
                                    }
                                  }
                                });
                              } catch {}
                            } catch (err) {
                              console.error("iframe setup error:", err);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="w-full overflow-hidden"
                          dangerouslySetInnerHTML={{
                            __html: event.content.about,
                          }}
                          onClick={(ev) => {
                            const target = ev.target as HTMLElement;
                            const btn = target.closest(
                              '.rp-badge, .rp-coming, .rp-submit-btn'
                            );
                            if (btn) {
                              ev.preventDefault();
                              navigate(`/event/${slug}/daftar`);
                            }
                          }}
                        />
                      )
                    ) : event?.description ? (
                      <div className="bg-white p-8 shadow-sm border-t-4 border-stone-900 prose prose-stone max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase">
                        <p className="leading-relaxed">{event.description}</p>
                      </div>
                    ) : (
                      <div className="bg-white p-8 shadow-sm border-t-4 border-stone-200">
                        <p className="text-stone-400 italic">
                          Belum ada deskripsi event.
                        </p>
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
                    eventName={event?.name}
                    rows={overall}
                    onSelect={onSelectParticipant}
                  />
                </>
              ) : (
                <div className="text-center py-20 bg-white border-2 border-dashed border-stone-200">
                  <div className="text-xl font-black text-stone-300 mb-2 tracking-widest uppercase">
                    No Active Roster
                  </div>
                  <div className="text-sm text-stone-500 font-medium">
                    Participants will appear here once the timing master list is
                    uploaded.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Results" && (
            <div className="space-y-8">
              {!overall.some((r) => r.rank != null && r.rank <= 3) && (
                <RaceClock
                  cutoffMs={event?.cutoffMs}
                  categoryStartTimes={event?.categoryStartTimes}
                  manualStartTime={(event as any)?.manualStartTime}
                />
              )}
              <LeaderboardTable
                title="Overall Result Rankings"
                eventName={event?.name}
                rows={overallWithLatestCp}
                categories={visibleEventCategories}
                onSelect={onSelectParticipant}
                showTop10Badge={true}
                hidePodium={true}
              />
            </div>
          )}

          {activeTab === "Registered" && (
            <div className="space-y-8 bg-white p-6 shadow-sm border-t-4 border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="shrink-0">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">
                    Peserta Terdaftar
                  </h2>
                </div>
                <div className="relative w-full sm:w-80 shrink-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-4 w-4 text-stone-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Cari nama atau No. BIB..."
                    className="w-full pl-10 pr-4 py-2 border-2 border-stone-200 rounded-xl text-sm focus:border-stone-800 focus:ring-0 outline-none transition-colors font-medium text-stone-900 placeholder:text-stone-400"
                    value={regSearchTerm}
                    onChange={(e) => setRegSearchTerm(e.target.value)}
                  />
                </div>
                {isStaffUser && String(event?.content?.enableRegisteredScan) !== "false" && (
                  <button
                    onClick={() => setScannerOpen(true)}
                    className="btn primary px-4 py-2 flex items-center gap-2 rounded-xl"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h4v4H3v-4zM3 3h4v4H3V3zM10 3h4v4h-4V3zM3 17h4v4H3v-4zM10 17h4v4h-4v-4zM17 17h4v4h-4v-4zM17 10h4v4h-4v-4zM17 3h4v4h-4V3z"
                      />
                    </svg>
                    Scan Peserta
                  </button>
                )}
              </div>
              {(() => {
                const settled = registeredParticipants.filter(
                  (p) =>
                    p.paymentStatus === "settlement" && !p.category?.isHidden,
                );
                const filtered = settled.filter((p) => {
                  const leader = matchRegisteredToMaster(p, masterParticipants);
                  const bib = leader?.bib || "";
                  const term = regSearchTerm.toLowerCase();
                  // Get display name from customData (full name) or fallback to p.name
                  let displayName = p.name;
                  if (p.customData) {
                    const nameKeys = [
                      "full name",
                      "fullname",
                      "nama lengkap",
                      "nama",
                    ];
                    const found = Object.entries(p.customData).find(([k]) =>
                      nameKeys.includes(k.toLowerCase()),
                    );
                    if (found && found[1]) displayName = String(found[1]);
                  }
                  return (
                    displayName.toLowerCase().includes(term) ||
                    p.name.toLowerCase().includes(term) ||
                    bib.toLowerCase().includes(term)
                  );
                });
                return filtered.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-stone-200">
                          <th
                            className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500"
                            style={{ width: 60 }}
                          >
                            No
                          </th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">
                            Nama
                          </th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">
                            Kategori
                          </th>
                          <th className="text-center py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">
                            Age Category
                          </th>
                          <th className="text-left py-3 px-2 font-black uppercase tracking-widest text-[10px] text-stone-500">
                            No BIB
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p: any, idx: number) => {
                          const leader = matchRegisteredToMaster(
                            p,
                            masterParticipants,
                          );
                          const bib =
                            p.bibNumber ||
                            (leader && leader.bib !== "RDY"
                              ? leader.bib
                              : "") ||
                            "-";
                          const nationalityStr =
                            p.customData?.["Nationality"] ||
                            p.customData?.["Kewarganegaraan"] ||
                            p.customData?.["nationality"] ||
                            "";
                          const flagMatch =
                            nationalityStr.match(
                              /^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/,
                            ) ||
                            nationalityStr.match(
                              /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/,
                            );
                          const flag = flagMatch ? flagMatch[0] : "";

                          return (
                            <tr
                              key={p.id}
                              className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
                              onClick={() => {
                                setRegDetailParticipant(p);
                                setRegDetailOpen(true);
                              }}
                            >
                              <td className="py-3 px-2 font-mono text-stone-400">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-2 font-bold text-stone-900">
                                <FlagImg emoji={flag} name={nationalityStr} />
                                {(() => {
                                  if (p.customData) {
                                    const entries = Object.entries(
                                      p.customData,
                                    );
                                    const nameKeys = [
                                      "full name",
                                      "fullname",
                                      "nama lengkap",
                                      "nama",
                                    ];
                                    const found = entries.find(([k]) =>
                                      nameKeys.includes(k.toLowerCase()),
                                    );
                                    if (found && found[1])
                                      return String(found[1]);
                                  }
                                  return p.name;
                                })()}
                              </td>
                              <td className="py-3 px-2 text-stone-600">
                                <span>{p.category?.name}</span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                {(() => {
                                  const ageCategory =
                                    p.customData?.["Age Category"] ||
                                    resolveRegistrationAgeCategory(
                                      p,
                                      event?.eventDate || "",
                                      ageBrackets,
                                    );
                                  return ageCategory ? (
                                    <span className="inline-block px-4 py-1.5 bg-stone-50 text-stone-600 font-bold text-xs rounded-xl border-2 border-stone-200 whitespace-nowrap">
                                      {ageCategory}
                                    </span>
                                  ) : (
                                    <span className="text-stone-300">-</span>
                                  );
                                })()}
                              </td>
                              <td className="py-3 px-2 font-mono font-bold text-stone-900">
                                {bib}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null;
              })()}

              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-sm text-stone-600">
                  Pembayaran gagal, pending, atau nama tidak ditemukan?{" "}
                  <a
                    href={`/bantuan?eventId=${event?.id}`}
                    className="text-blue-600 font-bold hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Lapor Kendala
                  </a>
                </span>
              </div>
            </div>
          )}

          {/* Registered Participant Detail Modal */}
          {regDetailOpen &&
            regDetailParticipant &&
            (() => {
              const leader = matchRegisteredToMaster(
                regDetailParticipant,
                masterParticipants,
              );
              const bib =
                regDetailParticipant.bibNumber ||
                (leader && leader.bib !== "RDY" ? leader.bib : "") ||
                "-";
              const displayName = (() => {
                if (regDetailParticipant.customData) {
                  const entries = Object.entries(
                    regDetailParticipant.customData,
                  );
                  const nameKeys = [
                    "full name",
                    "fullname",
                    "nama lengkap",
                    "nama",
                  ];
                  const found = entries.find(([k]) =>
                    nameKeys.includes(k.toLowerCase()),
                  );
                  if (found && found[1]) return String(found[1]);
                }
                return regDetailParticipant.name;
              })();
              return (
                <div
                  className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                  onClick={() => setRegDetailOpen(false)}
                >
                  <div
                    className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 border-b border-stone-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black uppercase tracking-tight">
                          Detail Peserta
                        </h3>
                        <button
                          onClick={() => setRegDetailOpen(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 text-lg font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start py-2 border-b border-stone-100">
                        <span className="text-[10px] font-black text-stone-400 uppercase">
                          Nama
                        </span>
                        <span className="font-bold text-stone-900">
                          {displayName}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2 border-b border-stone-100">
                        <span className="text-[10px] font-black text-stone-400 uppercase">
                          Kategori
                        </span>
                        <span className="text-sm text-stone-700">
                          {regDetailParticipant.category?.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2 border-b border-stone-100">
                        <span className="text-[10px] font-black text-stone-400 uppercase">
                          Age Category
                        </span>
                        <span className="text-sm text-stone-700">
                          {(() =>
                            regDetailParticipant.customData?.["Age Category"] ||
                            (leader?.dob
                              ? getAgeCategory(
                                  calculateAgeOnRaceDay(
                                    leader.dob,
                                    event?.eventDate || "",
                                  ),
                                  ageBrackets,
                                )
                              : "") ||
                            resolveRegistrationAgeCategory(
                              regDetailParticipant,
                              event?.eventDate || "",
                              ageBrackets,
                            ) ||
                            "-"
                          )()}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2">
                        <span className="text-[10px] font-black text-stone-400 uppercase">
                          No BIB
                        </span>
                        <span className="text-sm font-mono font-bold text-stone-900">
                          {bib}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {activeTab === "Gallery" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8 mt-4">
                <h2 className="text-3xl md:text-4xl font-black text-stone-900 uppercase tracking-tighter">
                  Event Gallery
                </h2>
                <div className="h-[2px] flex-grow bg-stone-200 w-full md:w-auto"></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 pb-12">
                {event?.content?.galleryUrls?.map(
                  (url: string, idx: number) => (
                    <div
                      key={idx}
                      className="relative aspect-square md:aspect-[4/5] overflow-hidden bg-stone-100 group cursor-pointer"
                      onClick={() => setDownloadImage(url)}
                    >
                      <img
                        src={url}
                        alt={`Gallery Image ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                        <div className="translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full font-bold text-sm tracking-widest flex items-center gap-2">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            DOWNLOAD
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {activeTab !== "Home" &&
            activeTab !== "Participants" &&
            activeTab !== "Registered" &&
            activeTab !== "Results" &&
            activeTab !== "Route" &&
            activeTab !== "Gallery" && (
              <div className="space-y-8">
                {/* Gallery is now in its own tab */}

                {!((byCategory as any)[activeTab] || []).some(
                  (r: any) => r.rank != null && r.rank <= 3,
                ) && (
                  <RaceClock
                    cutoffMs={event?.cutoffMs}
                    categoryStartTimes={event?.categoryStartTimes}
                    manualStartTime={(event as any)?.manualStartTime}
                  />
                )}
                <CategorySection
                  categoryKey={activeTab}
                  rows={(byCategory as any)[activeTab] || []}
                  onSelect={onSelectParticipant}
                />
              </div>
            )}

          {activeTab === "Route" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2 bg-white border border-stone-200 rounded-3xl shadow-xl overflow-hidden relative min-h-[400px] lg:min-h-[600px]">
                <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10 bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-stone-200 shadow-xl pointer-events-none">
                  <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                    Official Route Map
                  </div>
                  <div className="text-xl font-black tracking-tighter text-stone-900">
                    {event.name}
                  </div>
                </div>

                {/* GPX Category Selector (Dropdown) */}
                {event?.content?.routeGpxFiles &&
                  Object.keys(event.content.routeGpxFiles).length > 1 && (
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[1000] flex flex-col items-end">
                      <button
                        onClick={() =>
                          setIsRouteDropdownOpen(!isRouteDropdownOpen)
                        }
                        className="bg-stone-900 text-white px-4 py-3 md:px-6 md:py-3.5 rounded-full font-black text-xs md:text-sm uppercase tracking-widest shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center gap-2 md:gap-3 hover:bg-stone-800 transition-all border-b-[4px] md:border-b-[6px] border-stone-950 active:border-b-0 active:translate-y-[4px] md:active:translate-y-[6px]"
                      >
                        <span className="text-stone-400 hidden sm:inline">
                          Rute:
                        </span>
                        <span className="text-yellow-400">
                          {activeRouteCategory || "PILIH"}
                        </span>
                        <svg
                          className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${isRouteDropdownOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {isRouteDropdownOpen && (
                        <div className="absolute top-[110%] right-0 mt-2 bg-white rounded-2xl md:rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[4px] md:border-[6px] border-stone-900 w-48 md:w-56 overflow-hidden animate-in fade-in slide-in-from-top-4">
                          {Object.keys(event.content.routeGpxFiles).map(
                            (cat) => (
                              <button
                                key={cat}
                                onClick={() => {
                                  setActiveRouteCategory(cat);
                                  setIsRouteDropdownOpen(false);
                                }}
                                className={`w-full text-left px-5 py-4 md:py-5 font-black text-sm md:text-base tracking-widest uppercase transition-all ${
                                  activeRouteCategory === cat
                                    ? "bg-blue-600 text-white"
                                    : "text-stone-700 hover:bg-stone-100"
                                } border-b-2 border-stone-200 last:border-b-0`}
                              >
                                {cat}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                {gpxTrackPoints.length > 0 ||
                (event?.latitude && event?.longitude) ? (
                  <InteractiveRouteMap
                    trackPoints={gpxTrackPoints}
                    fallbackLat={event?.latitude}
                    fallbackLng={event?.longitude}
                  />
                ) : (
                  <div className="w-full h-[600px] bg-stone-50 flex flex-col items-center justify-center">
                    <span className="text-stone-300 font-black text-2xl tracking-widest uppercase mb-2">
                      No GPS Data
                    </span>
                    <span className="text-stone-500 text-sm font-medium">
                      The race director has not uploaded a GPX file.
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Details Box */}
                <div className="bg-white text-stone-900 p-6 border-2 border-stone-200 border-b-[6px] rounded-3xl relative overflow-hidden transition-transform hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-full -z-0 opacity-50"></div>
                  <div className="relative z-10">
                    <h3 className="text-stone-900 font-extrabold text-xl tracking-tight mb-5 pb-4 border-b-2 border-dashed border-stone-100 flex items-center gap-3">
                      <div className="text-blue-600">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                      </div>
                      Info Jalur (GPS)
                    </h3>

                    <div className="space-y-5">
                      <div>
                        <div className="text-xs text-stone-500 font-bold mb-1 uppercase tracking-wider">
                          Titik Kordinat (Track Points)
                        </div>
                        <div className="font-extrabold text-3xl text-blue-600 tracking-tighter mb-1">
                          {gpxTrackPoints.length > 0
                            ? gpxTrackPoints.length
                            : "0"}
                        </div>
                        <p className="text-sm text-stone-500 font-medium leading-snug">
                          Jumlah titik lokasi yang membentuk garis merah pada
                          peta. Semakin banyak titiknya, jalur lari akan semakin
                          akurat.
                        </p>
                      </div>

                      <div>
                        <div className="text-xs text-stone-500 font-bold mb-2 uppercase tracking-wider">
                          Status Data Peta
                        </div>
                        {gpxTrackPoints.length > 0 ? (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-green-600 border-2 border-stone-200 border-b-[4px] shadow-sm rounded-xl text-sm font-extrabold tracking-wide">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            RUTE TERSEDIA
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-stone-500 border-2 border-stone-200 border-b-[4px] shadow-sm rounded-xl text-sm font-extrabold tracking-wide">
                            BELUM ADA RUTE
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extra decorative box to make it feel like a real racing dashboard */}
                <div className="bg-white p-6 border-2 border-stone-200 border-b-[6px] rounded-3xl transition-transform hover:-translate-y-1">
                  <div className="font-extrabold text-stone-800 tracking-tight text-lg mb-3 flex items-center gap-3">
                    <div className="text-yellow-500">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                        />
                      </svg>
                    </div>
                    E-Sertifikat Resmi
                  </div>
                  <p className="text-sm text-stone-500 font-medium leading-relaxed">
                    Semua *finisher* bisa langsung *download* e-sertifikat resmi
                    dari tabel Result! Cukup cari namamu dan klik nomor BIB.
                    E-sertifikat ini valid dan mencantumkan waktu lari bersih
                    kamu.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating CTA Button */}
        {!(
          event?.eventDate &&
          new Date(event.eventDate).setHours(0, 0, 0, 0) <
            new Date().setHours(0, 0, 0, 0)
        ) && (
          <div className="fixed bottom-6 right-6 z-50 mix-blend-difference">
            <button
              onClick={() => navigate(`/event/${slug}/daftar`)}
              className="bg-white text-black font-bold py-3 px-6 rounded-full uppercase tracking-widest text-[10px] transition-transform hover:scale-105 cursor-pointer"
            >
              Daftar →
            </button>
          </div>
        )}

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
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="text-center text-white mb-8 z-[105]">
              <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tighter">
                Validasi Peserta
              </h2>
              <p className="text-stone-400 font-medium max-w-xs mx-auto text-sm">
                Arahkan kamera ke QR Code / Barcode tiket peserta.
              </p>
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
              <div
                id="reader"
                className="w-full h-full object-cover relative z-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
              ></div>
            </div>

            {/* Valid Overlay */}
            {scanValidResult && (
              <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-2xl z-[120] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full max-w-md bg-stone-900/90 border border-stone-800 rounded-3xl p-8 flex flex-col items-center text-center backdrop-blur-xl relative overflow-hidden">
                  <div className="relative w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6">
                    <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase mb-3">
                    Peserta Valid
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 uppercase tracking-tighter leading-tight">
                    {scanValidResult.name}
                  </h1>

                  <div className="text-stone-400 font-medium mb-8 uppercase tracking-widest text-sm">
                    {scanValidResult.category?.name || "-"}
                  </div>

                  <div className="w-full bg-white rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                    <div className="text-stone-400 text-[10px] font-black tracking-widest uppercase mb-1">
                      BIB Number
                    </div>
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
                  <div className="text-[10px] font-black tracking-[0.2em] text-red-500 uppercase mb-3 mt-2">
                    Akses Ditolak
                  </div>

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
        {/* Download Image Modal */}
        <Modal
          open={!!downloadImage}
          onCancel={() => setDownloadImage(null)}
          footer={null}
          centered
          width={600}
          className="modern-modal"
          closeIcon={
            <div className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white backdrop-blur-md transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          }
          styles={{
            body: {
              padding: 0,
              maxHeight: "70vh",
              overflowY: "auto",
              backgroundColor: "transparent",
              boxShadow: "none",
            },
            mask: {
              backdropFilter: "blur(12px)",
              backgroundColor: "rgba(0,0,0,0.85)",
            },
          }}
        >
          {downloadImage && (
            <div className="flex flex-col items-center">
              <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl mb-6">
                <img
                  src={downloadImage}
                  alt="Download Preview"
                  className="w-full h-auto object-contain max-h-[70vh] bg-stone-900/50"
                />
              </div>
              <div className="flex gap-4 w-full">
                <Button
                  size="large"
                  className="flex-1 h-14 bg-white/10 hover:bg-white/20 text-white border-0 hover:text-white backdrop-blur-md font-bold tracking-widest uppercase"
                  onClick={() => setDownloadImage(null)}
                  disabled={isDownloading}
                >
                  Batal
                </Button>
                <Button
                  type="primary"
                  size="large"
                  className="flex-1 h-14 bg-white text-stone-900 hover:bg-stone-100 hover:text-stone-900 border-0 font-black tracking-widest uppercase flex items-center justify-center gap-2"
                  onClick={executeDownload}
                  loading={isDownloading}
                >
                  {!isDownloading && (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                  Unduh
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
