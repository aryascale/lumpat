import { test } from 'node:test';
import assert from 'node:assert';
import parseTimeToMs from '../time.ts';

const WIB_NOON_UTC = Date.UTC(2026, 9, 19, 5, 0, 0); // 2026-10-19 12:00 WIB

test('ISO with Z suffix is not re-shifted by tzOffset', () => {
  // Old bug: "05:00" from the ISO was treated as WIB local → T0 shifted -7h (double shift)
  assert.equal(parseTimeToMs('2026-10-19T05:00:00.000Z', 7).ms, WIB_NOON_UTC);
});

test('ISO with ±HH:MM suffix parses as-is', () => {
  assert.equal(parseTimeToMs('2026-10-19T12:00:00.000+07:00', 7).ms, WIB_NOON_UTC);
});

test('naive datetime still applies tzOffset (categoryStartTimes format)', () => {
  assert.equal(parseTimeToMs('2026-10-19 12:00:00.000', 7).ms, WIB_NOON_UTC);
});

test('naive time-only string still applies tzOffset', () => {
  const { ms } = parseTimeToMs('12:00:00.500', 7);
  assert.ok(Math.abs((ms as number) - WIB_NOON_UTC - 500) < 86400000); // same day, no double shift
});
