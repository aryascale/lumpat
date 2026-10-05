import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import { requireRole } from '../src/lib/jwt';

// Change a participant's category (e.g. 21k -> 10k). The QR scan endpoint
// (/api/verify-participant) reads categoryId live, so the scan result follows
// automatically. grossAmount is reset to the new category price.
export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'payment_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { orderId, categoryId } = body;
    if (!orderId || !categoryId) return errorResponse('orderId and categoryId are required', 400);

    // Category must belong to the registration's event.
    const cat: any = await query(
      `SELECT c.* FROM Category c
       JOIN EventRegistration er ON er.eventId = c.eventId
       WHERE er.orderId = ? AND c.id = ? LIMIT 1`,
      [orderId, categoryId]
    );
    if (cat.length === 0) return errorResponse('Kategori tidak ditemukan untuk event pendaftaran ini', 404);

    const result: any = await query(
      `UPDATE EventRegistration SET categoryId = ?, grossAmount = ?, updatedAt = NOW() WHERE orderId = ?`,
      [categoryId, cat[0].price || 0, orderId]
    );
    if (result.affectedRows === 0) return errorResponse('Registration not found', 404);

    await logActivity(
      'payment.update_category',
      `Ubah kategori peserta ${orderId} menjadi ${cat[0].name} (Rp ${cat[0].price || 0})`,
      'admin',
      cat[0].eventId,
      { orderId, categoryId }
    );

    return successResponse({ message: `Kategori diperbarui menjadi ${cat[0].name}` });
  } catch (error: any) {
    console.error('[ADMIN-UPDATE-CATEGORY] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
