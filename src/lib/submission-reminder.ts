import { query } from './db';
import { logActivity } from './activity-logger';
import { sendSubmissionReminder } from './email-service';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * H-3 submission reminder for virtual run events.
 *
 * Admin config (event.content):
 *   submissionCloseAt: 'YYYY-MM-DD'  — closing date override; falls back to eventDate
 *   submissionReminder: { enabled, subject, message, linkLabel, linkUrl, sentAt }
 *
 * Runs hourly from server.ts. When now is inside [closeAt - 3d, closeAt) and the
 * reminder hasn't fired yet, sends it to every settled participant once, then
 * stamps submissionReminder.sentAt so it never repeats.
 */
export async function runSubmissionReminders(): Promise<void> {
  const events: any = await query(
    "SELECT id, name, eventDate, content FROM Event WHERE content IS NOT NULL AND content LIKE '%submissionReminder%'"
  );
  const now = Date.now();

  for (const ev of events) {
    try {
      const content = typeof ev.content === 'string' ? JSON.parse(ev.content) : ev.content;
      const reminder = content?.submissionReminder;
      if (!reminder?.enabled || reminder.sentAt) continue;

      const closeStr = content?.submissionCloseAt || ev.eventDate;
      if (!closeStr) continue;
      // Closing counts until end of that day
      const closeMs = new Date(closeStr).setHours(23, 59, 59, 999);
      if (Number.isNaN(closeMs)) continue;

      if (now < closeMs - THREE_DAYS_MS || now >= closeMs) continue;

      const regs: any = await query(
        `SELECT er.id, er.eventId, er.name, er.email, e.name AS eventName, c.name AS categoryName
         FROM EventRegistration er
         JOIN Event e ON er.eventId = e.id
         JOIN Category c ON er.categoryId = c.id
         WHERE er.eventId = ? AND er.paymentStatus = 'settlement'`,
        [ev.id]
      );

      let sent = 0;
      for (const reg of regs) {
        const res = await sendSubmissionReminder(reg, reminder);
        if (res?.success) sent++;
      }

      // Stamp sentAt (read-modify-write of content; single server process)
      content.submissionReminder = { ...reminder, sentAt: new Date().toISOString() };
      await query('UPDATE Event SET content = ?, updatedAt = NOW() WHERE id = ?', [
        JSON.stringify(content),
        ev.id,
      ]);

      await logActivity(
        'email.submission_reminder',
        `Reminder H-3 submission terkirim ke ${sent}/${regs.length} peserta ${ev.name}`,
        'system',
        ev.id,
        { eventId: ev.id, sent, total: regs.length, closeAt: closeStr }
      );
      console.log(`[SUBMISSION-REMINDER] ${ev.name}: sent ${sent}/${regs.length}`);
    } catch (e) {
      console.error(`[SUBMISSION-REMINDER] Event ${ev.id} error:`, e);
    }
  }
}

/** Starts the hourly loop; first pass after a short warm-up delay. */
export function startSubmissionReminderScheduler() {
  setTimeout(() => {
    runSubmissionReminders().catch((e) => console.error('[SUBMISSION-REMINDER] Run failed:', e));
  }, 30_000);
  return setInterval(() => {
    runSubmissionReminders().catch((e) => console.error('[SUBMISSION-REMINDER] Run failed:', e));
  }, HOUR_MS);
}
