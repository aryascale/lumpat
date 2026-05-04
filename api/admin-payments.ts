import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const eventId = event.queryStringParameters?.eventId;
    const status = event.queryStringParameters?.status;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (eventId) { where += ' AND er.eventId = ?'; params.push(eventId); }
    if (status) { where += ' AND er.paymentStatus = ?'; params.push(status); }

    const registrations: any = await query(
      `SELECT er.*, c.name as categoryName, e.name as eventName
       FROM EventRegistration er
       JOIN Category c ON er.categoryId = c.id
       JOIN Event e ON er.eventId = e.id
       ${where}
       ORDER BY er.createdAt DESC`,
      params
    );

    const summary: any = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN paymentStatus = 'settlement' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN paymentStatus = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN paymentStatus IN ('cancel', 'expire') THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN paymentStatus = 'settlement' THEN grossAmount ELSE 0 END) as totalRevenue
       FROM EventRegistration ${eventId ? 'WHERE eventId = ?' : ''}`,
      eventId ? [eventId] : []
    );

    return successResponse({
      registrations: registrations.map((r: any) => ({
        id: r.id,
        orderId: r.orderId,
        eventName: r.eventName,
        eventId: r.eventId,
        categoryName: r.categoryName,
        name: r.name,
        email: r.email,
        phoneNumber: r.phoneNumber,
        gender: r.gender,
        tshirtSize: r.tshirtSize,
        bibName: r.bibName,
        grossAmount: r.grossAmount,
        paymentStatus: r.paymentStatus,
        paymentMethod: r.paymentMethod,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
        dateOfBirth: r.dateOfBirth,
      })),
      summary: summary[0] || { total: 0, paid: 0, pending: 0, failed: 0, totalRevenue: 0 },
    });
  } catch (error: any) {
    console.error('[ADMIN-PAYMENTS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
