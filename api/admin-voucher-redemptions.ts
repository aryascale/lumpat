import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'payment_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const voucherId = event.queryStringParameters?.voucherId;
    if (!voucherId) return errorResponse('voucherId is required', 400);
    const redemptions: any = await query(
      'SELECT * FROM VoucherRedemption WHERE voucherId = ? ORDER BY createdAt DESC',
      [voucherId]
    );
    return successResponse({ redemptions });
  } catch (error: any) {
    console.error('[ADMIN-VOUCHER-REDEMPTIONS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
