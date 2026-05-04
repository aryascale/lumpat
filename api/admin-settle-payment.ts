import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { orderId } = body;

    if (!orderId) return errorResponse('Order ID is required', 400);

    // Update status to settlement manually
    const result: any = await query(
      `UPDATE EventRegistration SET paymentStatus = 'settlement', paidAt = NOW(), updatedAt = NOW() WHERE orderId = ?`,
      [orderId]
    );

    if (result.affectedRows === 0) {
      return errorResponse('Registration not found', 404);
    }

    // Log the manual action
    await logActivity('payment.manual_settle', `Penyelesaian pembayaran manual untuk ${orderId}`, 'admin', null, { orderId });

    return successResponse({ message: 'Pembayaran berhasil diselesaikan secara manual' });
  } catch (error: any) {
    console.error('[ADMIN-SETTLE] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
