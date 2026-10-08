import { query, exec } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import { createBackup } from '../src/lib/backup';
import { runSettlementSideEffects } from '../src/lib/settlement';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'payment_admin', 'event_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { orderId } = body;

    if (!orderId) return errorResponse('Order ID is required', 400);

    // Compare-and-set: only the path that flips the status runs side effects,
    // so a webhook/poll arriving at the same time can't double anything
    const flipped = await exec(
      "UPDATE EventRegistration SET paymentStatus = 'settlement', paidAt = NOW(), updatedAt = NOW() WHERE orderId = ? AND paymentStatus != 'settlement'",
      [orderId]
    );
    if (flipped === 0) {
      const current: any = await query('SELECT paymentStatus FROM EventRegistration WHERE orderId = ? LIMIT 1', [orderId]);
      if (current.length === 0) return errorResponse('Registration not found', 404);
      return successResponse({ message: 'Pembayaran sudah diselesaikan sebelumnya (oleh webhook/polling)' });
    }

    // Fetch details for the activity log
    const regRes: any = await query(
      `SELECT er.*, e.name as eventName, e.eventDate, c.name as categoryName
       FROM EventRegistration er
       JOIN Event e ON er.eventId = e.id
       JOIN Category c ON er.categoryId = c.id
       WHERE er.orderId = ?`,
      [orderId]
    );

    // Emails are 2 SMTP roundtrips per participant — background them so the
    // admin isn't staring at a spinner for bulk orders
    runSettlementSideEffects(orderId)
      .then(() => createBackup('manual_settle'))
      .catch((e) => console.error('[ADMIN-SETTLE] Background settlement failed:', e));

    // Log the manual action
    const eventId = regRes[0]?.eventId || null;
    await logActivity('payment.manual_settle', `Penyelesaian pembayaran manual untuk ${orderId}`, 'admin', eventId, { orderId });

    return successResponse({ message: 'Pembayaran berhasil diselesaikan secara manual' });
  } catch (error: any) {
    console.error('[ADMIN-SETTLE] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
