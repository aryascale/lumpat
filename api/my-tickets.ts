import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

// Public e-ticket lookup: name + email of the registration form.
// Returns only paid (settlement) registrations, display fields only.
export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const email = (event.queryStringParameters?.email || '').trim().toLowerCase();
    const name = (event.queryStringParameters?.name || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse('Email tidak valid', 400);

    const rows: any = await query(
      `SELECT er.id, er.name, er.bibNumber, er.bibName, er.tshirtSize, er.orderId, er.paidAt,
              e.name AS eventName, e.eventDate, e.location, c.name AS categoryName
       FROM EventRegistration er
       JOIN Event e ON er.eventId = e.id
       JOIN Category c ON er.categoryId = c.id
       WHERE LOWER(er.email) = ? AND er.paymentStatus = 'settlement'
         ${name ? 'AND LOWER(er.name) LIKE ?' : ''}
       ORDER BY er.paidAt DESC`,
      name ? [email, `%${name.toLowerCase()}%`] : [email]
    );
    return successResponse({ tickets: rows });
  } catch (error: any) {
    console.error('[MY-TICKETS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
