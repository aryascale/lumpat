import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const regId = event.queryStringParameters?.id;
    if (!regId) return errorResponse('Registration ID is required', 400);

    const results: any = await query(
      `SELECT er.*, e.name as eventName, e.eventDate, e.location, c.name as categoryName
       FROM EventRegistration er
       JOIN Event e ON er.eventId = e.id
       JOIN Category c ON er.categoryId = c.id
       WHERE er.id = ? LIMIT 1`,
      [regId]
    );

    if (results.length === 0) {
      return successResponse({
        verified: false,
        message: 'Peserta tidak ditemukan',
      });
    }

    const reg = results[0];
    const isConfirmed = reg.paymentStatus === 'settlement';

    return successResponse({
      verified: isConfirmed,
      message: isConfirmed ? 'Peserta terdaftar dan sudah bayar' : `Status: ${reg.paymentStatus}`,
      participant: {
        id: reg.id,
        name: reg.name,
        email: reg.email,
        phoneNumber: reg.phoneNumber,
        gender: reg.gender,
        tshirtSize: reg.tshirtSize,
        bibName: reg.bibName,
        bloodType: reg.bloodType,
        dateOfBirth: reg.dateOfBirth,
        categoryName: reg.categoryName,
        eventName: reg.eventName,
        eventDate: reg.eventDate,
        location: reg.location,
        orderId: reg.orderId,
        paymentStatus: reg.paymentStatus,
        paidAt: reg.paidAt,
        customData: reg.customData ? (typeof reg.customData === 'string' ? JSON.parse(reg.customData) : reg.customData) : null,
      },
    });
  } catch (error: any) {
    console.error('[VERIFY-PARTICIPANT] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
