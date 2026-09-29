import { query } from './db';

// Gmail consumer SMTP caps at ~500 emails / rolling 24h. Past the cap the
// account is blocked entirely (OTP included), so checkout stops BEFORE
// hitting it and admins get a bell warning.
export const EMAIL_DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || '500');
const WARN_RATIO = parseFloat(process.env.EMAIL_QUOTA_WARN_RATIO || '0.95');

// Blast emails share the SMTP pool with OTP/ticket mail. Reserve headroom so a
// bulk blast never eats the OTP budget, and cap each request so the admin UI
// send-loop stays responsive.
export const EMAIL_QUOTA_OTP_BUFFER = parseInt(process.env.EMAIL_QUOTA_OTP_BUFFER || '50');
export const EMAIL_BLAST_BATCH = parseInt(process.env.EMAIL_BLAST_BATCH || '20');

/** How many blast emails may go out in one request right now. 0 = stop (quota). */
export function blastBatchSize(quotaRemaining: number, pendingCount: number) {
  const allowed = Math.max(0, quotaRemaining - EMAIL_QUOTA_OTP_BUFFER);
  return Math.max(0, Math.min(EMAIL_BLAST_BATCH, pendingCount, allowed));
}

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS EmailSendLog (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      kind VARCHAR(64) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX EmailSendLog_createdAt_idx (createdAt)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  tableReady = true;
}

/** Call after every successful outgoing email. Never throws. */
export async function recordEmailSend(kind = 'general') {
  try {
    await ensureTable();
    await query('INSERT INTO EmailSendLog (id, kind) VALUES (UUID(), ?)', [kind]);
  } catch (e) {
    console.error('[EMAIL-QUOTA] record failed:', e);
  }
}

export async function getEmailQuota() {
  await ensureTable();
  const rows: any = await query(
    'SELECT COUNT(*) as used FROM EmailSendLog WHERE createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)'
  );
  const used = Number(rows[0]?.used || 0);
  return {
    used,
    limit: EMAIL_DAILY_LIMIT,
    remaining: Math.max(0, EMAIL_DAILY_LIMIT - used),
    nearFull: used >= EMAIL_DAILY_LIMIT * WARN_RATIO,
  };
}
