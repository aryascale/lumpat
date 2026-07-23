import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveTiming } from "../hooks/useLiveTiming";
import { loadMasterParticipants, MasterParticipant } from "../lib/data";
import { calculatePace } from "../lib/time";
import { renderCertificatePNG, downloadDataUrl } from "../lib/certificate";
import Navbar from "../components/Navbar";
import { getData } from "country-list";

// Helper functions
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

function parseTimeToMs(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 3) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const sStr = parts[2];
  let s = 0;
  let ms = 0;
  if (sStr.includes('.')) {
    const sParts = sStr.split('.');
    s = parseInt(sParts[0], 10);
    ms = parseInt(sParts[1], 10);
  } else {
    s = parseInt(sStr, 10);
  }
  return (h * 3600 + m * 60 + s) * 1000 + ms;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "-";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msec = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msec).padStart(3, '0')}`;
}

function onlyTime(raw: string) {
  const m = raw.match(/(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/);
  if (!m) return raw;
  let t = m[1];
  if (t.includes(".")) {
    const [hhmmss, frac] = t.split(".");
    t = `${hhmmss}.${frac.padEnd(3, "0").slice(0, 3)}`;
  } else {
    t = `${t}.000`;
  }
  return t;
}

export default function ParticipantDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [basicData, setBasicData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [masterList, setMasterList] = useState<MasterParticipant[]>([]);
  
  useEffect(() => {
    if (!name) return;
    fetch(`/api/participant?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) {
          setError(res.error);
        } else {
          setBasicData(res);
        }
      })
      .catch(err => {
        setError("Failed to load participant");
      });
  }, [name]);

  const eventId = basicData?.eventId || "default";
  const { recordsByEpc, checkpoints } = useLiveTiming(eventId);

  useEffect(() => {
    if (eventId !== "default") {
      loadMasterParticipants(eventId).then(list => setMasterList(list || []));
    }
  }, [eventId]);

  const displayData = useMemo(() => {
    if (!basicData || masterList.length === 0) return null;
    
    const epc = basicData.bib;
    const mp = masterList.find(m => m.bib === epc);
    
    const mStartStr = mp?.manualStartTime;
    const mFinishStr = mp?.manualFinishTime;

    let manualStartMs = 0;
    if (mStartStr) manualStartMs = parseTimeToMs(mStartStr);

    let finishTimeRaw = "";
    let totalTimeDisplay = "";
    let totalTimeMs = 0;
    const tzOffset = basicData.timezoneOffset || 7;

    const pHours = parseInt(mp?.penaltyHours || "0", 10);
    const pMinutes = parseInt(mp?.penaltyMinutes || "0", 10);
    const pSeconds = parseInt(mp?.penaltySeconds || "0", 10);
    const penaltyMs = (pHours * 3600 + pMinutes * 60 + pSeconds) * 1000;

    let cpTimes: string[] = [];
    const recs = recordsByEpc.get(epc) || [];
    
    let startTimeValue = manualStartMs;
    const finishRec = recs.find(r => r.checkpointName.toLowerCase().includes('finish'));
    
    if (mFinishStr) {
      finishTimeRaw = mFinishStr;
      const fMs = parseTimeToMs(mFinishStr);
      if (fMs > startTimeValue) {
        totalTimeMs = (fMs - startTimeValue) + penaltyMs;
        totalTimeDisplay = formatDuration(totalTimeMs);
      }
    } else if (finishRec) {
      finishTimeRaw = formatLocalTime(finishRec.time, tzOffset);
      const fMs = finishRec.time % (24 * 3600 * 1000) + tzOffset * 3600000;
      if (startTimeValue === 0) {
        totalTimeMs = 0;
        totalTimeDisplay = "00:00:00.000";
      } else {
        totalTimeMs = (fMs - startTimeValue) + penaltyMs;
        totalTimeDisplay = formatDuration(totalTimeMs);
      }
    }

    checkpoints.forEach(cp => {
       const hit = recs.find(r => r.checkpointId === cp.id);
       if (hit) cpTimes.push(formatLocalTime(hit.time, tzOffset));
       else cpTimes.push("-");
    });

    // Default to null
    let countryCode = null;
    let countryName = "Indonesia";

    if (mp) {
      // try to get nationality from basicData
      const basicDataStr = mp.basicData;
      let basicData: any = {};
      if (basicDataStr) {
        try {
          basicData = JSON.parse(basicDataStr);
        } catch (e) {}
      }
      
      // Process nationality for flag
      const nationalityStr = basicData.customData?.["nationality"] || "";
      if (nationalityStr) {
        const cleanName = nationalityStr.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '').trim();
        const countryMatch = getData().find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
        if (countryMatch) {
          countryCode = countryMatch.code.toLowerCase();
          countryName = countryMatch.name;
        }
      }
    }

    return {
      name: basicData.name,
      bib: basicData.bib,
      gender: basicData.gender,
      category: basicData.category,
      ageCategory: mp?.ageCategory || "",
      countryCode,
      countryName,
      startTimeRaw: mStartStr || formatDuration(startTimeValue), 
      finishTimeRaw: finishTimeRaw || "-",
      totalTimeDisplay: totalTimeDisplay || "-",
      totalTimeMs,
      checkpointTimes: cpTimes,
      penaltyMs,
      distanceKm: basicData.distanceKm,
      club: mp?.club || ""
    };
  }, [basicData, masterList, recordsByEpc, checkpoints]);

  const onDownloadCert = async () => {
    if (!displayData) return;
    try {
      setDownloading(true);
      const png = await renderCertificatePNG({
        eventId: basicData.eventId,
        eventName: basicData.eventName,
        name: displayData.name,
        bib: displayData.bib,
        gender: displayData.gender,
        category: displayData.category,
        ageCategory: displayData.ageCategory,
        finishTime: displayData.finishTimeRaw,
        totalTimeDisplay: displayData.totalTimeDisplay,
        pace: displayData.totalTimeMs ? calculatePace(displayData.totalTimeMs, displayData.category, displayData.distanceKm) : undefined,
        overallRank: null,
        genderRank: null,
        categoryRank: null,
        ageRank: null,
      });
      const slug = (basicData.eventName || "event").replace(/\s+/g, "-").toLowerCase();
      downloadDataUrl(png, `${slug}-certif-lumpat.png`);
    } catch (err: any) {
      console.error("Browser error", err);
      alert("Belum ada template sertifikat atau terjadi error.");
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Oops!</h2>
          <p className="text-slate-500">{error}</p>
          <Link to="/" className="mt-4 inline-block text-red-600 font-semibold hover:underline">
            Go back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
        <p className="text-slate-500 font-medium tracking-wide animate-pulse">Loading participant...</p>
      </div>
    );
  }

  const cpStr = displayData.checkpointTimes.length > 0
      ? displayData.checkpointTimes.map(onlyTime).join(" • ")
      : "-";

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="pt-24 pb-12 max-w-4xl mx-auto px-4">
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-red-600 to-orange-500 opacity-10"></div>
          
          <div className="w-28 h-28 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-3xl flex items-center justify-center shadow-lg shadow-red-500/30 mb-6 relative z-10">
            <span className="text-white text-5xl font-black">{displayData.name.charAt(0).toUpperCase()}</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-2 uppercase relative z-10">
            {displayData.name}
          </h1>
          
          <div className="flex items-center justify-center gap-3 text-slate-600 font-medium mb-4 relative z-10">
            <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-sm">
              {displayData.countryCode && <img src={`https://flagcdn.com/w20/${displayData.countryCode}.png`} alt={displayData.countryCode} className="w-4 h-auto rounded-sm" />}
              {displayData.countryName}
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full text-sm">{displayData.category}</span>
          </div>

          <div className="text-slate-500 text-sm font-medium relative z-10">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Club</span>
            {displayData.club || "-"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">BIB Number</div>
             <div className="text-2xl font-black text-red-600 font-mono">{displayData.bib || "-"}</div>
          </div>
          
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Time</div>
             <div className="text-3xl font-black text-white font-mono tracking-tight">{displayData.totalTimeDisplay}</div>
             <div className="mt-2 text-sm text-slate-400">
               Avg Pace: <span className="text-yellow-400 font-mono font-bold">{displayData.totalTimeMs ? calculatePace(displayData.totalTimeMs, displayData.category, displayData.distanceKm) : "--:--"} /km</span>
             </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Race Details</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Start Time</div>
               <div className="font-mono font-semibold text-emerald-600 text-sm">{displayData.startTimeRaw}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Finish Time</div>
               <div className="font-mono font-semibold text-rose-500 text-sm">{displayData.finishTimeRaw}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gender</div>
               <div className="font-semibold text-slate-800 text-sm">{displayData.gender}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Age Category</div>
               <div className="font-semibold text-slate-800 text-sm">{displayData.ageCategory || "-"}</div>
            </div>
          </div>

          <div>
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Checkpoint Splits</div>
             <div className="font-mono text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 break-all leading-relaxed">
               {cpStr}
             </div>
          </div>
          
          {displayData.penaltyMs > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-orange-400 uppercase mb-1">Penalty</div>
              <div className="font-mono font-bold text-orange-600">
                +{String(Math.floor(displayData.penaltyMs / 3600000)).padStart(2, '0')}:{String(Math.floor((displayData.penaltyMs % 3600000) / 60000)).padStart(2, '0')}:{String(Math.floor((displayData.penaltyMs % 60000) / 1000)).padStart(2, '0')}
              </div>
            </div>
          )}
        </div>

        <button
          className="w-full md:w-auto bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-4 px-8 rounded-xl shadow-md transition-all text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={onDownloadCert}
          disabled={downloading}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          {downloading ? "Rendering..." : "Download E-Certificate"}
        </button>

      </div>
    </div>
  );
}
