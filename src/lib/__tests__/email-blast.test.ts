import { test } from 'node:test';
import assert from 'node:assert';
import { blastBatchSize, EMAIL_BLAST_BATCH, EMAIL_QUOTA_OTP_BUFFER } from '../email-quota.ts';

test('blast never eats the OTP buffer', () => {
  assert.equal(blastBatchSize(EMAIL_QUOTA_OTP_BUFFER, 100), 0); // exact buffer -> nothing
  assert.equal(blastBatchSize(EMAIL_QUOTA_OTP_BUFFER - 1, 100), 0); // below buffer -> nothing
});

test('only headroom above the buffer is spendable', () => {
  assert.equal(blastBatchSize(EMAIL_QUOTA_OTP_BUFFER + 5, 100), 5);
});

test('per-request batch is capped', () => {
  assert.equal(blastBatchSize(1000, 500), EMAIL_BLAST_BATCH);
});

test('never sends more than pending', () => {
  assert.equal(blastBatchSize(1000, 0), 0);
  assert.equal(blastBatchSize(1000, 3), 3);
});
