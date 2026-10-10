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

// Voucher.categoryIds is a JSON column — the driver may hand it over as a raw
// string or an already-parsed array depending on adapter, so accept both.
// NULL/[] = no category restriction.
export function normalizeCategoryIds(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export type VoucherCheck =
  | { valid: true; voucher: any; discountAmount: number; finalAmount: number }
  | { valid: false; reason: string };

// Public surface never learns WHY a code failed — one generic reason for every failure.
const GENERIC_INVALID = 'Kode voucher tidak valid atau tidak dapat digunakan';

// ponytail: validity window compared in JS from DATETIME values; day-granularity is fine,
// move checks into SQL with NOW() if minute-precision across server timezones ever matters
export async function validateVoucher(code: string, eventId: string, total: number, email?: string, categoryId?: string | null): Promise<VoucherCheck> {
  const norm = String(code || '').trim().toUpperCase();
  const normEmail = email?.trim().toLowerCase();
  if (!norm) return { valid: false, reason: GENERIC_INVALID };

  const rows: any = await query('SELECT * FROM Voucher WHERE code = ? LIMIT 1', [norm]);
  const v = rows[0];
  if (!v) return { valid: false, reason: GENERIC_INVALID };
  if (!v.isActive) return { valid: false, reason: GENERIC_INVALID };
  if (v.validFrom && new Date(v.validFrom) > new Date()) return { valid: false, reason: GENERIC_INVALID };
  if (v.validUntil && new Date(v.validUntil) < new Date()) return { valid: false, reason: GENERIC_INVALID };
  if (v.eventId && v.eventId !== eventId) return { valid: false, reason: GENERIC_INVALID };
  // Scope failures speak up (admin's call): a user can act on "wrong category" /
  // "spend more", unlike quota/expiry which stay generic.
  const catIds = normalizeCategoryIds(v.categoryIds);
  if (catIds.length > 0 && (!categoryId || !catIds.includes(String(categoryId)))) {
    const names: any = await query(
      `SELECT name FROM Category WHERE id IN (${catIds.map(() => '?').join(',')}) ORDER BY name`,
      catIds,
    );
    const label = names.map((r: any) => r.name).join(', ');
    return { valid: false, reason: `Voucher hanya berlaku untuk kategori ${label || 'tertentu'}` };
  }
  if (v.quota > 0) {
    // Count in-flight pending orders too, so concurrent checkouts can't overshoot quota.
    // Rows later moving to expire/cancel/settlement drop out of this count automatically — no release logic needed.
    // ponytail: a payment settling in the microseconds between this count and the pending
    // insert can admit one extra redemption; accepted at this scale.
    const pending: any = await query(
      "SELECT COUNT(DISTINCT orderId) AS cnt FROM EventRegistration WHERE voucherCode = ? AND paymentStatus = 'pending'",
      [norm],
    );
    if (v.usedCount + Number(pending[0]?.cnt || 0) >= v.quota) return { valid: false, reason: GENERIC_INVALID };
  }
  if (total <= 0) return { valid: false, reason: GENERIC_INVALID };
  // Gross total (before discount, incl. bib extra) must clear the minimum.
  if (v.minPurchase && v.minPurchase > 0 && total < v.minPurchase) {
    return { valid: false, reason: `Minimum pembelian Rp ${Number(v.minPurchase).toLocaleString('id-ID')} untuk voucher ini` };
  }
  if (normEmail) {
    // Settled redemptions + pending orders, both case-insensitive (emails stored lowercased at settle).
    const used: any = await query(
      'SELECT 1 FROM VoucherRedemption WHERE voucherId = ? AND LOWER(email) = ? LIMIT 1',
      [v.id, normEmail],
    );
    if (used.length > 0) return { valid: false, reason: GENERIC_INVALID };
    const pendingUse: any = await query(
      "SELECT 1 FROM EventRegistration WHERE voucherCode = ? AND LOWER(email) = ? AND paymentStatus = 'pending' LIMIT 1",
      [norm, normEmail],
    );
    if (pendingUse.length > 0) return { valid: false, reason: GENERIC_INVALID };
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
      [crypto.randomUUID(), vouchers[0].id, orderId, reg.email?.trim().toLowerCase(), reg.name, reg.eventId, reg.discountAmount || 0],
    );
    // Guarded increment — hard cap so usedCount can never exceed quota, even under races.
    await query('UPDATE Voucher SET usedCount = usedCount + 1 WHERE id = ? AND (quota = 0 OR usedCount < quota)', [vouchers[0].id]);
    // query() returns rows only (no affectedRows header), so detect a skipped increment by re-reading.
    const after: any = await query('SELECT usedCount, quota FROM Voucher WHERE id = ?', [vouchers[0].id]);
    if (after[0]?.quota > 0 && after[0].usedCount >= after[0].quota) {
      console.warn(`[VOUCHER] Redemption inserted while usedCount at/over quota (${after[0].usedCount}/${after[0].quota}) for voucher ${vouchers[0].id}, order ${orderId}`);
    }
  } catch (e: any) {
    if (e.code !== 'ER_DUP_ENTRY') throw e; // already settled
  }
}
