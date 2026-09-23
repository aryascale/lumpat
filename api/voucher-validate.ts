import { validateVoucher } from '../src/lib/voucher';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { code, eventId, totalAmount, email } = parseBody(event);
    if (!code || !eventId) return errorResponse('code and eventId are required', 400);

    const check = await validateVoucher(String(code), eventId, Number(totalAmount) || 0, email);
    if (check.valid === false) return successResponse({ valid: false, reason: check.reason });

    return successResponse({
      valid: true,
      discountAmount: check.discountAmount,
      finalAmount: check.finalAmount,
      code: check.voucher.code,
    });
  } catch (error: any) {
    console.error('[VOUCHER-VALIDATE] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
