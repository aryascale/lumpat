import { randomUUID } from 'crypto';
import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS, parseBody } from '../src/lib/api-utils';
import { requireRole } from '../src/lib/jwt';
import { getEmailQuota, recordEmailSend, blastBatchSize } from '../src/lib/email-quota';
import { sendBrandedLinkEmail } from '../src/lib/email-service';

// ponytail: CREATE TABLE IF NOT EXISTS (same as email-quota.ts) instead of a
// Prisma migration — the api/ layer talks raw SQL throughout.
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS EmailBlast (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      eventId VARCHAR(191) NULL,
      eventName VARCHAR(255) NULL,
      subject VARCHAR(255) NOT NULL,
      badge VARCHAR(64) NULL,
      title VARCHAR(255) NULL,
      message TEXT NOT NULL,
      linkUrl VARCHAR(500) NULL,
      linkLabel VARCHAR(255) NULL,
      createdBy VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS EmailBlastRecipient (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      blastId VARCHAR(191) NOT NULL,
      registrationId VARCHAR(191) NOT NULL,
      name VARCHAR(255) NULL,
      email VARCHAR(255) NOT NULL,
      categoryName VARCHAR(255) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      sentAt DATETIME(3) NULL,
      UNIQUE KEY uq_blast_registration (blastId, registrationId),
      INDEX idx_blast_status (blastId, status)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  tablesReady = true;
}

async function blastCounts(blastId: string) {
  const rows: any = await query(
    `SELECT
       SUM(status = 'sent') AS sent,
       SUM(status = 'pending') AS pending,
       SUM(status = 'failed') AS failed
     FROM EmailBlastRecipient WHERE blastId = ?`,
    [blastId]
  );
  return {
    sent: Number(rows[0]?.sent || 0),
    pending: Number(rows[0]?.pending || 0),
    failed: Number(rows[0]?.failed || 0),
  };
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  const auth = requireRole(event, ['super_admin']);
  if (!auth.allowed) return errorResponse(auth.message || 'Forbidden', auth.statusCode || 403);

  const { httpMethod, queryStringParameters } = event;

  if (httpMethod === 'GET') {
    try {
      await ensureTables();
      const { id, eventId, category, before, q } = queryStringParameters || {};

      // Blast detail + recipients
      if (id) {
        const blasts: any = await query('SELECT * FROM EmailBlast WHERE id = ? LIMIT 1', [id]);
        if (!blasts.length) return errorResponse('Blast tidak ditemukan', 404);
        const recipients: any = await query(
          'SELECT registrationId, name, email, categoryName, status, sentAt FROM EmailBlastRecipient WHERE blastId = ? ORDER BY status DESC, email',
          [id]
        );
        return successResponse({ blast: blasts[0], recipients, ...(await blastCounts(id)) });
      }

      // Candidates: paid participants of an event
      if (eventId) {
        const where = ["er.eventId = ?", "er.paymentStatus = 'settlement'"];
        const params: any[] = [eventId];
        if (category) { where.push('c.name = ?'); params.push(category); }
        if (before) { where.push('er.createdAt < ?'); params.push(before); }
        if (q) { where.push('(er.name LIKE ? OR er.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
        const candidates: any = await query(
          `SELECT er.id, er.name, er.email, er.createdAt, c.name AS categoryName
           FROM EventRegistration er
           JOIN Category c ON er.categoryId = c.id
           WHERE ${where.join(' AND ')}
           ORDER BY er.createdAt DESC`,
          params
        );
        return successResponse({ candidates });
      }

      // History
      const blasts: any = await query(
        `SELECT b.id, b.eventId, b.eventName, b.subject, b.createdBy, b.createdAt,
           SUM(r.status = 'sent') AS sentCount,
           SUM(r.status = 'pending') AS pendingCount,
           SUM(r.status = 'failed') AS failedCount
         FROM EmailBlast b
         LEFT JOIN EmailBlastRecipient r ON r.blastId = b.id
         GROUP BY b.id
         ORDER BY b.createdAt DESC
         LIMIT 100`
      );
      return successResponse({
        blasts: blasts.map((b: any) => ({
          ...b,
          sentCount: Number(b.sentCount || 0),
          pendingCount: Number(b.pendingCount || 0),
          failedCount: Number(b.failedCount || 0),
        })),
      });
    } catch (error: any) {
      console.error('[EMAIL-BLAST] GET error:', error);
      return errorResponse('Gagal memuat data blast', 500);
    }
  }

  if (httpMethod === 'POST') {
    const data = parseBody(event);
    try {
      await ensureTables();

      // Send one preview to the admin's own inbox
      if (data.action === 'test') {
        const { subject, badge, title, message, linkUrl, linkLabel, eventId } = data;
        if (!subject?.trim() || !message?.trim()) return errorResponse('Subject dan isi pesan wajib diisi', 400);
        const quota = await getEmailQuota();
        if (quota.remaining <= 0) return errorResponse('Kuota email habis, coba lagi nanti', 429);

        let eventName = '';
        if (eventId) {
          const rows: any = await query('SELECT name FROM Event WHERE id = ? LIMIT 1', [eventId]);
          eventName = rows[0]?.name || '';
        }
        try {
          await sendBrandedLinkEmail({
            to: auth.user.email,
            subject,
            eventName,
            badge: badge || 'TEST',
            title: title || subject,
            message,
            reg: { name: 'Admin' },
            linkUrl,
            linkLabel,
          });
          await recordEmailSend('blast-test');
          return successResponse({ sent: true, to: auth.user.email });
        } catch (e) {
          console.error('[EMAIL-BLAST] test send failed:', e);
          return errorResponse('Gagal mengirim email test', 500);
        }
      }

      // Create blast + recipient snapshot (audience re-validated server-side)
      if (data.action === 'create') {
        const { eventId, subject, badge, title, message, linkUrl, linkLabel, recipientIds } = data;
        if (!eventId || !subject?.trim() || !message?.trim()) {
          return errorResponse('Event, subject, dan isi pesan wajib diisi', 400);
        }
        const ids = [...new Set((Array.isArray(recipientIds) ? recipientIds : []).filter(Boolean))] as string[];
        if (ids.length === 0) return errorResponse('Pilih minimal satu penerima', 400);

        const rows: any = await query(
          `SELECT er.id, er.name, er.email, c.name AS categoryName, e.name AS eventName
           FROM EventRegistration er
           JOIN Category c ON er.categoryId = c.id
           JOIN Event e ON er.eventId = e.id
           WHERE er.eventId = ? AND er.paymentStatus = 'settlement'
             AND er.id IN (${ids.map(() => '?').join(',')})`,
          [eventId, ...ids]
        );
        if (rows.length === 0) return errorResponse('Tidak ada penerima valid (harus peserta lunas di event ini)', 400);

        const blastId = randomUUID();
        await query(
          `INSERT INTO EmailBlast (id, eventId, eventName, subject, badge, title, message, linkUrl, linkLabel, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [blastId, eventId, rows[0].eventName, subject.trim(), badge?.trim() || null, title?.trim() || null,
           message.trim(), linkUrl?.trim() || null, linkLabel?.trim() || null, auth.user?.email || null]
        );
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          await query(
            `INSERT IGNORE INTO EmailBlastRecipient (id, blastId, registrationId, name, email, categoryName)
             VALUES ${chunk.map(() => '(UUID(), ?, ?, ?, ?, ?)').join(',')}`,
            chunk.flatMap((r: any) => [blastId, r.id, r.name, r.email, r.categoryName])
          );
        }
        return successResponse({ blastId, recipientCount: rows.length });
      }

      // Send one batch of pending recipients (frontend loops until done/quota)
      if (data.action === 'send') {
        const { blastId } = data;
        if (!blastId) return errorResponse('blastId wajib diisi', 400);

        const blasts: any = await query('SELECT * FROM EmailBlast WHERE id = ? LIMIT 1', [blastId]);
        if (!blasts.length) return errorResponse('Blast tidak ditemukan', 404);
        const blast = blasts[0];

        const quota = await getEmailQuota();
        const counts = await blastCounts(blastId);
        const budget = blastBatchSize(quota.remaining, counts.pending);
        if (budget === 0) {
          return successResponse({ sentThisRun: 0, stopped: counts.pending > 0 ? 'quota' : 'done', ...counts, quota });
        }

        // budget is a computed integer, not user input — safe to interpolate
        const recipients: any = await query(
          `SELECT id, name, email, categoryName FROM EmailBlastRecipient
           WHERE blastId = ? AND status = 'pending' LIMIT ${budget}`,
          [blastId]
        );

        let sentThisRun = 0;
        let failedThisRun = 0;
        for (const r of recipients) {
          try {
            await sendBrandedLinkEmail({
              to: r.email,
              subject: blast.subject,
              eventName: blast.eventName || '',
              badge: blast.badge || 'INFO',
              title: blast.title || blast.subject,
              message: blast.message,
              reg: { name: r.name, eventName: blast.eventName, categoryName: r.categoryName },
              linkUrl: blast.linkUrl,
              linkLabel: blast.linkLabel,
            });
            await recordEmailSend('blast');
            await query("UPDATE EmailBlastRecipient SET status = 'sent', sentAt = NOW() WHERE id = ?", [r.id]);
            sentThisRun++;
          } catch (e) {
            console.error('[EMAIL-BLAST] send failed:', r.email, e);
            await query("UPDATE EmailBlastRecipient SET status = 'failed' WHERE id = ?", [r.id]);
            failedThisRun++;
          }
          // small pause between sends so consumer Gmail SMTP stays happy
          if (sentThisRun + failedThisRun < recipients.length) {
            await new Promise((res) => setTimeout(res, 300));
          }
        }

        const after = await blastCounts(blastId);
        const quotaAfter = await getEmailQuota();
        const stopped =
          after.pending === 0 ? 'done'
          : blastBatchSize(quotaAfter.remaining, after.pending) > 0 ? 'batch'
          : 'quota';
        return successResponse({ sentThisRun, failedThisRun, stopped, ...after, quota: quotaAfter });
      }

      return errorResponse('Unknown action', 400);
    } catch (error: any) {
      console.error('[EMAIL-BLAST] POST error:', error);
      return errorResponse('Gagal memproses blast', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
