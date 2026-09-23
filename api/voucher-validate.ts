import { validateVoucher } from '../src/lib/voucher';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

// ponytail: in-memory sliding window — per server instance only; move to Redis if multi-instance
const attempts = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 20;
const WINDOW_MS = 60_000;

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || event.headers?.['client-ip'] || 'unknown';
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= LIMIT) {
    return errorResponse('Terlalu banyak percobaan, coba lagi dalam 1 menit', 429);
  }
  if (!entry || entry.resetAt <= now) {
    // Opportunistic cleanup of stale entries
    if (attempts.size > 1000) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    }
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }

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
    return errorResponse('Terjadi kesalahan, silakan coba lagi', 500);
  }
}
