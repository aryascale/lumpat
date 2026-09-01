import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  const auth = requireRole(event, ['super_admin', 'event_admin', 'scan_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  const { httpMethod, queryStringParameters, body } = event;

  if (httpMethod === 'GET') {
    try {
      const { id, eventId, status } = queryStringParameters || {};

      // Single ticket detail
      if (id) {
        const rows: any = await query(
          `SELECT st.*, e.name AS eventName
           FROM SupportTicket st LEFT JOIN Event e ON st.eventId = e.id
           WHERE st.id = ? LIMIT 1`,
          [id]
        );
        if (rows.length === 0) return errorResponse('Ticket not found', 404);
        const { eventName, ...ticket } = rows[0];
        ticket.event = eventName ? { name: eventName } : null;
        return successResponse({ ticket });
      }

      // List with filters
      const where: string[] = [];
      const params: any[] = [];
      if (eventId) { where.push('st.eventId = ?'); params.push(eventId); }
      if (status) { where.push('st.status = ?'); params.push(status); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const tickets: any = await query(
        `SELECT st.*, e.name AS eventName
         FROM SupportTicket st LEFT JOIN Event e ON st.eventId = e.id
         ${whereSql} ORDER BY st.createdAt DESC`,
        params
      );
      return successResponse({
        tickets: tickets.map(({ eventName, ...t }: any) => ({ ...t, event: eventName ? { name: eventName } : null })),
      });
    } catch (error: any) {
      console.error('[ADMIN-TICKETS] Error fetching tickets:', error);
      return errorResponse('Failed to fetch tickets');
    }
  }

  if (httpMethod === 'PATCH') {
    try {
      const { id } = queryStringParameters || {};
      if (!id) return errorResponse('Ticket ID required', 400);

      const data = typeof body === 'string' ? JSON.parse(body) : body;
      const { status, resolutionNotes, resolvedBy } = data;

      const sets: string[] = [];
      const params: any[] = [];
      if (status) { sets.push('status = ?'); params.push(status); }
      if (resolutionNotes !== undefined) { sets.push('resolutionNotes = ?'); params.push(resolutionNotes); }
      if (resolvedBy) { sets.push('resolvedBy = ?'); params.push(resolvedBy); }
      if (status === 'resolved') { sets.push('resolvedAt = NOW()'); sets.push('resolvedBy = ?'); params.push(resolvedBy || auth.user?.email || null); }
      if (sets.length === 0) return errorResponse('Nothing to update', 400);
      sets.push('updatedAt = NOW()');
      params.push(id);

      await query(`UPDATE SupportTicket SET ${sets.join(', ')} WHERE id = ?`, params);

      const rows: any = await query(
        `SELECT st.*, e.name AS eventName
         FROM SupportTicket st LEFT JOIN Event e ON st.eventId = e.id
         WHERE st.id = ? LIMIT 1`,
        [id]
      );
      const { eventName, ...ticket } = rows[0];
      ticket.event = eventName ? { name: eventName } : null;
      return successResponse({ ticket });
    } catch (error: any) {
      console.error('[ADMIN-TICKETS] Error updating ticket:', error);
      return errorResponse('Failed to update ticket');
    }
  }

  return errorResponse('Method not allowed', 405);
}
