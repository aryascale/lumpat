import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
import { logActivity } from '../src/lib/activity-logger';
import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = parseBody(event);
    if (!body) return errorResponse('Missing request body', 400);

    const { eventId, categoryId, name, email, phoneNumber, gender, bloodType, emergencyName, emergencyPhone, tshirtSize, bibName, notes } = body;

    if (!eventId || !categoryId || !name || !email || !phoneNumber || !gender) {
      return errorResponse('eventId, categoryId, name, email, phoneNumber, and gender are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return errorResponse('Invalid email format', 400);

    if (bibName && bibName.length > 12) return errorResponse('BIB name max 12 characters', 400);

    // Verify email OTP
    const verifiedOtp: any = await query(
      "SELECT id FROM EmailOtp WHERE email = ? AND verified = true AND expiresAt > NOW() ORDER BY createdAt DESC LIMIT 1",
      [email.trim().toLowerCase()]
    );
    if (verifiedOtp.length === 0) {
      return errorResponse('Email belum diverifikasi. Silakan verifikasi email terlebih dahulu.', 400);
    }

    const existingReg: any = await query(
      "SELECT id, paymentStatus FROM EventRegistration WHERE email = ? AND eventId = ? LIMIT 1",
      [email, eventId]
    );
    if (existingReg.length > 0) {
      if (existingReg[0].paymentStatus === 'settlement') {
        return errorResponse('Email ini sudah terdaftar di event ini', 400);
      }
      await query('DELETE FROM EventRegistration WHERE id = ?', [existingReg[0].id]);
    }

    const categories: any = await query('SELECT id, name, price FROM Category WHERE id = ? AND eventId = ? LIMIT 1', [categoryId, eventId]);
    if (categories.length === 0) return errorResponse('Category not found', 404);

    const events: any = await query('SELECT id, name, bibCustomPrice FROM Event WHERE id = ? LIMIT 1', [eventId]);
    if (events.length === 0) return errorResponse('Event not found', 404);

    const categoryPrice = categories[0].price || 0;
    const bibExtraCharge = bibName ? (events[0].bibCustomPrice || 0) : 0;
    const grossAmount = categoryPrice + bibExtraCharge;

    const orderId = `LMPAT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const regId = crypto.randomUUID();
    await query(
      `INSERT INTO EventRegistration 
        (id, eventId, categoryId, email, name, phoneNumber, gender, bloodType, emergencyName, emergencyPhone, tshirtSize, bibName, notes, orderId, grossAmount, paymentStatus, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [regId, eventId, categoryId, email, name, phoneNumber, gender, bloodType || null, emergencyName || null, emergencyPhone || null, tshirtSize || null, bibName || null, notes || null, orderId, grossAmount]
    );

    if (!MIDTRANS_SERVER_KEY) {
      await logActivity('registration.created', `${name} mendaftar ke event (Midtrans not configured)`, email, eventId, { orderId, grossAmount, category: categories[0].name });
      return successResponse({ orderId, grossAmount, registration: { id: regId }, message: 'Midtrans not configured. Registration saved as pending.' });
    }

    const snapPayload = {
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      customer_details: {
        first_name: name,
        email: email,
        phone: phoneNumber,
      },
      item_details: [
        { id: categoryId, price: categoryPrice, quantity: 1, name: `${events[0].name} - ${categories[0].name}` },
        ...(bibExtraCharge > 0 ? [{ id: 'bib-custom', price: bibExtraCharge, quantity: 1, name: `Custom BIB Name: ${bibName}` }] : []),
      ],
    };

    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
    const snapResponse = await fetch(`${MIDTRANS_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(snapPayload),
    });

    if (!snapResponse.ok) {
      const snapError = await snapResponse.text();
      console.error('[CHECKOUT] Midtrans error:', snapError);
      return errorResponse('Failed to create payment', 500);
    }

    const snapData: any = await snapResponse.json();
    const { token: snapToken, redirect_url: snapUrl } = snapData;

    await query(
      'UPDATE EventRegistration SET snapToken = ?, snapUrl = ?, updatedAt = NOW() WHERE id = ?',
      [snapToken, snapUrl, regId]
    );

    await logActivity('registration.created', `${name} mendaftar ke ${events[0].name} - ${categories[0].name}`, email, eventId, { orderId, grossAmount, category: categories[0].name });

    return successResponse({
      orderId,
      grossAmount,
      snapToken,
      snapUrl,
      registration: { id: regId },
    });
  } catch (error: any) {
    console.error('[CHECKOUT] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
