import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import { useEvent } from "../contexts/EventContext";
import { renderCertificatePNG, downloadDataUrl } from "../lib/certificate";
import { calculatePace } from "../lib/time";

// ─── Custom interlocking dual shape background for Rank Cards (UTMB-style) ─────
function CardBgSVG({ id, variant }: { accentColor?: string; id: string; variant: "A" | "B" }) {
  const cleanId = id.replace(/[^a-zA-Z0-9]/g, "-");
  const pathD = variant === "A"
    ? "M5 1205V319C5 145.583 145.583 5 319 5H2076.5C2163.21 5 2233.5 75.2913 2233.5 162C2233.5 248.709 2163.21 319 2076.5 319H1683.5C1490.2 319 1333.5 475.7 1333.5 669V1205C1333.5 1398.3 1176.8 1555 983.5 1555H355C161.7 1555 5 1398.3 5 1205Z"
    : "M2233.5 355V1241C2233.5 1414.42 2092.92 1555 1919.5 1555H162C75.2913 1555 5 1484.71 5 1398C5 1311.29 75.2913 1241 162 1241H555C748.3 1241 905 1084.3 905 891V355C905 161.7 1061.7 5 1255 5H1883.5C2076.8 5 2233.5 161.7 2233.5 355Z";

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
      viewBox="0 0 2239 1560"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`bgGrad-${cleanId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16171f" />
          <stop offset="100%" stopColor="#0c0d12" />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill={`url(#bgGrad-${cleanId})`}
      />
    </svg>
  );
}

// ─── Premium Round Medal Component (No Ribbons) ──────────────────────────────────
function CircularMedalSVG({ rank, status }: { rank: number | null | undefined; status?: string }) {
  const isDnf = status === "DNF" || status === "DNS" || status === "DSQ";

  if (isDnf) {
    const statusLabel = status || "DNF";
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-[#111827]/60 rounded-3xl border border-red-500/20 backdrop-blur-md shadow-2xl"
        style={{ animation: "medalFloat 3s ease-in-out infinite" }}>
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-red-600 via-rose-700 to-red-900 flex items-center justify-center border-4 border-red-500/80 shadow-[0_10px_25px_rgba(239,68,68,0.4)]">
          <div className="absolute inset-0.5 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/30 pointer-events-none" />
          <span className="text-white text-3xl font-black tracking-wider font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {statusLabel}
          </span>
        </div>
        <div className="mt-4 text-center">
          <div className="text-red-500 font-black text-lg uppercase tracking-widest">
            {statusLabel === "DNF" ? "Did Not Finish" : statusLabel === "DNS" ? "Did Not Start" : "Disqualified"}
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-[220px] leading-relaxed">
            Waktu terlampaui batas cut-off atau status tidak selesai.
          </p>
        </div>
      </div>
    );
  }

  const isPodium = rank === 1 || rank === 2 || rank === 3;
  const config =
    rank === 1
      ? {
        glow: "rgba(234,179,8,0.35)",
        outerGradient: "from-yellow-300 via-amber-500 to-yellow-600",
        innerBg: "bg-gradient-to-br from-yellow-100 via-amber-300 to-yellow-500",
        ringColor: "border-amber-400/50",
        title: "🥇 CHAMPION",
        textColor: "text-amber-950",
        accentBg: "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30",
      }
      : rank === 2
        ? {
          glow: "rgba(148,163,184,0.35)",
          outerGradient: "from-slate-200 via-slate-400 to-slate-600",
          innerBg: "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400",
          ringColor: "border-slate-300/50",
          title: "🥈 RUNNER UP",
          textColor: "text-slate-900",
          accentBg: "bg-slate-400/20 text-slate-300 border border-slate-400/30",
        }
        : rank === 3
          ? {
            glow: "rgba(217,119,6,0.35)",
            outerGradient: "from-amber-600 via-orange-700 to-amber-800",
            innerBg: "bg-gradient-to-br from-amber-200 via-amber-500 to-orange-600",
            ringColor: "border-amber-600/50",
            title: "🥉 3rd PLACE",
            textColor: "text-amber-950",
            accentBg: "bg-amber-600/20 text-amber-500 border border-amber-600/30",
          }
          : {
            glow: "rgba(239,68,68,0.25)",
            outerGradient: "from-red-500 via-rose-600 to-red-800",
            innerBg: "bg-gradient-to-br from-[#16171f] to-[#0c0d12]",
            ringColor: "border-red-500/30",
            title: "🏅 FINISHER",
            textColor: "text-red-500",
            accentBg: "bg-red-500/10 text-red-400 border border-red-500/20",
          };

  const rankLabel = rank != null ? (rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : `#${rank}`) : "-";

  return (
    <div className="flex flex-col items-center justify-center"
      style={{ filter: `drop-shadow(0 0 35px ${config.glow})` }}>
      <div className={`relative w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-b ${config.outerGradient} p-[4px] md:p-[6px] shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300`}
        style={{ animation: "medalFloat 3s ease-in-out infinite" }}>

        <div className="absolute inset-0.5 rounded-full bg-gradient-to-t from-transparent via-white/20 to-white/40 pointer-events-none z-10" />

        <div className={`w-full h-full rounded-full ${config.innerBg} relative flex flex-col items-center justify-center border-[3px] md:border-4 ${config.ringColor} overflow-hidden shadow-inner`}>
          <div className="absolute inset-0.5 rounded-full border border-white/5 opacity-20 pointer-events-none" />
          <div className="absolute inset-2 rounded-full border border-white/5 opacity-10 pointer-events-none" />

          {isPodium && (
            <div className="absolute top-2 md:top-4 flex gap-1 opacity-70">
              <span className={`text-[8px] md:text-[10px] ${config.textColor}`}>★</span>
              <span className={`text-[10px] md:text-[12px] ${config.textColor}`}>★</span>
              <span className={`text-[8px] md:text-[10px] ${config.textColor}`}>★</span>
            </div>
          )}

          <div className="text-center flex flex-col items-center justify-center">
            <span className={`text-3xl md:text-5xl font-black tracking-tight leading-none ${config.textColor} drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)] font-mono`}>
              {rankLabel}
            </span>
          </div>

          <div className="absolute bottom-2 md:bottom-3.5 left-0 right-0 text-center px-2">
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-85 ${config.textColor}`}>
              {config.title}
            </span>
          </div>

          <div className="absolute top-6 left-6 w-3 h-2 bg-white/40 rounded-full blur-[1px] -rotate-45" />
        </div>
      </div>

      <div className="mt-4 md:mt-5 text-center hidden md:block">
        {rank != null ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md ${config.accentBg}`}>
              {isPodium ? `Podium Finish` : `Official Finisher`}
            </span>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
              Lumpat Event Result
            </div>
          </div>
        ) : (
          <div className="text-red-400 font-extrabold text-xs uppercase tracking-wider">
            No Rank Available
          </div>
        )}
      </div>

      <style>{`
        @keyframes medalFloat {
          0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
          50% { transform: translateY(-8px) rotate(1.5deg); }
        }
      `}</style>
    </div>
  );
}

export default function ParticipantResultPage() {

  const { slug } = useParams<{ slug: string; epc: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const state = location.state as {
    modalData: any;
    eventId: string;
    eventName: string;
  };

  if (!state || !state.modalData) {
    navigate(`/event/${slug}`, { replace: true });
    return null;
  }

  const { modalData, eventId, eventName } = state;

  const { events } = useEvent();
  const eventObj = events.find((e) => e.id === eventId || e.slug === slug);
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/banners?eventId=${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        setBanners(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Failed to load banners:", err));
  }, [eventId]);

  const hasCover = !!eventObj?.bannerUrl;
  const coverImageUrl = hasCover
    ? eventObj?.bannerUrl
    : banners.length > 0
      ? banners[0].imageUrl
      : "";

  const parseTimeToMs = (timeStr: string): number => {
    if (!timeStr || timeStr === "-") return 0;
    const clean = timeStr.replace(/[^0-9:.]/g, "");
    const parts = clean.split(":");
    if (parts.length < 2) return 0;

    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    let ms = 0;

    if (parts.length === 3) {
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
      const secParts = parts[2].split(".");
      seconds = parseInt(secParts[0], 10) || 0;
      if (secParts[1]) {
        ms = parseInt(secParts[1].padEnd(3, "0").slice(0, 3), 10) || 0;
      }
    } else if (parts.length === 2) {
      minutes = parseInt(parts[0], 10) || 0;
      const secParts = parts[1].split(".");
      seconds = parseInt(secParts[0], 10) || 0;
      if (secParts[1]) {
        ms = parseInt(secParts[1].padEnd(3, "0").slice(0, 3), 10) || 0;
      }
    }

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
  };

  const parsedPoints = useMemo(() => {
    const points: { label: string; timeMs: number; display: string }[] = [];
    points.push({ label: "Start", timeMs: 0, display: "00:00:00" });

    if (modalData.checkpointTimes && modalData.checkpointTimes.length > 0) {
      modalData.checkpointTimes.forEach((time: string, idx: number) => {
        const timeMs = parseTimeToMs(time);
        if (timeMs > 0) {
          points.push({
            label: `CP ${idx + 1}`,
            timeMs,
            display: time,
          });
        }
      });
    }

    if (modalData.totalTimeMs > 0) {
      points.push({
        label: "Finish",
        timeMs: modalData.totalTimeMs,
        display: modalData.totalTimeDisplay,
      });
    }

    return points;
  }, [modalData]);

  const coords = useMemo(() => {
    if (parsedPoints.length < 2) return [];
    const width = 800;
    const height = 160;
    const paddingLeft = 60;
    const paddingRight = 60;
    const maxVal = parsedPoints[parsedPoints.length - 1].timeMs || 1;

    return parsedPoints.map((pt, idx) => {
      const x = paddingLeft + (idx / (parsedPoints.length - 1)) * (width - paddingLeft - paddingRight);
      const y = height - (pt.timeMs / maxVal) * (height - 40);
      return { x, y };
    });
  }, [parsedPoints]);

  const { linePath, areaPath } = useMemo(() => {
    if (coords.length < 2) return { linePath: "", areaPath: "" };

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const p0 = coords[i - 1];
      const p1 = coords[i];
      const cpX1 = p0.x + (p1.x - p0.x) * 0.45;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) * 0.55;
      const cpY2 = p1.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    const height = 160;
    const areaPath = linePath + ` L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return { linePath, areaPath };
  }, [coords]);

  const getInitials = (name: string) => {
    if (!name) return "M";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const onDownloadCert = async () => {
    if (!modalData) return;
    try {
      setDownloading(true);
      const png = await renderCertificatePNG({
        eventId,
        eventName,
        name: modalData.name,
        bib: modalData.bib,
        gender: modalData.gender,
        category: modalData.category,
        ageCategory: modalData.ageCategory,
        finishTime: modalData.finishTimeRaw,
        totalTimeDisplay: modalData.totalTimeDisplay,
        pace: modalData.totalTimeMs
          ? calculatePace(modalData.totalTimeMs, modalData.category, modalData.distanceKm)
          : undefined,
        overallRank: modalData.overallRank,
        genderRank: modalData.genderRank,
        categoryRank: modalData.categoryRank,
        ageRank: modalData.ageRank,
      });
      const slugName = (eventName || "event").replace(/\s+/g, "-").toLowerCase();
      downloadDataUrl(png, `${slugName}-certif-lumpat.png`);
    } catch (err: any) {
      console.error("Certificate error:", err);
      alert("Terjadi kesalahan saat mengunduh sertifikat.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#eef0f4]">

        {/* ── MOBILE TOP SECTION (Hidden on desktop) ── */}
        <div className="block md:hidden">
          {/* Dark Header Banner containing Medal */}
          <div className="relative w-full h-[280px] bg-[#0c0d12] pt-[72px] flex items-center justify-center">
            {/* Background Container to clip parallax/cover */}
            <div className="absolute inset-0 overflow-hidden">
              {coverImageUrl ? (
                <>
                  <div
                    className="absolute inset-0 bg-center bg-cover scale-105"
                    style={{
                      backgroundImage: `url(${coverImageUrl})`,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/85 to-[#0c0d12]/50" />
                </>
              ) : (
                <>
                  <div
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #EF4444 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  />
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />
                </>
              )}
            </div>

            {/* Back button (Mobile absolute top-left) */}
            <button
              onClick={() => navigate(`/event/${slug}?tab=Results`)}
              className="absolute top-[88px] left-4 z-30 flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-900/60 px-3 py-1.5 rounded-full backdrop-blur-md border border-slate-700/30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Back</span>
            </button>

            {/* Medal */}
            <div className="relative z-10 scale-[0.85] transform -translate-y-5">
              <CircularMedalSVG rank={modalData.overallRank} status={modalData.totalTimeDisplay} />
            </div>

            {/* Overlapping Avatar */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
              <div className="w-[96px] h-[96px] bg-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-xl">
                {getInitials(modalData.name)}
              </div>
            </div>
          </div>

          {/* Participant Info Section (Light Background) */}
          <div className="px-4 pt-16 pb-6 flex flex-col items-center text-center">
            {/* Event Name Badge */}
            <div className="flex items-center gap-1.5 mb-3 bg-red-500/10 text-red-600 border border-red-500/25 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
              {eventObj?.logoUrl && (
                <img
                  src={eventObj.logoUrl}
                  alt="Event Logo"
                  className="w-3.5 h-3.5 object-contain bg-white rounded-full p-[1px] shrink-0"
                />
              )}
              {eventName}
            </div>

            {/* Participant Name */}
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
              {modalData.name || "Unknown"}
            </h1>

            {/* Metadata (BIB, Kategori, Gender, Usia) */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-slate-500 text-xs font-bold">
              <span className="flex items-center gap-1">
                <span className="text-slate-400 uppercase text-[9px] tracking-wider">BIB:</span>
                <span className="text-slate-800 font-mono">{modalData.bib || "-"}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400 uppercase text-[9px] tracking-wider">Kategori:</span>
                <span className="text-slate-800">{modalData.category || "-"}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400 uppercase text-[9px] tracking-wider">Gender:</span>
                <span className="text-slate-800">{modalData.gender || "-"}</span>
              </span>
              {modalData.ageCategory?.trim() && modalData.ageCategory.trim() !== "-" && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 uppercase text-[9px] tracking-wider">Usia:</span>
                    <span className="text-slate-800">{modalData.ageCategory.trim()}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP TOP SECTION: 2-column like UTMB (Hidden on mobile) ── */}
        <div className="hidden md:block bg-[#0c0d12] pt-[72px] relative overflow-hidden">
          {/* Background Parallax Patterns / Cover Image */}
          {coverImageUrl ? (
            <>
              <div
                className="absolute inset-0 bg-center bg-cover scale-105 will-change-transform opacity-30"
                style={{
                  backgroundImage: `url(${coverImageUrl})`,
                  transform: `translateY(${scrollY * 0.4}px)`,
                }}
              />
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/90 to-[#0c0d12]/70" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, #EF4444 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  transform: `translateY(${scrollY * 0.3}px)`,
                }}
              />
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />
              <div
                className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-red-600 to-rose-700 opacity-20 blur-[100px] pointer-events-none"
                style={{
                  transform: `translateY(${scrollY * 0.45}px)`,
                }}
              />
              <div
                className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr from-red-700 to-rose-950 opacity-25 blur-[120px] pointer-events-none"
                style={{
                  transform: `translateY(${scrollY * 0.2}px)`,
                }}
              />
            </>
          )}

          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-stretch gap-0 md:gap-0 relative z-10">

            {/* LEFT COLUMN: avatar + name + meta */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col items-center md:items-start justify-center px-4 py-8 md:py-10 md:w-[300px] shrink-0"
            >

              {/* Back button */}
              <button
                onClick={() => navigate(`/event/${slug}?tab=Results`)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Back to Event</span>
              </button>

              {/* Avatar */}
              <div className="w-[120px] h-[120px] bg-red-600 rounded-2xl flex items-center justify-center text-white text-4xl font-black mb-5 shadow-lg">
                {getInitials(modalData.name)}
              </div>

              {/* Event Badge */}
              <div className="flex items-center gap-2 mb-3.5 bg-red-500/10 text-red-500 border border-red-500/25 px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest self-center md:self-start shadow-[0_0_12px_rgba(239,68,68,0.15)] backdrop-blur-sm">
                {eventObj?.logoUrl && (
                  <img
                    src={eventObj.logoUrl}
                    alt="Event Logo"
                    className="w-3.5 h-3.5 object-contain bg-white rounded-full p-[1px] shrink-0"
                  />
                )}
                {eventName}
              </div>

              {/* Name */}
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-3 text-center md:text-left">
                {modalData.name || "Unknown"}
              </h1>

              {/* Gender + BIB */}
              <div className="flex flex-col gap-1.5 text-slate-400 text-sm font-semibold mb-2">
                <span className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase text-xs tracking-widest">Jenis Kelamin</span>
                  <span className="text-white">{modalData.gender || "-"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase text-xs tracking-widest">BIB</span>
                  <span className="text-white font-mono">{modalData.bib || "-"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase text-xs tracking-widest">Kategori</span>
                  <span className="text-white">{modalData.category || "-"}</span>
                </span>
                {modalData.ageCategory?.trim() && modalData.ageCategory.trim() !== "-" && (
                  <span className="flex items-center gap-2">
                    <span className="text-slate-500 uppercase text-xs tracking-widest">Usia</span>
                    <span className="text-white">{modalData.ageCategory.trim()}</span>
                  </span>
                )}
              </div>
            </motion.div>

            {/* RIGHT COLUMN: Circular Medal representing position / status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="flex-1 bg-gradient-to-br from-[#16171f] via-[#12131b] to-[#0c0d12] flex items-center justify-center min-h-[260px] md:min-h-[340px] relative overflow-hidden rounded-2xl md:rounded-none md:rounded-r-2xl border border-slate-800/80 shadow-2xl group"
            >
              {/* Dynamic Rank Aura Glow */}
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-500"
                style={{
                  background:
                    modalData.overallRank === 1
                      ? "radial-gradient(circle at center, rgba(245,158,11,0.22) 0%, rgba(239,68,68,0.08) 45%, transparent 70%)"
                      : modalData.overallRank === 2
                      ? "radial-gradient(circle at center, rgba(148,163,184,0.20) 0%, transparent 70%)"
                      : modalData.overallRank === 3
                      ? "radial-gradient(circle at center, rgba(217,119,6,0.20) 0%, transparent 70%)"
                      : "radial-gradient(circle at center, rgba(239,68,68,0.18) 0%, transparent 70%)",
                }}
              />

              {/* Concentric HUD Orbit Rings behind medal */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                <div className="w-[280px] h-[280px] rounded-full border border-dashed border-white/30 animate-[spin_60s_linear_infinite]" />
                <div className="absolute w-[210px] h-[210px] rounded-full border border-white/15" />
                <div className="absolute w-[340px] h-[340px] rounded-full border border-white/10" />
              </div>

              {/* Large Background Watermark Text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-7xl md:text-9xl font-black italic tracking-tighter uppercase text-white/[0.04] whitespace-nowrap select-none rotate-[-6deg] translate-y-2 font-sans">
                  {modalData.overallRank === 1
                    ? "CHAMPION"
                    : modalData.overallRank === 2
                    ? "RUNNER UP"
                    : modalData.overallRank === 3
                    ? "PODIUM"
                    : "FINISHER"}
                </span>
              </div>

              {/* Top Right Sport Badge */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                OFFICIAL RESULT
              </div>

              {/* Grid bg (Tech Pattern) */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />

              {/* Bottom Speed Accent Line */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

              <div className="relative z-10 py-6">
                <CircularMedalSVG rank={modalData.overallRank} status={modalData.totalTimeDisplay} />
              </div>
            </motion.div>

          </div>
        </div>

        {/* ── STATS CARDS ROW (like UTMB) ── */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="max-w-6xl mx-auto px-4 pt-6 pb-8 md:pb-10 lg:pb-12"
        >
          {/* Desktop/Tablet Layout: Flex Row */}
          <div className="hidden sm:flex flex-row items-center justify-between w-full">
            <div className="flex flex-row items-center justify-between w-full gap-1.5 md:gap-2.5 lg:gap-4 overflow-visible">
              {/* TOTAL TIME — compact dark card */}
              <div className="bg-[#16171f] rounded-2xl overflow-hidden shadow-2xl flex flex-col flex-none w-[190px] md:w-[240px] lg:w-[360px] h-[135px] md:h-[180px] lg:h-[248px] justify-center py-3 md:py-5 lg:py-8 px-3 md:px-5 lg:px-7 border border-red-500/10 translate-y-1 md:translate-y-2 lg:translate-y-3">
                <div className="flex flex-col items-center justify-center">
                  {/* Slanted Parallel Badge (UTMB INDEX Style) */}
                  <div className="flex justify-center mb-1.5 md:mb-3 lg:mb-4">
                    <div className="flex text-[9px] sm:text-[10px] md:text-[11px] lg:text-[13px] font-black uppercase tracking-wider font-sans">
                      {/* Left slanted block */}
                      <div className="bg-[#242630] text-white px-2 md:px-3 lg:px-4 py-0.5 md:py-1 lg:py-1.5 skew-x-[-12deg] rounded-l flex items-center justify-center border-l border-t border-b border-slate-700/30">
                        <span className="skew-x-[12deg] inline-block font-black">TOTAL</span>
                      </div>
                      {/* Right slanted block */}
                      <div className="bg-[#dc2626] text-white px-2.5 md:px-3.5 lg:px-4.5 py-0.5 md:py-1 lg:py-1.5 skew-x-[-12deg] -ml-[2px] rounded-r flex items-center justify-center shadow-[0_0_12px_rgba(220,38,38,0.35)] border-r border-t border-b border-red-500/20">
                        <span className="skew-x-[12deg] inline-block font-black">TIME</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl text-white drop-shadow-[0_0_12px_rgba(239,68,68,0.4)] utmb-font whitespace-nowrap">
                    {modalData.totalTimeDisplay || "-"}
                  </div>
                  {modalData.totalTimeMs > 0 && (
                    <div className="mt-2 md:mt-3.5 lg:mt-4 bg-slate-950/60 px-2.5 md:px-4 lg:px-5 py-1 md:py-1.5 lg:py-2.5 rounded-xl border border-slate-900/50 text-[11px] sm:text-xs md:text-sm lg:text-base text-slate-200 font-mono flex items-center justify-center gap-1 md:gap-1.5 lg:gap-2.5">
                      <span className="text-slate-400 font-bold uppercase text-[8px] sm:text-[9px] md:text-[10px] lg:text-[12px] tracking-wider">Avg Pace</span>
                      <span className="text-red-500 text-xs sm:text-sm md:text-base lg:text-xl font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                        {calculatePace(modalData.totalTimeMs, modalData.category, modalData.distanceKm)}
                      </span>
                      <span className="text-slate-400 text-[9px] sm:text-[10px] md:text-xs lg:text-sm">/km</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rank cards — dark theme styled like the Total Time card */}
              <div className="flex flex-row items-center justify-end gap-1.5 md:gap-4 lg:gap-4.5 flex-none overflow-visible">
                {(() => {
                  const rankItems = [
                    { label: "Overall", value: modalData.overallRank, gradient: "from-amber-600 to-yellow-400", glow: "rgba(245,158,11,0.4)", accentColor: "#f59e0b" },
                    { label: modalData.category || "Category", value: modalData.categoryRank, gradient: "from-red-600 to-rose-400", glow: "rgba(239,68,68,0.4)", accentColor: "#ef4444" },
                    { label: modalData.gender || "Gender", value: modalData.genderRank, gradient: "from-emerald-600 to-teal-400", glow: "rgba(16,185,129,0.4)", accentColor: "#10b981" },
                    ...(modalData.ageCategory?.trim() && modalData.ageCategory.trim() !== "-"
                      ? [{ label: modalData.ageCategory.trim(), value: modalData.ageRank, gradient: "from-indigo-600 to-purple-400", glow: "rgba(139,92,246,0.4)", accentColor: "#8b5cf6" }]
                      : []),
                  ];
                  const pairs = [];
                  for (let i = 0; i < rankItems.length; i += 2) {
                    pairs.push(rankItems.slice(i, i + 2));
                  }
                  return pairs.map((pair, pairIdx) => (
                    <div key={pairIdx} className="flex flex-row items-center relative overflow-visible">
                      {pair.map(({ label, value, gradient, glow, accentColor }, idx) => {
                        const variant = idx % 2 === 0 ? "A" : "B";
                        const translateClass = idx % 2 === 0 ? "-translate-y-1 md:-translate-y-2.5 lg:-translate-y-4" : "translate-y-5 md:translate-y-6.5 lg:translate-y-8";
                        const marginClass = idx % 2 === 1 ? "-ml-[120px] md:-ml-[162px] lg:-ml-[235px]" : "";
                        const paddingClass = variant === "A"
                          ? "pr-[62px] md:pr-[80px] lg:pr-[122px] pt-1 md:pt-1.5 lg:pt-3 -mt-2 md:-mt-3 lg:-mt-6"
                          : "pl-[62px] md:pl-[80px] lg:pl-[122px] pb-2 md:pb-2.5 lg:pb-4 mt-1.5 md:mt-2.5 lg:mt-4";
                        return (
                          <div
                            key={label}
                            className={`relative flex flex-col items-center justify-center w-[155px] h-[115px] md:w-[210px] md:h-[145px] lg:w-[300px] lg:h-[200px] flex-none py-1.5 md:py-2 px-2 md:px-3 overflow-visible transition-transform duration-300 ${translateClass} ${marginClass}`}
                          >
                            {/* SVG Background Shape */}
                            <CardBgSVG accentColor={accentColor} id={`desk-${label}`} variant={variant} />

                            <div className={`relative z-10 flex flex-col items-center justify-center w-full ${paddingClass}`}>
                              {/* Slanted Parallel Badge (UTMB Style) */}
                              <div className="flex justify-center mb-1.5 md:mb-2 lg:mb-2.5 max-w-full overflow-visible px-0.5">
                                <div className="flex text-[9px] md:text-[9px] lg:text-[12px] font-black uppercase tracking-wider font-sans">
                                  {/* Left slanted block */}
                                  <div className="bg-[#242630] text-white px-2 md:px-1.5 lg:px-3.5 py-0.5 lg:py-1 skew-x-[-12deg] rounded-l flex items-center justify-center border-l border-t border-b border-slate-700/30 max-w-[85px] md:max-w-[72px] lg:max-w-[120px]">
                                    <span className="skew-x-[12deg] inline-block font-black truncate">{label}</span>
                                  </div>
                                  {/* Right slanted block */}
                                  <div className={`bg-gradient-to-r ${gradient} text-white px-2 md:px-1.5 lg:px-3.5 py-0.5 lg:py-1 skew-x-[-12deg] -ml-[2px] rounded-r flex items-center justify-center border-r border-t border-b border-white/10 shadow-[0_0_8px_${glow}]`}>
                                    <span className="skew-x-[12deg] inline-block font-black">RANK</span>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="text-3xl md:text-3xl lg:text-5xl font-black text-white"
                                style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
                              >
                                {value ?? "-"}
                              </div>
                              <div className="text-[10px] md:text-[9px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {value != null ? "Position" : "N/A"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Mobile Layout: 1 big card + grid of position cards */}
          <div className="flex sm:hidden flex-col gap-3">
            {/* TOTAL TIME — big dark card */}
            <div className="bg-[#16171f] rounded-xl overflow-hidden shadow-xl flex flex-col py-6">
              <div className="flex flex-col items-center justify-center px-6">
                {/* Slanted Parallel Badge (UTMB INDEX Style) */}
                <div className="flex justify-center mb-4">
                  <div className="flex text-[11px] font-black uppercase tracking-wider font-sans">
                    {/* Left slanted block */}
                    <div className="bg-[#242630] text-white px-3 py-1.5 skew-x-[-12deg] rounded-l flex items-center justify-center border-l border-t border-b border-slate-700/30">
                      <span className="skew-x-[12deg] inline-block font-black">TOTAL</span>
                    </div>
                    {/* Right slanted block */}
                    <div className="bg-[#dc2626] text-white px-3.5 py-1.5 skew-x-[-12deg] -ml-[2px] rounded-r flex items-center justify-center shadow-[0_0_12px_rgba(220,38,38,0.35)] border-r border-t border-b border-red-500/20">
                      <span className="skew-x-[12deg] inline-block font-black">TIME</span>
                    </div>
                  </div>
                </div>

                <div className="text-4xl text-white drop-shadow-[0_0_12px_rgba(239,68,68,0.4)] utmb-font">
                  {modalData.totalTimeDisplay || "-"}
                </div>
                {modalData.totalTimeMs > 0 && (
                  <div className="mt-3.5 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-900/50 text-sm md:text-base text-slate-200 font-mono flex items-center justify-center gap-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px] md:text-[11px] tracking-wider">Avg Pace</span>
                    <span className="text-red-500 text-base md:text-lg font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                      {calculatePace(modalData.totalTimeMs, modalData.category, modalData.distanceKm)}
                    </span>
                    <span className="text-slate-400 text-xs md:text-sm">/km</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Interlocking Pairs */}
            <div className="flex flex-col gap-12 items-center justify-center pt-8 pb-2">
              {[
                // Pair 1: Overall & Category
                [
                  { label: "Overall", value: modalData.overallRank, gradient: "from-amber-600 to-yellow-400", glow: "rgba(245,158,11,0.4)", accentColor: "#f59e0b" },
                  { label: modalData.category || "Category", value: modalData.categoryRank, gradient: "from-red-600 to-rose-400", glow: "rgba(239,68,68,0.4)", accentColor: "#ef4444" },
                ],
                // Pair 2: Gender & Age (if available)
                [
                  { label: modalData.gender || "Gender", value: modalData.genderRank, gradient: "from-emerald-600 to-teal-400", glow: "rgba(16,185,129,0.4)", accentColor: "#10b981" },
                  ...(modalData.ageCategory?.trim() && modalData.ageCategory.trim() !== "-"
                    ? [{ label: modalData.ageCategory.trim(), value: modalData.ageRank, gradient: "from-indigo-600 to-purple-400", glow: "rgba(139,92,246,0.4)", accentColor: "#8b5cf6" }]
                    : []),
                ]
              ].map((pair, pairIdx) => (
                <div key={pairIdx} className="w-full flex flex-row items-center justify-center py-2 overflow-visible">
                  {pair.map(({ label, value, gradient, glow, accentColor }, idx) => {
                    const variant = idx % 2 === 0 ? "A" : "B";
                    const translateClass = idx % 2 === 0 ? "-translate-y-3" : "translate-y-3";
                    const marginClass = idx % 2 === 1 ? "-ml-[22%]" : "";
                    const paddingClass = variant === "A" ? "pr-[42%]" : "pl-[42%]";
                    return (
                      <div
                        key={label}
                        className={`relative flex flex-col items-center justify-center w-[61%] h-[145px] xs:h-[165px] flex-none py-2 px-2 overflow-visible transition-transform duration-300 ${translateClass} ${marginClass}`}
                      >
                        {/* SVG Background Shape */}
                        <CardBgSVG accentColor={accentColor} id={`mob-${label}`} variant={variant} />

                        <div className={`relative z-10 flex flex-col items-center justify-center w-full ${paddingClass}`}>
                          {/* Slanted Parallel Badge */}
                          <div className="flex justify-center mb-2 max-w-full overflow-visible px-1">
                            <div className="flex text-[8px] xs:text-[9px] font-black uppercase tracking-wider font-sans">
                              {/* Left slanted block */}
                              <div className="bg-[#242630] text-white px-2.5 py-0.5 skew-x-[-12deg] rounded-l flex items-center justify-center border-l border-t border-b border-slate-700/30 max-w-[95px]">
                                <span className="skew-x-[12deg] inline-block font-black truncate">{label}</span>
                              </div>
                              {/* Right slanted block */}
                              <div className={`bg-gradient-to-r ${gradient} text-white px-2 py-0.5 skew-x-[-12deg] -ml-[2px] rounded-r flex items-center justify-center border-r border-t border-b border-white/10 shadow-[0_0_8px_${glow}]`}>
                                <span className="skew-x-[12deg] inline-block font-black">RANK</span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="text-2xl xs:text-3xl font-black text-white"
                            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
                          >
                            {value ?? "-"}
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {value != null ? "Position" : "N/A"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </motion.div>


        {/* ── EVOLUTION CHART SECTION (like UTMB) ── */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-6xl mx-auto px-4 mb-6"
        >
          <div className="bg-[#16171f] rounded-2xl overflow-hidden shadow-xl p-6 relative border border-slate-800">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-wider uppercase">EVOLUTION</h2>
              <div className="flex gap-2">
                <span className="bg-red-500/15 text-red-500 px-3 py-1 rounded text-xs font-black uppercase tracking-wider border border-red-500/30">
                  Time Curve
                </span>
                <span className="hidden sm:inline-block bg-slate-800 text-slate-450 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                  CP Progress
                </span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="relative h-64 w-full flex items-center justify-center">
              {parsedPoints.length >= 2 ? (
                // Render real progression chart
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="relative w-full h-48">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="5" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <pattern id="chartGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <rect width="20" height="20" fill="none" stroke="rgba(239, 68, 68, 0.04)" strokeWidth="0.5" />
                        </pattern>
                      </defs>

                      {/* Background Grid Texture */}
                      <rect x="40" y="20" width="720" height="140" fill="url(#chartGrid)" />

                      {/* Horizontal Guideline lines */}
                      <line x1="40" y1="40" x2="760" y2="40" stroke="rgba(239, 68, 68, 0.15)" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="40" y1="90" x2="760" y2="90" stroke="rgba(239, 68, 68, 0.15)" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="40" y1="140" x2="760" y2="140" stroke="rgba(239, 68, 68, 0.15)" strokeDasharray="4 4" strokeWidth="1" />

                      {/* Gradient filled area */}
                      {areaPath && (
                        <motion.path
                          d={areaPath}
                          fill="url(#chartGrad)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 1.2 }}
                        />
                      )}

                      {/* Vertical helper lines for points */}
                      {coords.map((coord, idx) => (
                        <motion.line
                          key={`v-${idx}`}
                          x1={coord.x}
                          y1={20}
                          x2={coord.x}
                          y2={160}
                          stroke="rgba(239, 68, 68, 0.15)"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.3 + (idx / coords.length) * 1.2 }}
                        />
                      ))}

                      {/* Glow path */}
                      {linePath && (
                        <motion.path
                          d={linePath}
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="6"
                          opacity="0.3"
                          filter="url(#neonGlow)"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
                        />
                      )}
                      {/* Main stroke path */}
                      {linePath && (
                        <motion.path
                          d={linePath}
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
                        />
                      )}
                    </svg>

                    {/* HTML Overlay for perfectly round dots */}
                    <div className="absolute inset-0 pointer-events-none">
                      {coords.map((coord, idx) => {
                        const leftPct = (coord.x / 800) * 100;
                        const topPct = (coord.y / 200) * 100;
                        return (
                          <div
                            key={idx}
                            className="absolute pointer-events-auto cursor-pointer group"
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: 0.3 + (idx / coords.length) * 1.2
                              }}
                              className="relative w-7 h-7 flex items-center justify-center"
                            >
                              {/* Outer ring */}
                              <div className="w-[16px] h-[16px] rounded-full bg-[#16171f] border-[2.5px] border-red-500 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.3)] z-10" />
                              {/* Inner center dot */}
                              <div className="absolute w-[6px] h-[6px] rounded-full bg-red-500 z-20" />
                              {/* Hover glow */}
                              <div className="absolute w-7 h-7 rounded-full bg-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-200 z-0" />
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X-Axis labels */}
                  <div className="flex justify-between px-10 text-[10px] text-slate-400 font-bold uppercase tracking-wider relative -top-2">
                    {parsedPoints.map((pt, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-slate-500 font-extrabold text-[9px]">{pt.label}</div>
                        <div className="text-white font-mono font-black mt-0.5 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">{pt.display.split(".")[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Render blurred mock chart with fallback notice
                <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                  {/* Mock blurred SVG path */}
                  <svg className="w-full h-48 filter blur-[6px] opacity-25" viewBox="0 0 800 200" preserveAspectRatio="none">
                    <path d="M 50 160 Q 200 120 400 90 T 750 40 L 750 200 L 50 200 Z" fill="rgba(239, 68, 68, 0.3)" />
                    <path d="M 50 160 Q 200 120 400 90 T 750 40" fill="none" stroke="#EF4444" strokeWidth="4" />
                  </svg>

                  {/* Fallback Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
                    <div className="bg-white text-slate-900 font-black px-6 py-3 rounded-xl shadow-2xl text-xs sm:text-sm uppercase tracking-widest text-center max-w-sm border border-slate-200">
                      Waktu Checkpoint Tidak Tersedia
                      <div className="text-[10px] text-slate-500 font-bold mt-1 tracking-wider normal-case">
                        Grafik hanya dapat dirender jika data perantara (CP) tercatat.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── RACE DETAILS ── */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-6xl mx-auto px-4 pb-20"
        >
          <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-5 border-b border-slate-100 gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Race Details</h2>
                <p className="text-slate-400 text-xs font-semibold mt-0.5">{eventName}</p>
              </div>
              <button
                className="bg-[#DC2626] hover:bg-red-700 text-white font-black py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto cursor-pointer transition-colors"
                onClick={onDownloadCert}
                disabled={downloading}
              >
                <Download className="w-4 h-4" />
                {downloading ? "Rendering…" : "Download E-Certificate"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Timing */}
              <div className="px-6 py-6 space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Timing</h3>
                {[
                  { label: "Race Category", value: modalData.category || "-", mono: false },
                  { label: "Age Category", value: modalData.ageCategory?.trim() || "-", mono: false },
                  { label: "Start Time", value: modalData.startTimeRaw || "-", mono: true },
                  { label: "Finish Time", value: modalData.finishTimeRaw || "-", mono: true },
                  ...(modalData.penaltyMs > 0
                    ? [{
                      label: "Penalty",
                      value: `+${String(Math.floor(modalData.penaltyMs / 3600000)).padStart(2, "0")}:${String(Math.floor((modalData.penaltyMs % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((modalData.penaltyMs % 60000) / 1000)).padStart(2, "0")}`,
                      mono: true,
                    }]
                    : []),
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-center gap-4">
                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest shrink-0">{label}</span>
                    <span className={`font-bold text-slate-800 text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Checkpoints */}
              <div className="px-6 py-6 space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Checkpoints</h3>
                {modalData.checkpointTimes && modalData.checkpointTimes.length > 0 ? (
                  modalData.checkpointTimes.map((time: string, idx: number) => {
                    const m = time.match(/(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/);
                    let t = m ? m[1] : time;
                    if (t.includes(".")) {
                      const [hhmmss, frac] = t.split(".");
                      t = `${hhmmss}.${frac.padEnd(3, "0").slice(0, 3)}`;
                    } else if (m) {
                      t = `${t}.000`;
                    }
                    return (
                      <div key={idx} className="flex justify-between items-center gap-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">CP {idx + 1}</span>
                        <span className="font-mono font-semibold text-slate-700 text-sm bg-slate-100 px-3 py-1 rounded-md">{t}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-400 text-sm italic">No checkpoint data available.</div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
