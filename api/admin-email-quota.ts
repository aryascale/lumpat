import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';
import { getEmailQuota } from '../src/lib/email-quota';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = requireRole(event, ['super_admin', 'event_admin', 'payment_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    return successResponse(await getEmailQuota());
  } catch (error: any) {
    console.error('[ADMIN-EMAIL-QUOTA] Error:', error);
    return errorResponse('Gagal memuat kuota email', 500);
  }
}
