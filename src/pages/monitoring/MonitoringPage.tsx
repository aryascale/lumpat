import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Donut, BarMeter, LatencyBars, type ChartPoint, type DonutSegment } from './charts';

interface MonitoringData {
  server: {
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    pid: number;
    cpuCount: number;
    cpuModel: string;
    cpuPercent: number;
    processCpuPercent: number;
    uptimeOs: number;
    uptimeProcess: number;
    memory: { total: number; free: number; used: number; usedPercent: number };
    processMemory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  };
  traffic: {
    series: Array<{ t: number; count: number; e4: number; e5: number }>;
    range: number;
    total: number;
    rps: number;
    statusCodes: { s2: number; s3: number; s4: number; s5: number };
  };
  latency: { p50: number; p95: number; p99: number; avg: number; samples: number };
  topEndpoints: Array<{ method: string; path: string; count: number; avgMs: number; maxMs: number; errors: number; lastSeen: number }>;
  recentErrors: Array<{ time: number; method: string; path: string; status: number }>;
  db: { ok: boolean; latencyMs: number | null; threads: number | null; error?: string };
  sockets: number;
  disk: { bytes: number; files: number };
  meta: { requests: number; errors5xx: number; since: number };
  now: number;
}

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDur(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function fmtAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
}

const RANGES = [
  { value: 15, label: '15 mnt' },
  { value: 60, label: '1 jam' },
  { value: 360, label: '6 jam' },
  { value: 1440, label: '24 jam' },
];

const INTERVALS = [
  { value: 5000, label: '5 dtk' },
  { value: 10000, label: '10 dtk' },
  { value: 30000, label: '30 dtk' },
  { value: 0, label: 'Manual' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-sky-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
  PATCH: 'text-fuchsia-400',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#11141a] border border-white/[0.07] rounded-2xl p-5 ${className}`}>{children}</div>;
}

function StatCard({ title, value, sub, tone = 'default' }: { title: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-slate-100';
  return (
    <Card className="!p-4">
      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{title}</div>
      <div className={`mt-1.5 text-2xl font-bold font-mono ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 font-mono">{sub}</div>}
    </Card>
  );
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(60);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const dataRef = useRef<MonitoringData | null>(null);
  dataRef.current = data;

  const load = useCallback(async (r: number) => {
    try {
      const res = await fetch(`/api/monitoring?range=${r}`, { credentials: 'include' });
      if (res.status === 401) {
        setError('unauthorized');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(range);
    if (intervalMs === 0) return;
    const id = setInterval(() => load(range), intervalMs);
    return () => clearInterval(id);
  }, [range, intervalMs, load]);

  if (error === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-slate-100">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-slate-400">
            Sesi admin tidak valid. Login ulang di halaman admin, lalu kembali ke halaman ini.
          </p>
          <Link to="/admin" className="mt-4 inline-block px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
            Ke Halaman Admin
          </Link>
        </Card>
      </div>
    );
  }

  const s = data;
  const chartPoints: ChartPoint[] = (s?.traffic.series || []).map((p) => ({ t: p.t, v: p.count }));
  const sc = s?.traffic.statusCodes || { s2: 0, s3: 0, s4: 0, s5: 0 };
  const degraded = !s || !s.db.ok || s.server.cpuPercent > 90 || s.server.memory.usedPercent > 90;

  const donutSegments: DonutSegment[] = [
    { label: '2xx Sukses', value: sc.s2, color: '#34d399' },
    { label: '3xx Redirect', value: sc.s3, color: '#38bdf8' },
    { label: '4xx Client Error', value: sc.s4, color: '#fbbf24' },
    { label: '5xx Server Error', value: sc.s5, color: '#f87171' },
  ];
  const totalReqs = sc.s2 + sc.s3 + sc.s4 + sc.s5;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-50">Server Monitoring</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  degraded ? 'bg-amber-400/10 text-amber-400' : 'bg-emerald-400/10 text-emerald-400'
                }`}
              >
                <span className={`relative flex h-2 w-2`}>
                  <span className={`absolute inline-flex h-full w-full rounded-full ${degraded ? 'bg-amber-400' : 'bg-emerald-400'} opacity-60 animate-ping`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${degraded ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                </span>
                {degraded ? 'Degraded' : 'All Systems Operational'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 font-mono">
              {s ? `${s.server.hostname} • ${s.server.platform} (${s.server.arch}) • Node ${s.server.nodeVersion}` : 'Memuat...'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#11141a] border border-white/[0.07] rounded-lg p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    range === r.value ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <select
              value={intervalMs}
              onChange={(e) => setIntervalMs(parseInt(e.target.value))}
              className="bg-[#11141a] border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>
                  Live: {i.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => load(range)}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-[#11141a] border border-white/[0.07] text-xs font-semibold text-slate-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && error !== 'unauthorized' && (
          <Card className="mb-6 !border-red-500/30">
            <div className="text-sm text-red-400 font-semibold">Gagal memuat data monitoring: {error}</div>
            <div className="mt-1 text-xs text-slate-500">Pastikan server (port 3069) berjalan.</div>
          </Card>
        )}

        {!s && loading && !error && (
          <div className="py-32 text-center text-slate-500 text-sm">Memuat data monitoring...</div>
        )}

        {s && (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                title={`Requests (${RANGES.find((r) => r.value === s.traffic.range)?.label || ''})`}
                value={s.traffic.total.toLocaleString('id-ID')}
                sub={`${s.traffic.rps} req/dtk`}
              />
              <StatCard
                title="Errors (5xx)"
                value={sc.s5.toLocaleString('id-ID')}
                sub={`${sc.s4.toLocaleString('id-ID')} client error (4xx)`}
                tone={sc.s5 > 0 ? 'bad' : 'good'}
              />
              <StatCard
                title="Uptime Server"
                value={fmtDur(s.server.uptimeOs)}
                sub={`Proses: ${fmtDur(s.server.uptimeProcess)}`}
                tone="good"
              />
              <StatCard
                title="DB"
                value={s.db.ok ? `${s.db.latencyMs ?? '-'} ms` : 'DOWN'}
                sub={s.db.ok ? `${s.db.threads ?? '-'} koneksi aktif` : s.db.error || 'Tidak terhubung'}
                tone={s.db.ok ? ((s.db.latencyMs ?? 0) > 100 ? 'warn' : 'good') : 'bad'}
              />
            </div>

            {/* Traffic chart */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-200">Traffic</h2>
                  <p className="text-xs text-slate-500">HTTP requests per menit</p>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {intervalMs > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </span>
                  ) : lastUpdated ? (
                    `Update ${fmtAgo(lastUpdated, s.now)}`
                  ) : null}
                </div>
              </div>
              <div className="pb-6">
                <AreaChart points={chartPoints} height={230} />
              </div>
            </Card>

            {/* Middle row: resources */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <h2 className="text-sm font-bold text-slate-200 mb-4">CPU</h2>
                <div className="space-y-4">
                  <BarMeter label="Sistem" percent={s.server.cpuPercent} sub={`${s.server.cpuCount} core • ${s.server.cpuModel}`} />
                  <BarMeter label="Proses Node" percent={s.server.processCpuPercent} sub={`PID ${s.server.pid}`} />
                </div>
              </Card>
              <Card>
                <h2 className="text-sm font-bold text-slate-200 mb-4">Memori</h2>
                <div className="space-y-4">
                  <BarMeter
                    label="Sistem"
                    percent={s.server.memory.usedPercent}
                    sub={`${fmtBytes(s.server.memory.used)} / ${fmtBytes(s.server.memory.total)}`}
                  />
                  <BarMeter
                    label="Node Heap"
                    percent={(s.server.processMemory.heapUsed / Math.max(1, s.server.processMemory.heapTotal)) * 100}
                    sub={`RSS ${fmtBytes(s.server.processMemory.rss)} • Heap ${fmtBytes(s.server.processMemory.heapUsed)}`}
                  />
                </div>
              </Card>
              <Card>
                <h2 className="text-sm font-bold text-slate-200 mb-4">Realtime & Storage</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Socket Clients</div>
                    <div className="mt-1 text-xl font-bold font-mono text-slate-100">{s.sockets}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Uploads</div>
                    <div className="mt-1 text-xl font-bold font-mono text-slate-100">{fmtBytes(s.disk.bytes)}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.disk.files.toLocaleString('id-ID')} file</div>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white/[0.03] p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Sejak Start</div>
                  <div className="mt-1 text-xs font-mono text-slate-300">
                    {s.meta.requests.toLocaleString('id-ID')} requests • {s.meta.errors5xx.toLocaleString('id-ID')} error 5xx
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Start: {new Date(s.meta.since).toLocaleString('id-ID')}</div>
                </div>
              </Card>
            </div>

            {/* Bottom row: donut + latency */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <h2 className="text-sm font-bold text-slate-200 mb-4">Status Codes</h2>
                <div className="flex items-center gap-6 flex-wrap">
                  <Donut
                    segments={donutSegments}
                    centerValue={totalReqs.toLocaleString('id-ID')}
                    centerLabel="Responses"
                  />
                  <div className="space-y-2.5 min-w-[140px]">
                    {donutSegments.map((seg) => (
                      <div key={seg.label} className="flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seg.color }} />
                          <span className="text-slate-400">{seg.label}</span>
                        </div>
                        <span className="font-mono text-slate-200 font-semibold">
                          {seg.value.toLocaleString('id-ID')}
                          <span className="text-slate-600 ml-1">
                            {totalReqs > 0 ? `${((seg.value / totalReqs) * 100).toFixed(1)}%` : '0%'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-200">Latency (API)</h2>
                  <span className="text-[10px] text-slate-500 font-mono">{s.latency.samples.toLocaleString('id-ID')} sampel</span>
                </div>
                <LatencyBars
                  items={[
                    { label: 'p50 (median)', value: s.latency.p50 },
                    { label: 'p95', value: s.latency.p95 },
                    { label: 'p99', value: s.latency.p99 },
                    { label: 'avg', value: s.latency.avg },
                  ]}
                />
              </Card>
            </div>

            {/* Tables row */}
            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 !p-0 overflow-hidden">
                <div className="p-5 pb-3">
                  <h2 className="text-sm font-bold text-slate-200">Top Endpoints (24 jam)</h2>
                  <p className="text-xs text-slate-500">Endpoint API tersibuk berdasarkan jumlah request</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-y border-white/[0.06] text-slate-500">
                        <th className="text-left font-semibold px-5 py-2.5">Method</th>
                        <th className="text-left font-semibold px-3 py-2.5">Endpoint</th>
                        <th className="text-right font-semibold px-3 py-2.5">Req</th>
                        <th className="text-right font-semibold px-3 py-2.5">Avg</th>
                        <th className="text-right font-semibold px-3 py-2.5">Max</th>
                        <th className="text-right font-semibold px-5 py-2.5">Err</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topEndpoints.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-600">
                            Belum ada data request API
                          </td>
                        </tr>
                      ) : (
                        s.topEndpoints.map((e) => (
                          <tr key={`${e.method} ${e.path}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className={`px-5 py-2.5 font-bold font-mono ${METHOD_COLORS[e.method] || 'text-slate-400'}`}>{e.method}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-300 truncate max-w-[220px]">{e.path}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-200">{e.count.toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-400">{e.avgMs} ms</td>
                            <td className={`px-3 py-2.5 text-right font-mono ${e.maxMs > 1000 ? 'text-amber-400' : 'text-slate-400'}`}>{e.maxMs} ms</td>
                            <td className={`px-5 py-2.5 text-right font-mono ${e.errors > 0 ? 'text-red-400' : 'text-slate-600'}`}>{e.errors || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden">
                <div className="p-5 pb-3">
                  <h2 className="text-sm font-bold text-slate-200">Recent Errors (5xx)</h2>
                  <p className="text-xs text-slate-500">20 error server terakhir</p>
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {s.recentErrors.length === 0 ? (
                    <div className="px-5 py-10 text-center text-xs text-slate-600">
                      <div className="text-2xl mb-2">✓</div>
                      Tidak ada error 5xx
                    </div>
                  ) : (
                    s.recentErrors.map((err, i) => (
                      <div key={i} className="px-5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">{err.status}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{fmtAgo(err.time, s.now)}</span>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-300 truncate">
                          <span className="text-slate-500">{err.method}</span> {err.path}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="text-center text-[10px] text-slate-600 font-mono pt-2 pb-6">
              lumpat monitoring • data in-memory sejak server start • {new Date(s.now).toLocaleString('id-ID')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
