import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { getRequestUser } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  // Public endpoint (emailed QR targets /verify/:id for anonymous scanners),
  // but PII is only returned to authenticated admin roles.
  const authUser = getRequestUser(event);
  const isStaff = !!authUser && authUser.role !== 'user';

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

    let mappedCustomData: Record<string, any> | null = null;
    if (reg.customData) {
      const fieldDefs: any = await query('SELECT id, label FROM RegistrationField');
      const labelMap = new Map<string, string>(fieldDefs.map((f: any) => [f.id.toLowerCase(), f.label]));
      
      const parsed = typeof reg.customData === 'string' ? JSON.parse(reg.customData) : reg.customData;
      mappedCustomData = {};
      for (const [k, v] of Object.entries(parsed)) {
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(k);
        const label = labelMap.get(k.toLowerCase());
        if (!label && isUUID) continue; // Skip deleted fields
        const displayLabel = (label || k.replace(/([A-Z])/g, ' $1').trim()) as string;
        mappedCustomData[displayLabel] = v;
      }
    }

    return successResponse({
      verified: isConfirmed,
      message: isConfirmed ? 'Peserta terdaftar dan sudah bayar' : `Status: ${reg.paymentStatus}`,
      participant: {
        id: reg.id,
        name: reg.name,
        gender: isStaff ? reg.gender : undefined,
        tshirtSize: isStaff ? reg.tshirtSize : undefined,
        bibName: reg.bibName,
        bibNumber: reg.bibNumber,
        categoryName: reg.categoryName,
        eventName: reg.eventName,
        eventDate: reg.eventDate,
        orderId: reg.orderId,
        paymentStatus: reg.paymentStatus,
        paidAt: reg.paidAt,
        ...(isStaff ? {
          email: reg.email,
          phoneNumber: reg.phoneNumber,
          bloodType: reg.bloodType,
          dateOfBirth: reg.dateOfBirth,
          location: reg.location,
          customData: mappedCustomData,
        } : {}),
      },
    });
  } catch (error: any) {
    console.error('[VERIFY-PARTICIPANT] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
