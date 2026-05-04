import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) return errorResponse('eventId is required', 400);

      const registrations: any = await query(
        `SELECT er.id, er.name, er.email, er.phoneNumber, er.gender, er.tshirtSize, er.bibName,
                er.paymentStatus, er.grossAmount, er.orderId, er.paidAt, er.createdAt,
                c.id as categoryId, c.name as categoryName
         FROM EventRegistration er
         JOIN Category c ON er.categoryId = c.id
         WHERE er.eventId = ? AND er.paymentStatus IN ('settlement', 'pending')
         ORDER BY (CASE WHEN er.paymentStatus = 'settlement' THEN 1 ELSE 2 END), er.createdAt DESC`,
        [eventId]
      );

      const participants = registrations.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phoneNumber: r.phoneNumber,
        gender: r.gender,
        tshirtSize: r.tshirtSize,
        bibName: r.bibName,
        category: { id: r.categoryId, name: r.categoryName },
        paymentStatus: r.paymentStatus,
        grossAmount: r.grossAmount,
        orderId: r.orderId,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
      }));

      return successResponse({ participants, total: participants.length });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[REGISTRATIONS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
