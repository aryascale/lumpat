import { query } from './db';
import { settleVoucherRedemption } from './voucher';
import { assignAutoBibsIfEnabled } from './bib-generator';
import { sendRegistrationConfirmation, sendSubmissionEmails } from './email-service';

// Post-settlement work shared by checkout (free path), the Midtrans webhook,
// check-payment-status polling, and admin manual settle.
// DB steps are fast; the emails are SMTP roundtrips (~1s each, 2 per participant),
// so user-facing callers must NOT await this — fire and forget:
//   runSettlementSideEffects(orderId).catch(e => console.error(...))
export async function runSettlementSideEffects(orderId: string): Promise<void> {
  try {
    await settleVoucherRedemption(orderId);
  } catch (e) {
    console.error('[SETTLE] voucher:', e);
  }
  try {
    await assignAutoBibsIfEnabled(orderId);
  } catch (e) {
    console.error('[SETTLE] bibs:', e);
  }

  const regs: any = await query(
    `SELECT er.*, e.name as eventName, e.eventDate, c.name as categoryName
     FROM EventRegistration er
     JOIN Event e ON er.eventId = e.id
     JOIN Category c ON er.categoryId = c.id
     WHERE er.orderId = ?`,
    [orderId]
  );

  for (const reg of regs) {
    if (reg.tshirtSize) {
      // Guarded increment — concurrent settles can never push sold past quota
      await query(
        'UPDATE TshirtInventory SET sold = sold + 1 WHERE eventId = ? AND size = ? AND (quota = 0 OR sold < quota)',
        [reg.eventId, reg.tshirtSize]
      );
    }
    try {
      await sendRegistrationConfirmation(reg);
    } catch (e) {
      console.error('[SETTLE] ticket email failed:', reg.email, e);
    }
    try {
      await sendSubmissionEmails(reg);
    } catch (e) {
      console.error('[SETTLE] submission email failed:', reg.email, e);
    }
  }
}
