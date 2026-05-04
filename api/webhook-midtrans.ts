import { query } from '../src/lib/db';
import { CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
        try {
          const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lumpat.id';
          const eventDateStr = new Date(reg.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
          
          await transporter.sendMail({
            from: fromAddress,
            to: reg.email,
            subject: `Konfirmasi Pendaftaran Event: ${reg.eventName}`,
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                <div style="background: #e11d48; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase;">Pembayaran Berhasil!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Kamu resmi terdaftar di ${reg.eventName}</p>
                </div>
                
                <div style="padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; background: white;">
                  <p style="margin: 0 0 20px 0;">Halo <strong>${reg.name}</strong>,</p>
                  <p style="margin: 0 0 20px 0;">Terima kasih telah melakukan pembayaran. Pendaftaran kamu untuk event <strong>${reg.eventName}</strong> telah kami konfirmasi.</p>
                  
                  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                    <h2 style="margin: 0 0 15px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Detail Pendaftaran</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Event</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${reg.eventName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Kategori</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${reg.categoryName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tanggal Event</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${eventDateStr}</td>
                      </tr>
                      ${reg.bibName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nama di BIB</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px; color: #e11d48;">${reg.bibName}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Order ID</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 14px;">${order_id}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="text-align: center; margin-bottom: 25px;">
                    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 15px;">Tunjukkan bukti pembayaran ini atau Order ID saat pengambilan race pack.</p>
                    <a href="https://lumpat.id/leaderboard" style="display: inline-block; background: #111; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">LIHAT LEADERBOARD</a>
                  </div>
                  
                  <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 25px 0;" />
                  
                  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Lumpat &copy; 2026. All rights reserved.</p>
                </div>
              </div>
            `,
          });
          console.log(`[WEBHOOK-MIDTRANS] Confirmation email sent to ${reg.email}`);
        } catch (emailErr) {
          console.error('[WEBHOOK-MIDTRANS] Email error:', emailErr);
        }
      }
    }
    return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok' }) };
  } catch (error: any) {
    console.error('[WEBHOOK-MIDTRANS] Error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
