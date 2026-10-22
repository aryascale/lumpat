import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    let eventId = event.queryStringParameters?.eventId;
    if (!eventId && event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
      return errorResponse('eventId is required', 400);
    }

    if (event.httpMethod === 'GET') {
      const statuses: any = await query(
        'SELECT id, eventId, epc, bib, isDQ, dqReason, isDNS, isDNF, isHidden, createdAt FROM RunnerStatus WHERE eventId = ?',
        [eventId]
      );
      return successResponse(statuses);
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = parseBody(event);
      if (!body) return errorResponse('Missing request body', 400);

      const { epc, bib, isDQ = false, dqReason = null, isDNS = false, isDNF = false, isHidden = false } = body;
      eventId = eventId || body.eventId;

      if (!eventId) return errorResponse('eventId is required', 400);
      if (!epc) return errorResponse('epc is required', 400);

      const existing: any = await query(
        'SELECT id FROM RunnerStatus WHERE eventId = ? AND epc = ? LIMIT 1',
        [eventId, epc]
      );

      const safeDqReason = isDQ ? (dqReason ? String(dqReason).trim() : null) : null;

      if (existing.length > 0) {
        await query(
          'UPDATE RunnerStatus SET bib = ?, isDQ = ?, dqReason = ?, isDNS = ?, isDNF = ?, isHidden = ?, updatedAt = NOW() WHERE eventId = ? AND epc = ?',
          [bib || null, isDQ, safeDqReason, isDNS, isDNF, isHidden, eventId, epc]
        );
      } else {
        const id = crypto.randomUUID();
        await query(
          'INSERT INTO RunnerStatus (id, eventId, epc, bib, isDQ, dqReason, isDNS, isDNF, isHidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
          [id, eventId, epc, bib || null, isDQ, safeDqReason, isDNS, isDNF, isHidden]
        );
      }

      const updated: any = await query(
        'SELECT id, eventId, epc, bib, isDQ, dqReason, isDNS, isDNF, isHidden, createdAt FROM RunnerStatus WHERE eventId = ? AND epc = ? LIMIT 1',
        [eventId, epc]
      );

      return successResponse(updated[0]);
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    if (error?.message?.includes("Unknown column 'dqReason'")) {
      console.warn('[RUNNER_STATUS] Column dqReason missing in DB, running auto-migration and retrying...');
      try {
        await query("ALTER TABLE RunnerStatus ADD COLUMN dqReason TEXT NULL AFTER isDQ");
        // Retry the handler once after column is created
        return await handler({ ...event, _retried: true });
      } catch (migrationErr: any) {
        if (!migrationErr?.message?.includes('Duplicate column name')) {
          console.error('[RUNNER_STATUS] Auto-migration failed:', migrationErr);
        } else {
          return await handler({ ...event, _retried: true });
        }
      }
    }
    console.error('[RUNNER_STATUS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
