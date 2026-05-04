import { query } from '../src/lib/db';
import { CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';

function verifySignature(orderId: string, statusCode: string, grossAmount: string, signatureKey: string): boolean {
  const payload = orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY;
  const hash = crypto.createHash('sha512').update(payload).digest('hex');
  return hash === signatureKey;
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing body' }) };

    const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type, fraud_status } = body;

    if (!order_id || !signature_key) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid notification' }) };
    }

    if (MIDTRANS_SERVER_KEY && !verifySignature(order_id, status_code, gross_amount, signature_key)) {
      console.error('[WEBHOOK-MIDTRANS] Invalid signature for order:', order_id);
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    let paymentStatus = 'pending';

    if (transaction_status === 'capture') {
      paymentStatus = (fraud_status === 'accept') ? 'settlement' : 'pending';
    } else if (transaction_status === 'settlement') {
      paymentStatus = 'settlement';
    } else if (['cancel', 'deny'].includes(transaction_status)) {
      paymentStatus = 'cancel';
    } else if (transaction_status === 'expire') {
      paymentStatus = 'expire';
    } else if (transaction_status === 'pending') {
      paymentStatus = 'pending';
    }

    const paidAt = paymentStatus === 'settlement' ? 'NOW()' : 'NULL';

    await query(
      `UPDATE EventRegistration SET paymentStatus = ?, paymentMethod = ?, paidAt = ${paidAt === 'NOW()' ? 'NOW()' : 'NULL'}, updatedAt = NOW() WHERE orderId = ?`,
      [paymentStatus, payment_type || null, order_id]
    );

    console.log(`[WEBHOOK-MIDTRANS] Order ${order_id} -> ${paymentStatus} (${payment_type})`);

    // Log activity
    const reg: any = await query('SELECT eventId, name, email FROM EventRegistration WHERE orderId = ? LIMIT 1', [order_id]);
    if (reg.length > 0) {
      const actionMap: Record<string, string> = { settlement: 'payment.settlement', cancel: 'payment.cancel', expire: 'payment.expire', pending: 'payment.pending' };
      const actionKey = actionMap[paymentStatus] || 'payment.update';
      await logActivity(actionKey, `Pembayaran ${paymentStatus} untuk ${reg[0].name} (${order_id})`, reg[0].email, reg[0].eventId, { orderId: order_id, paymentStatus, paymentType: payment_type });
    }
    return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok' }) };
  } catch (error: any) {
    console.error('[WEBHOOK-MIDTRANS] Error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
