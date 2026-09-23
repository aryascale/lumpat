import crypto from 'crypto';
import { query } from './db';

export function calculateDiscount(
  discountType: string,
  value: number,
  maxDiscount: number | null | undefined,
  total: number,
): number {
  if (total <= 0 || !value || value <= 0) return 0;
  let d = discountType === 'percent' ? Math.floor((total * value) / 100) : value;
  if (discountType === 'percent' && maxDiscount && maxDiscount > 0) d = Math.min(d, maxDiscount);
  return Math.max(0, Math.min(d, total));
}

export type VoucherCheck =
  | { valid: true; voucher: any; discountAmount: number; finalAmount: number }
  | { valid: false; reason: string };

// ponytail: validity window compared in JS from DATETIME values; day-granularity is fine,
// move checks into SQL with NOW() if minute-precision across server timezones ever matters
export async function validateVoucher(code: string, eventId: string, total: number, email?: string): Promise<VoucherCheck> {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return { valid: false, reason: 'Kode voucher kosong' };

  const rows: any = await query('SELECT * FROM Voucher WHERE code = ? LIMIT 1', [norm]);
  const v = rows[0];
  if (!v) return { valid: false, reason: 'Kode voucher tidak ditemukan' };
  if (!v.isActive) return { valid: false, reason: 'Voucher tidak aktif' };
  if (v.validFrom && new Date(v.validFrom) > new Date()) return { valid: false, reason: 'Voucher belum berlaku' };
  if (v.validUntil && new Date(v.validUntil) < new Date()) return { valid: false, reason: 'Voucher sudah kedaluwarsa' };
  if (v.eventId && v.eventId !== eventId) return { valid: false, reason: 'Voucher tidak berlaku untuk event ini' };
  if (v.quota > 0 && v.usedCount >= v.quota) return { valid: false, reason: 'Kuota voucher sudah habis' };
  if (total <= 0) return { valid: false, reason: 'Event ini gratis, voucher tidak diperlukan' };
  if (email) {
    const used: any = await query(
      'SELECT 1 FROM VoucherRedemption WHERE voucherId = ? AND email = ? LIMIT 1',
      [v.id, email],
    );
    if (used.length > 0) return { valid: false, reason: 'Kamu sudah pernah memakai voucher ini' };
  }

  const discountAmount = calculateDiscount(v.discountType, v.value, v.maxDiscount, total);
  return { valid: true, voucher: v, discountAmount, finalAmount: total - discountAmount };
}

// Called from every code path that sets paymentStatus = 'settlement'.
// Idempotent: unique orderId makes the INSERT fail with ER_DUP_ENTRY on repeats.
export async function settleVoucherRedemption(orderId: string): Promise<void> {
  const regs: any = await query(
    'SELECT voucherCode, email, name, eventId, discountAmount FROM EventRegistration WHERE orderId = ? LIMIT 1',
    [orderId],
  );
  const reg = regs[0];
  if (!reg?.voucherCode) return;

  const vouchers: any = await query('SELECT id FROM Voucher WHERE code = ? LIMIT 1', [reg.voucherCode]);
  if (!vouchers[0]) return;

  try {
    await query(
      'INSERT INTO VoucherRedemption (id, voucherId, orderId, email, name, eventId, discountAmount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [crypto.randomUUID(), vouchers[0].id, orderId, reg.email, reg.name, reg.eventId, reg.discountAmount || 0],
    );
    await query('UPDATE Voucher SET usedCount = usedCount + 1 WHERE id = ?', [vouchers[0].id]);
  } catch (e: any) {
    if (e.code !== 'ER_DUP_ENTRY') throw e; // already settled
  }
}
