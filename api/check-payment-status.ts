import { query, exec } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import { runSettlementSideEffects } from '../src/lib/settlement';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = parseBody(event);
    if (!body) return errorResponse('Missing request body', 400);

    const { orderId } = body;
    if (!orderId) return errorResponse('orderId is required', 400);

    // 1. Check current status in our DB
    const existing: any = await query(
      'SELECT id, paymentStatus, eventId FROM EventRegistration WHERE orderId = ? LIMIT 1',
      [orderId]
    );

    if (existing.length === 0) return errorResponse('Order not found', 404);

    // Order summary for the payment status page (display only — never block the status flow)
    let order: any;
    try {
      const orderRes: any = await query(
        `SELECT e.name AS eventName, e.slug AS eventSlug, c.name AS categoryName,
                COUNT(er.id) AS participantCount,
                SUM(er.grossAmount) - MAX(COALESCE(er.discountAmount, 0)) AS total
         FROM EventRegistration er
         JOIN Event e ON er.eventId = e.id
         JOIN Category c ON er.categoryId = c.id
         WHERE er.orderId = ?
         GROUP BY e.id, e.slug, c.name
         LIMIT 1`,
        [orderId]
      );
      if (orderRes[0]) {
        order = {
          eventName: orderRes[0].eventName,
          eventSlug: orderRes[0].eventSlug,
          categoryName: orderRes[0].categoryName,
          participantCount: Number(orderRes[0].participantCount),
          total: Number(orderRes[0].total || 0),
        };
      }
    } catch (e) {
      console.error('[CHECK-PAYMENT] Error building order summary:', e);
    }

    // If already settled, no need to check Midtrans
    if (existing[0].paymentStatus === 'settlement') {
      return successResponse({ status: 'settlement', order, message: 'Pembayaran sudah dikonfirmasi sebelumnya.' });
    }

    // 2. Query Midtrans API directly for transaction status
    if (!MIDTRANS_SERVER_KEY) {
      return errorResponse('Midtrans not configured', 500);
    }

    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
    const midtransRes = await fetch(`${MIDTRANS_API_URL}/${orderId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
    });

    if (!midtransRes.ok) {
      const errText = await midtransRes.text();
      console.error('[CHECK-PAYMENT] Midtrans API error:', errText);
      return errorResponse('Gagal mengecek status pembayaran dari Midtrans', 502);
    }

    const midtransData: any = await midtransRes.json();
    const { transaction_status, fraud_status, payment_type } = midtransData;

    console.log(`[CHECK-PAYMENT] Midtrans status for ${orderId}: ${transaction_status} (fraud: ${fraud_status})`);

    // 3. Determine payment status
    let paymentStatus = 'pending';
    if (transaction_status === 'capture') {
      paymentStatus = (fraud_status === 'accept') ? 'settlement' : 'pending';
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'settlement';
    } else if (['cancel', 'deny'].includes(transaction_status)) {
      paymentStatus = 'cancel';
    } else if (transaction_status === 'expire') {
      paymentStatus = 'expire';
    }

    // 4. If status changed, update our DB. Settlement uses compare-and-set so
    // only the poll/webhook/manual-settle that flips the status runs the side
    // effects — no double emails or double inventory under races.
    if (paymentStatus !== existing[0].paymentStatus) {
      let newlySettled = false;
      if (paymentStatus === 'settlement') {
        newlySettled = (await exec(
          "UPDATE EventRegistration SET paymentStatus = 'settlement', paymentMethod = ?, paidAt = NOW(), updatedAt = NOW() WHERE orderId = ? AND paymentStatus != 'settlement'",
          [payment_type || null, orderId]
        )) > 0;
      } else {
        await query(
          `UPDATE EventRegistration SET paymentStatus = ?, paymentMethod = ?, paidAt = NULL, updatedAt = NOW() WHERE orderId = ?`,
          [paymentStatus, payment_type || null, orderId]
        );
      }

      await logActivity(
        'payment.status_check',
        `Status pembayaran ${orderId} diperbarui ke ${paymentStatus} (via client polling)`,
        'system',
        existing[0].eventId,
        { orderId, oldStatus: existing[0].paymentStatus, newStatus: paymentStatus }
      );

      // 5. Post-settlement work (BIB, voucher, emails, inventory) runs in the
      // background — this endpoint is polled by the participant's browser, it
      // must answer immediately instead of waiting 2×N SMTP roundtrips
      if (newlySettled) {
        runSettlementSideEffects(orderId).catch((e) => console.error('[CHECK-PAYMENT] Background settlement failed:', e));
      }
    }

    return successResponse({
      status: paymentStatus,
      order,
      message: paymentStatus === 'settlement' ? 'Pembayaran berhasil dikonfirmasi!' : `Status: ${paymentStatus}`
    });
  } catch (error: any) {
    console.error('[CHECK-PAYMENT] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
