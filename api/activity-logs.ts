import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const eventId = event.queryStringParameters?.eventId;
    const action = event.queryStringParameters?.action;
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (eventId && eventId !== 'all') { 
      where += ' AND (eventId = ? OR eventId IS NULL)'; 
      params.push(eventId); 
    }
    if (action) { where += ' AND action LIKE ?'; params.push(`${action}%`); }

    const logs: any = await query(
      `SELECT * FROM ActivityLog ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countResult: any = await query(
      `SELECT COUNT(*) as total FROM ActivityLog ${where}`,
      params
    );

    return successResponse({
      logs: logs.map((l: any) => ({
        id: l.id,
        eventId: l.eventId,
        action: l.action,
        detail: l.detail,
        actor: l.actor,
        metadata: l.metadata ? (typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata) : null,
        createdAt: l.createdAt,
      })),
      total: countResult[0]?.total || 0,
    });
  } catch (error: any) {
    console.error('[ACTIVITY-LOGS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
