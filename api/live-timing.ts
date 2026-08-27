import { query } from '../src/lib/db.js';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils.js';

const CACHE_TTL_MS = 3000;
const memoryCache = new Map<string, { data: string; timestamp: number }>();

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    const eventId = event.queryStringParameters?.eventId;
    if (!eventId) return errorResponse('eventId is required', 400);

    const now = Date.now();
    const cached = memoryCache.get(eventId);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=3',
          'X-Cache': 'HIT'
        },
        body: cached.data
      };
    }

    const registrations: any[] = await query(`
      SELECT er.id, er.name, er.gender, er.bibNumber as bib, er.bibName, c.name as category, rs.epc, er.customData 
      FROM RunnerStatus rs
      JOIN EventRegistration er ON rs.eventId = er.eventId
      JOIN Category c ON er.categoryId = c.id
      WHERE rs.eventId = ? AND rs.bib = er.bibNumber AND er.paymentStatus = 'settlement'
    `, [eventId]);

    const records: any[] = await query(`
      SELECT rr.id, rr.epc, rr.time, c.identitas, c.order, c.name as checkpointName
      FROM RunnerRecord rr
      JOIN Checkpoint c ON rr.checkpointId = c.id
      WHERE rr.eventId = ?
      ORDER BY rr.time ASC
    `, [eventId]);

    const responseBody = JSON.stringify({ registrations, records });
    memoryCache.set(eventId, { data: responseBody, timestamp: now });

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=3',
        'X-Cache': 'MISS'
      },
      body: responseBody
    };
  } catch(e: any) {
    console.error('[LIVE TIMING] Error:', e);
    return errorResponse(e.message || 'Internal server error');
  }
}
