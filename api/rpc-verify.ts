import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';

// RPC station verification: resolves a scanned registration QR (/verify/<id>)
// or BIB number to its EventRegistration, reports payment status, and logs
// every scan so race-pack collection can be tracked.
export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'scan_admin', 'event_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const { id, bib, eventId } = event.queryStringParameters || {};
    if (!eventId) return errorResponse('eventId is required', 400);

    const lookup = String(id || bib || '');
    if (!lookup) return errorResponse('id or bib is required', 400);

    const rows: any = await query(
      `SELECT er.id, er.name, er.bibNumber, er.bibName, er.tshirtSize, er.gender, er.paymentStatus, er.paidAt, er.orderId,
              c.name AS categoryName
       FROM EventRegistration er
       JOIN Category c ON er.categoryId = c.id
       WHERE er.eventId = ? AND ${id ? 'er.id = ?' : 'er.bibNumber = ?'} LIMIT 1`,
      [eventId, lookup]
    );

    let result = 'not_found';
    let participant: any = null;
    let previousScan: any = null;

    if (rows.length > 0) {
      participant = rows[0];
      result = participant.paymentStatus === 'settlement' ? 'valid' : 'unpaid';
      const prev: any = await query(
        'SELECT createdAt, scannedBy, result FROM ScanLog WHERE registrationId = ? ORDER BY createdAt DESC LIMIT 1',
        [participant.id]
      );
      previousScan = prev[0] || null;
    }

    await query(
      `INSERT INTO ScanLog (id, registrationId, eventId, bibNumber, lookup, scannedBy, result, source)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'rpc')`,
      [participant?.id || null, eventId, participant?.bibNumber || null, lookup, auth.user?.email || null, result]
    );

    return successResponse({
      result,
      participant: participant
        ? {
            name: participant.name,
            bibNumber: participant.bibNumber,
            bibName: participant.bibName,
            category: participant.categoryName,
            gender: participant.gender,
            tshirtSize: participant.tshirtSize,
            paymentStatus: participant.paymentStatus,
            orderId: participant.orderId,
          }
        : null,
      previousScan,
    });
  } catch (error: any) {
    console.error('[RPC-VERIFY] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
