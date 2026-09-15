import os from 'os';

const WINDOW_MINUTES = 24 * 60;
const MAX_LATENCY_SAMPLES = 20000;
const MAX_RECENT_ERRORS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MinuteBucket {
  count: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  totalMs: number;
}

export interface EndpointStat {
  method: string;
  path: string;
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
  lastSeen: number;
}

export interface ErrorEntry {
  time: number;
  method: string;
  path: string;
  status: number;
}

interface Totals {
  requests: number;
  errors5xx: number;
}

const startAt = Date.now();
const minuteBuckets = new Map<number, MinuteBucket>();
const endpoints = new Map<string, EndpointStat>();
const recentErrors: ErrorEntry[] = [];
let latencies: number[] = [];
const totals: Totals = { requests: 0, errors5xx: 0 };

export function normalizePath(p: string): string {
  return p
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      if (/^\d+$/.test(seg) || UUID_RE.test(seg) || seg.length > 24) return ':id';
      return seg;
    })
    .join('/');
}

export function recordRequest(info: { path: string; method: string; status: number; durationMs: number }) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const { path, method, status, durationMs } = info;

  let bucket = minuteBuckets.get(minute);
  if (!bucket) {
    bucket = { count: 0, s2: 0, s3: 0, s4: 0, s5: 0, totalMs: 0 };
    minuteBuckets.set(minute, bucket);
  }
  bucket.count += 1;
  bucket.totalMs += durationMs;
  if (status >= 500) bucket.s5 += 1;
  else if (status >= 400) bucket.s4 += 1;
  else if (status >= 300) bucket.s3 += 1;
  else bucket.s2 += 1;

  if (path.startsWith('/api/') && !path.startsWith('/api/monitoring')) {
    const key = `${method} ${normalizePath(path)}`;
    let stat = endpoints.get(key);
    if (!stat) {
      stat = { method, path: normalizePath(path), count: 0, errors: 0, totalMs: 0, maxMs: 0, lastSeen: now };
      endpoints.set(key, stat);
    }
    stat.count += 1;
    stat.totalMs += durationMs;
    stat.maxMs = Math.max(stat.maxMs, durationMs);
    stat.lastSeen = now;
    if (status >= 400) stat.errors += 1;

    latencies.push(durationMs);
    if (latencies.length > MAX_LATENCY_SAMPLES) {
      latencies = latencies.slice(latencies.length - MAX_LATENCY_SAMPLES);
    }
  }

  if (status >= 500) {
    recentErrors.unshift({ time: now, method, path: normalizePath(path), status });
    if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.length = MAX_RECENT_ERRORS;
    totals.errors5xx += 1;
  }

  totals.requests += 1;

  const cutoff = minute - WINDOW_MINUTES;
  for (const key of minuteBuckets.keys()) {
    if (key < cutoff) minuteBuckets.delete(key);
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return Math.round(sorted[idx] * 10) / 10;
}

export function getSnapshot(rangeMinutes = 60) {
  const nowMinute = Math.floor(Date.now() / 60000);
  const startMinute = nowMinute - rangeMinutes + 1;
  const series: Array<{ t: number; count: number; e4: number; e5: number }> = [];

  for (let m = startMinute; m <= nowMinute; m++) {
    const b = minuteBuckets.get(m);
    series.push({ t: m, count: b?.count || 0, e4: b?.s4 || 0, e5: b?.s5 || 0 });
  }

  const statusCodes = { s2: 0, s3: 0, s4: 0, s5: 0 };
  let rangeTotal = 0;
  for (const point of series) {
    const b = minuteBuckets.get(point.t);
    if (!b) continue;
    statusCodes.s2 += b.s2;
    statusCodes.s3 += b.s3;
    statusCodes.s4 += b.s4;
    statusCodes.s5 += b.s5;
    rangeTotal += b.count;
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const latency = {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    avg: sorted.length ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10 : 0,
    samples: sorted.length,
  };

  const topEndpoints = [...endpoints.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => ({
      method: e.method,
      path: e.path,
      count: e.count,
      avgMs: Math.round((e.totalMs / e.count) * 10) / 10,
      maxMs: Math.round(e.maxMs),
      errors: e.errors,
      lastSeen: e.lastSeen,
    }));

  return {
    series,
    range: rangeMinutes,
    rangeTotal,
    rps: Math.round((rangeTotal / (rangeMinutes * 60)) * 100) / 100,
    statusCodes,
    latency,
    topEndpoints,
    recentErrors: recentErrors.slice(0, 20),
    totals: { ...totals, since: startAt },
  };
}

let lastCpuSample: { idle: number; total: number; ts: number } | null = null;

export function getCpuLoadPercent(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.idle + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq;
  }
  const ts = Date.now();
  if (!lastCpuSample) {
    lastCpuSample = { idle, total, ts };
    return 0;
  }
  const idleDelta = idle - lastCpuSample.idle;
  const totalDelta = total - lastCpuSample.total;
  lastCpuSample = { idle, total, ts };
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}
