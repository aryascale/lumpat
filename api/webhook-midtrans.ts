import { query } from '../src/lib/db';
import { CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import { sendRegistrationConfirmation } from '../src/lib/email-service';
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
    
    // PING LOG - TO VERIFY ENDPOINT IS REACHED
    await query("INSERT INTO ActivityLog (id, action, detail, actor, createdAt) VALUES (?, ?, ?, ?, NOW())", [
      crypto.randomUUID(),
      'webhook.ping',
      `Endpoint hit with method ${event.httpMethod}`,
      'system'
    ]);

    if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing body' }) };

    const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type, fraud_status } = body;

    // Log the incoming request to ActivityLog for debugging
    await logActivity('webhook.received', `Webhook masuk: Order ${order_id}, Status: ${transaction_status}`, 'system', null, { 
      orderId: order_id, 
      status: transaction_status, 
      amount: gross_amount,
      paymentType: payment_type
    });

    if (!order_id || !signature_key) {
      console.error('[WEBHOOK-MIDTRANS] Missing order_id or signature_key');
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid notification' }) };
    }

    // Robust signature verification
    const verify = (amt: string) => {
      const payload = order_id + status_code + amt + MIDTRANS_SERVER_KEY;
      const calculatedHash = crypto.createHash('sha512').update(payload).digest('hex');
      return calculatedHash === signature_key;
    };

    const grossAmountStr = String(gross_amount);
    const isVerified = verify(grossAmountStr) || verify(grossAmountStr.split('.')[0]);

    if (MIDTRANS_SERVER_KEY && !isVerified) {
      console.error('[WEBHOOK-MIDTRANS] Signature verification failed for order:', order_id);
      await logActivity('webhook.error', `Signature verification failed for ${order_id}`, 'system', null, { orderId: order_id, received_sig: signature_key });
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

    // Update DB
    await query(
      `UPDATE EventRegistration SET paymentStatus = ?, paymentMethod = ?, paidAt = ${paidAt === 'NOW()' ? 'NOW()' : 'NULL'}, updatedAt = NOW() WHERE orderId = ?`,
      [paymentStatus, payment_type || null, order_id]
    );

    console.log(`[WEBHOOK-MIDTRANS] Order ${order_id} -> ${paymentStatus} (${payment_type})`);

    // Fetch details for logging and email
    const regRes: any = await query(
      `SELECT er.*, e.name as eventName, e.eventDate, c.name as categoryName 
       FROM EventRegistration er
       JOIN Event e ON er.eventId = e.id
       JOIN Category c ON er.categoryId = c.id
       WHERE er.orderId = ? LIMIT 1`,
      [order_id]
    );

    if (regRes.length > 0) {
      const reg = regRes[0];
      
      // Log activity
      const actionMap: Record<string, string> = { settlement: 'payment.settlement', cancel: 'payment.cancel', expire: 'payment.expire', pending: 'payment.pending' };
      const actionKey = actionMap[paymentStatus] || 'payment.update';
      await logActivity(actionKey, `Pembayaran ${paymentStatus} untuk ${reg.name} (${order_id})`, reg.email, reg.eventId, { orderId: order_id, paymentStatus, paymentType: payment_type });

      // Send Confirmation Email if settlement
      if (paymentStatus === 'settlement') {
        await sendRegistrationConfirmation(reg);
      }
    }
    return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok' }) };
  } catch (error: any) {
    console.error('[WEBHOOK-MIDTRANS] Error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
