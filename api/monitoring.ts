import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import process from 'process';
import { query } from '../src/lib/db';
import { verifyToken, normalizeUserRole } from '../src/lib/jwt';
import { getSnapshot, getCpuLoadPercent } from '../src/lib/metrics';
import { getSocketCount } from '../src/lib/socket';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

const ALLOWED_RANGES = [15, 60, 360, 1440];

let diskCache: { ts: number; bytes: number; files: number } | null = null;

function dirSize(dir: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { bytes: 0, files: 0 };
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = dirSize(full);
        bytes += sub.bytes;
        files += sub.files;
      } else {
        bytes += fs.statSync(full).size;
        files += 1;
      }
    } catch {
      continue;
    }
  }
  return { bytes, files };
}

function getUploadDisk() {
  if (diskCache && Date.now() - diskCache.ts < 60000) return diskCache;
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const { bytes, files } = dirSize(uploadDir);
  diskCache = { ts: Date.now(), bytes, files };
  return diskCache;
}

function expectedAdminKey(): string | null {
  const u = process.env.VITE_ADMIN_USER || process.env.ADMIN_USER || '';
  const p = process.env.VITE_ADMIN_PASS || process.env.ADMIN_PASS || '';
  if (!u || !p) return null;
  return crypto.createHash('sha256').update(`${u}:${p}`).digest('hex');
}

async function isAdminRequest(event: any): Promise<boolean> {
  const token = event.cookies?.token;
  if (token) {
    const decoded: any = verifyToken(token);
    if (decoded?.id) {
      const users: any = await query('SELECT role FROM User WHERE id = ? LIMIT 1', [decoded.id]);
      const role = normalizeUserRole(users[0]?.role);
      if (['super_admin', 'event_admin', 'scan_admin', 'payment_admin'].includes(role)) return true;
    }
  }
  const key = event.headers?.['x-admin-key'];
  const expected = expectedAdminKey();
  if (key && expected && key === expected) return true;
  return false;
}

async function getDbHealth() {
  const start = process.hrtime.bigint();
  try {
    await query('SELECT 1');
    const latencyMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6 * 10) / 10;
    let threads: number | null = null;
    try {
      const rows: any = await query("SHOW STATUS LIKE 'Threads_connected'");
      threads = rows[0]?.Value ? parseInt(rows[0].Value) : null;
    } catch {
      threads = null;
    }
    return { ok: true, latencyMs, threads };
  } catch (error: any) {
    return { ok: false, latencyMs: null, threads: null, error: error.message };
  }
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    if (!(await isAdminRequest(event))) {
      return errorResponse('Unauthorized', 401);
    }

    const requestedRange = parseInt(event.queryStringParameters?.range || '60');
    const range = ALLOWED_RANGES.includes(requestedRange) ? requestedRange : 60;

    const snapshot = getSnapshot(range);
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuUsage = process.cpuUsage();
    const processCpuPercent = Math.round(((cpuUsage.user + cpuUsage.system) / 1000000 / (process.uptime() || 1)) * 100) / 10;

    const db = await getDbHealth();
    const disk = getUploadDisk();

    return successResponse({
      server: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || '',
        cpuPercent: getCpuLoadPercent(),
        processCpuPercent: Math.min(100, processCpuPercent),
        uptimeOs: os.uptime(),
        uptimeProcess: process.uptime(),
        memory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
        },
        processMemory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
        },
      },
      traffic: {
        series: snapshot.series,
        range: snapshot.range,
        total: snapshot.rangeTotal,
        rps: snapshot.rps,
        statusCodes: snapshot.statusCodes,
      },
      latency: snapshot.latency,
      topEndpoints: snapshot.topEndpoints,
      recentErrors: snapshot.recentErrors,
      db,
      sockets: getSocketCount(),
      disk,
      meta: snapshot.totals,
      now: Date.now(),
    });
  } catch (error: any) {
    console.error('[MONITORING] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
