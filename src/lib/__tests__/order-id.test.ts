import { test } from 'node:test';
import assert from 'node:assert';
import { slugCategory, formatWibTimestamp, buildOrderId } from '../order-id.ts';

test('slugCategory strips non-alphanumerics, uppercases, caps at 12', () => {
  assert.equal(slugCategory('10K TNI/POLRI'), '10KTNIPOLRI');
  assert.equal(slugCategory('Fun Run 5K'), 'FUNRUN5K');
  assert.equal(slugCategory('   '), 'EVENT'); // empty fallback
  assert.equal(slugCategory('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'ABCDEFGHIJKL'); // 12 cap
});

test('formatWibTimestamp is HHMM+DDMMYYYY in WIB', () => {
  // 2026-09-22T09:58:00Z == 16:58 WIB, 22/09/2026
  assert.equal(formatWibTimestamp(new Date('2026-09-22T09:58:00Z')), '165822092026');
  // midnight edge: 17:00 WIB previous day -> never emit hour "24"
  assert.equal(formatWibTimestamp(new Date('2026-09-22T17:00:00Z')), '000023092026');
});

test('buildOrderId matches LMPT-{CAT}-{TS}-{5digits}', () => {
  const id = buildOrderId('10K TNI/POLRI', new Date('2026-09-22T09:58:00Z'));
  assert.match(id, /^LMPT-10KTNIPOLRI-165822092026-\d{5}$/);
  assert.ok(id.length <= 50);
});

test('buildOrderId random segment varies', () => {
  const a = buildOrderId('X', new Date());
  const b = buildOrderId('X', new Date());
  // 1/100000 chance of equality per pair; two pairs compared, effectively never equal
  assert.ok(a !== b || buildOrderId('X', new Date()) !== a);
});
