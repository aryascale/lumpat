import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';
import { logActivity } from '../src/lib/activity-logger';

function parseDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const auth = requireRole(event, ['super_admin', 'payment_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    if (event.httpMethod === 'GET') {
      const eventId = event.queryStringParameters?.eventId;
      const vouchers: any = await query(
        `SELECT v.*, e.name as eventName FROM Voucher v LEFT JOIN Event e ON v.eventId = e.id
         ${eventId ? 'WHERE v.eventId = ?' : ''} ORDER BY v.createdAt DESC`,
        eventId ? [eventId] : []
      );
      return successResponse({ vouchers });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
      const code = String(body.code || '').trim().toUpperCase();
      const discountType = body.discountType;
      const value = Number(body.value);
      if (!/^[A-Z0-9-]{3,32}$/.test(code)) return errorResponse('Kode voucher 3-32 karakter, hanya huruf/angka/tanda minus', 400);
      if (!['nominal', 'percent'].includes(discountType)) return errorResponse('discountType harus nominal atau percent', 400);
      if (!Number.isInteger(value) || value <= 0) return errorResponse('value harus angka bulat positif', 400);
      if (discountType === 'percent' && value > 100) return errorResponse('percent maksimal 100', 400);
      const maxDiscount = body.maxDiscount != null ? Number(body.maxDiscount) : null;
      if (maxDiscount != null && (!Number.isInteger(maxDiscount) || maxDiscount <= 0)) return errorResponse('maxDiscount harus angka bulat positif', 400);
      const quota = Number(body.quota ?? 0);
      if (!Number.isInteger(quota) || quota < 0) return errorResponse('quota harus angka bulat >= 0 (0 = unlimited)', 400);
      if (body.eventId) {
        const ev: any = await query('SELECT id FROM Event WHERE id = ? LIMIT 1', [body.eventId]);
        if (ev.length === 0) return errorResponse('Event tidak ditemukan', 404);
      }
      const validFrom = parseDate(body.validFrom);
      const validUntil = parseDate(body.validUntil);
      if (body.validFrom && !validFrom) return errorResponse('validFrom tidak valid', 400);
      if (body.validUntil && !validUntil) return errorResponse('validUntil tidak valid', 400);

      try {
        const res: any = await query(
          `INSERT INTO Voucher (id, code, discountType, value, maxDiscount, quota, eventId, validFrom, validUntil, isActive, createdAt, updatedAt)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [code, discountType, value, maxDiscount, quota, body.eventId || null, validFrom, validUntil, body.isActive !== false]
        );
        await logActivity('voucher.created', `Voucher ${code} dibuat`, 'admin', body.eventId || null, { code, discountType, value, quota });
        return successResponse({ ok: true });
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') return errorResponse('Kode voucher sudah digunakan', 400);
        throw e;
      }
    }

    if (event.httpMethod === 'PATCH') {
      if (!body.id) return errorResponse('id is required', 400);
      const existing: any = await query('SELECT discountType, value FROM Voucher WHERE id = ? LIMIT 1', [body.id]);
      if (existing.length === 0) return errorResponse('Voucher tidak ditemukan', 404);
      const sets: string[] = [];
      const params: any[] = [];
      const MAX_INT = 2_000_000_000;
      const num = (v: any, name: string, min: number) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < min) throw new Error(`${name} harus angka bulat >= ${min}`);
        if (n > MAX_INT) throw new Error(`${name} maksimal ${MAX_INT}`);
        return n;
      };
      try {
        if (body.value !== undefined) {
          if (existing[0].discountType === 'percent' && Number(body.value) > 100) throw new Error('percent maksimal 100');
          sets.push('value = ?'); params.push(num(body.value, 'value', 1));
        }
        if (body.maxDiscount !== undefined) { sets.push('maxDiscount = ?'); params.push(body.maxDiscount == null ? null : num(body.maxDiscount, 'maxDiscount', 1)); }
        if (body.quota !== undefined) { sets.push('quota = ?'); params.push(num(body.quota, 'quota', 0)); }
        if (body.eventId !== undefined) {
          if (body.eventId) {
            const ev: any = await query('SELECT id FROM Event WHERE id = ? LIMIT 1', [body.eventId]);
            if (ev.length === 0) return errorResponse('Event tidak ditemukan', 404);
          }
          sets.push('eventId = ?'); params.push(body.eventId || null);
        }
        if (body.validFrom !== undefined) { sets.push('validFrom = ?'); params.push(parseDate(body.validFrom)); }
        if (body.validUntil !== undefined) { sets.push('validUntil = ?'); params.push(parseDate(body.validUntil)); }
        if (body.isActive !== undefined) { sets.push('isActive = ?'); params.push(!!body.isActive); }
      } catch (e: any) {
        return errorResponse(e.message, 400);
      }
      if (sets.length === 0) return errorResponse('Tidak ada field untuk diupdate', 400);
      sets.push('updatedAt = NOW()');
      params.push(body.id);
      await query(`UPDATE Voucher SET ${sets.join(', ')} WHERE id = ?`, params);
      await logActivity('voucher.updated', `Voucher diperbarui`, 'admin', null, { id: body.id, fields: sets.map(s => s.split(' ')[0]) });
      return successResponse({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return errorResponse('id is required', 400);
      const rows: any = await query('SELECT code, usedCount FROM Voucher WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) return errorResponse('Voucher tidak ditemukan', 404);
      if (rows[0].usedCount > 0) return errorResponse('Voucher sudah pernah dipakai, nonaktifkan saja', 400);
      await query('DELETE FROM Voucher WHERE id = ?', [id]);
      await logActivity('voucher.deleted', `Voucher ${rows[0].code} dihapus`, 'admin', null, { id });
      return successResponse({ ok: true });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[ADMIN-VOUCHERS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
