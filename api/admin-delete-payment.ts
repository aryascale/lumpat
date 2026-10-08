import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import { createBackup } from '../src/lib/backup';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'payment_admin', 'event_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { orderId, eventId, hard, all } = body;

    // Hard-wipe every registration of an event (e.g. test data before launch)
    if (all && eventId) {
      const countRes: any = await query('SELECT COUNT(*) as c FROM EventRegistration WHERE eventId = ?', [eventId]);
      const total = Number(countRes[0]?.c || 0);
      if (total === 0) return successResponse({ message: 'Tidak ada registrasi di event ini', deleted: 0 });
      await query('DELETE FROM EventRegistration WHERE eventId = ?', [eventId]);
      await logActivity('payment.hard_delete_all', `Hard delete ${total} registrasi di event ${eventId}`, 'admin', eventId, { eventId, count: total });
      try { await createBackup('hard_delete_all'); } catch (e) { console.error('[BACKUP] Failed:', e); }
      return successResponse({ message: `${total} registrasi dihapus permanen`, deleted: total });
    }

    if (!orderId) return errorResponse('Order ID is required', 400);

    // Hard delete: remove the row(s) permanently
    if (hard) {
      const regRes: any = await query('SELECT eventId FROM EventRegistration WHERE orderId = ? LIMIT 1', [orderId]);
      if (!regRes.length) return errorResponse('Registration not found', 404);
      await query('DELETE FROM EventRegistration WHERE orderId = ?', [orderId]);
      await logActivity('payment.hard_delete', `Hard delete registrasi ${orderId}`, 'admin', regRes[0].eventId, { orderId });
      try { await createBackup('hard_delete'); } catch (e) { console.error('[BACKUP] Failed:', e); }
      return successResponse({ message: 'Registrasi dihapus permanen' });
    }

    // Update status to deleted manually by setting paymentStatus
    const result: any = await query(
      `UPDATE EventRegistration SET paymentStatus = 'deleted', updatedAt = NOW() WHERE orderId = ?`,
      [orderId]
    );

    if (result.affectedRows === 0) {
      return errorResponse('Registration not found', 404);
    }

    const regRes: any = await query(
      `SELECT eventId FROM EventRegistration WHERE orderId = ? LIMIT 1`,
      [orderId]
    );

    // Log the manual action
    const softEventId = regRes[0]?.eventId || null;
    await logActivity('payment.manual_delete', `Soft delete pembayaran untuk ${orderId}`, 'admin', softEventId, { orderId });

    try { await createBackup('manual_delete'); } catch (e) { console.error('[BACKUP] Failed:', e); }

    return successResponse({ message: 'Pembayaran berhasil dihapus (soft delete)' });
  } catch (error: any) {
    console.error('[ADMIN-DELETE] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
