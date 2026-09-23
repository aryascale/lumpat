import { test } from 'node:test';
import assert from 'node:assert';
import { calculateDiscount } from '../voucher.ts';

test('nominal discount clamps to total', () => {
  assert.equal(calculateDiscount('nominal', 25000, null, 100000), 25000);
  assert.equal(calculateDiscount('nominal', 150000, null, 100000), 100000);
  assert.equal(calculateDiscount('nominal', 0, null, 100000), 0);
});

test('percent discount floors and clamps', () => {
  assert.equal(calculateDiscount('percent', 20, null, 99900), 19980); // floor(99900*0.2)
  assert.equal(calculateDiscount('percent', 100, null, 75000), 75000);
  assert.equal(calculateDiscount('percent', 150, null, 75000), 75000); // >100% clamps to total
});

test('percent discount respects maxDiscount cap', () => {
  assert.equal(calculateDiscount('percent', 50, 30000, 100000), 30000);
  assert.equal(calculateDiscount('percent', 10, 30000, 100000), 10000); // under cap untouched
});

test('zero total yields zero discount', () => {
  assert.equal(calculateDiscount('percent', 50, null, 0), 0);
});
