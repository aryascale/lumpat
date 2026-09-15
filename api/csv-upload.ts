import { uploadCsvFile } from '../src/lib/fileStorage';
import { query } from '../src/lib/db';
import { parseCsv } from '../src/lib/csvParse';

interface APIEvent {
  httpMethod: string;
  headers: { [key: string]: string };
  body: string | null;
  isBase64Encoded: boolean;
}

interface APIResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_KINDS = ['master', 'start', 'finish', 'checkpoint'];

const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function colIdx(headers: string[], aliases: string[]): number {
  const hs = headers.map(norm);
  for (const a of aliases) {
    const i = hs.indexOf(norm(a));
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = hs.findIndex((h) => h.includes(norm(a)));
    if (i >= 0) return i;
  }
  return -1;
}

// Master CSV holds the assigned BIB numbers, but every consumer
// (payments export, master template export, live-timing join, RPC bib
// lookup) reads EventRegistration.bibNumber — which nothing wrote.
// Sync it here on master upload: match rows to registrations
// (name+category, then name-only, same strategy as the client matcher)
// and fill bibNumber where still empty.
async function syncBibNumbers(eventId: string, csvText: string): Promise<number> {
  const grid = parseCsv(csvText);
  if (!grid || grid.length < 2) return 0;

  const headers = (grid[0] || []).map(String);
  const bibIdx = colIdx(headers, ['bib', 'no bib', 'bib number', 'race bib', 'nomor bib', 'no. bib']);
  const nameIdx = colIdx(headers, ['nama lengkap', 'full name', 'name', 'nama', 'participant name']);
  const catIdx = colIdx(headers, ['kategori', 'category', 'kelas', 'class']);
  if (bibIdx < 0 || nameIdx < 0) return 0;

  const rows = grid.slice(1)
    .map((r) => ({
      bib: String(r[bibIdx] ?? '').trim(),
      name: String(r[nameIdx] ?? '').trim().toLowerCase(),
      category: catIdx >= 0 ? String(r[catIdx] ?? '').trim().toLowerCase() : '',
    }))
    .filter((r) => r.bib && r.name);

  if (rows.length === 0) return 0;

  const regs: any = await query(
    `SELECT er.id, er.name, er.bibNumber, c.name AS categoryName
     FROM EventRegistration er
     JOIN Category c ON er.categoryId = c.id
     WHERE er.eventId = ?`,
    [eventId]
  );

  let synced = 0;
  for (const reg of regs) {
    if (reg.bibNumber) continue; // never overwrite existing assignments
    const name = String(reg.name || '').trim().toLowerCase();
    if (!name) continue;
    const cat = String(reg.categoryName || '').trim().toLowerCase();
    const match =
      rows.find((r) => r.name === name && cat && r.category === cat) ||
      rows.find((r) => r.name === name);
    if (!match) continue;
    await query(
      `UPDATE EventRegistration SET bibNumber = ?, updatedAt = NOW() WHERE id = ?`,
      [match.bib, reg.id]
    );
    synced++;
  }
  // ponytail: one UPDATE per registration — fine for hundreds of rows,
  // batch into a CASE statement if events reach thousands
  return synced;
}

export default async function handler(event: APIEvent): Promise<APIResponse> {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    if (!event.body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body as string, 'base64').toString())
      : JSON.parse(event.body);

    const { kind, filename, rows, eventId, content } = body;
    const effectiveEventId = eventId || 'default';

    if (!kind || !VALID_KINDS.includes(kind)) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `kind harus salah satu dari: ${VALID_KINDS.join(', ')}` }) };
    }

    const result = await uploadCsvFile(effectiveEventId, kind, content || '', filename, rows || 0);

    // Best-effort BIB sync — upload must never fail because of it
    let bibSynced = 0;
    if (kind === 'master') {
      try {
        bibSynced = await syncBibNumbers(effectiveEventId, content || '');
      } catch (e) {
        console.error('[CSV-UPLOAD] bib sync failed:', e);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        kind,
        filename: result.filename,
        url: result.url,
        downloadUrl: result.url,
        rows: result.rows,
        updatedAt: result.updatedAt,
        path: result.path,
        bibSynced,
      }),
    };
  } catch (error: any) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Failed to upload CSV' }) };
  }
}
