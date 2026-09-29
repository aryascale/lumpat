import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { recordEmailSend } from './email-quota';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BASE_URL = process.env.BASE_URL || 'https://lumpat.online';

/**
 * Consumer Gmail SMTP always sends as the authenticated account — a From on
 * another domain fails SPF/DKIM alignment and lands in spam. Only honor
 * SMTP_FROM on transactional providers (Brevo/Resend/etc with verified domains).
 */
export function resolveFrom(): string {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').toLowerCase();
  const user = process.env.SMTP_USER || '';
  const from = process.env.SMTP_FROM || '';
  const addr = host.includes('gmail') ? (user || from) : (from || user);
  return addr ? `"Lumpat" <${addr}>` : '"Lumpat" <noreply@lumpat.id>';
}

export async function sendRegistrationConfirmation(reg: any) {
  try {
    const fromAddress = resolveFrom();
    const eventDateStr = new Date(reg.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Generate QR Code as base64 data URI
    const verifyUrl = `${BASE_URL}/verify/${reg.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    });

    // Extract base64 from data URL for CID attachment
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

    await transporter.sendMail({
      from: fromAddress,
      to: reg.email,
      subject: `Konfirmasi Pendaftaran: ${reg.eventName}`,
      headers: { 'Auto-Submitted': 'auto-generated' },
      text: `Halo ${reg.name},

Pendaftaran Anda sudah terkonfirmasi.

Event: ${reg.eventName}
Kategori: ${reg.categoryName}
Tanggal: ${eventDateStr}
Order ID: ${reg.orderId}

Cek status pendaftaran: ${verifyUrl}
QR code check-in terlampir sebagai gambar (tunjukkan saat pengambilan Race Pack).

— Lumpat`,
      attachments: [
        {
          filename: 'qr-code.png',
          content: Buffer.from(qrBase64, 'base64'),
          cid: `qrcode-${reg.id}@lumpat`,
        },
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">

            <!-- Simple Header -->
            <div style="background: #000000; padding: 40px 30px; text-align: center;">
              <div style="display: inline-block; background: #e11d48; padding: 4px 12px; font-size: 10px; font-weight: 900; color: white; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; margin-bottom: 15px;">CONFIRMED</div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.02em;">Pembayaran Berhasil!</h1>
              <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 14px;">Selamat, pendaftaran Anda telah kami terima.</p>
            </div>

            <!-- Event Strip -->
            <div style="background: #e11d48; padding: 12px 30px; text-align: center;">
              <span style="color: white; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${reg.eventName}</span>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="margin: 0 0 10px 0; font-size: 16px; color: #111827;">Halo <strong>${reg.name}</strong>,</p>
              <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">Terima kasih telah mendaftar. Simpan email ini sebagai bukti pendaftaran resmi Anda.</p>
              
              <div style="margin-top: 30px; padding: 25px; background: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6;">
                <h3 style="margin: 0 0 20px 0; font-size: 12px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Detail Registrasi</h3>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Event</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111827;">${reg.eventName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Kategori</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111827;">${reg.categoryName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Tanggal</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111827;">${eventDateStr}</td>
                  </tr>
                  ${reg.tshirtSize ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Ukuran Baju</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #e11d48;">${reg.tshirtSize}</td>
                  </tr>` : ''}
                  ${reg.bibName ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Custom BIB</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #e11d48;">${reg.bibName}</td>
                  </tr>` : ''}

                  <!-- Dynamic Custom Fields -->
                  ${await (async () => {
                    if (!reg.customData) return '';
                    try {
                      const data = typeof reg.customData === 'string' ? JSON.parse(reg.customData) : reg.customData;
                      
                      // Fetch field definitions for this event to get labels
                      const { query } = await import('./db');
                      const fieldDefs: any = await query('SELECT id, label FROM RegistrationField WHERE eventId = ?', [reg.eventId]);
                      const labelMap = new Map(fieldDefs.map((f: any) => [f.id.toLowerCase(), f.label]));

                      return Object.entries(data)
                        .filter(([key, val]) => val && !['name', 'email', 'phoneNumber', 'gender', 'tshirtSize', 'bibName', 'categoryId', 'eventId'].includes(key))
                        .map(([key, val]) => {
                          const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(key);
                          const label = labelMap.get(key.toLowerCase());
                          if (!label && isUUID) return ''; // Skip deleted fields to avoid showing ugly UUIDs
                          const displayLabel = label || key.replace(/([A-Z])/g, ' $1').trim();
                          return `
                          <tr>
                            <td style="padding: 8px 0; color: #6b7280; text-transform: capitalize;">${displayLabel}</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111827;">${val}</td>
                          </tr>`;
                        }).join('');
                    } catch (e) { return ''; }
                  })()}

                  <tr>
                    <td style="padding: 20px 0 0 0; color: #9ca3af; font-size: 11px;">Order ID</td>
                    <td style="padding: 20px 0 0 0; text-align: right; font-family: monospace; font-size: 11px; color: #9ca3af;">${reg.orderId}</td>
                  </tr>
                </table>
              </div>

              <!-- QR Code Section -->
              <div style="margin-top: 30px; text-align: center; border: 2px solid #f3f4f6; border-radius: 16px; padding: 30px;">
                <p style="margin: 0 0 15px 0; font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px;">Kode Check-in Anda</p>
                <div style="padding: 10px; background: white; display: inline-block;">
                   <img src="cid:qrcode-${reg.id}@lumpat" alt="QR Code" width="160" height="160" style="display: block;" />
                </div>
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #6b7280;">Tunjukkan kode ini saat pengambilan Race Pack</p>
              </div>

              <!-- Button -->
              <div style="margin-top: 30px; text-align: center;">
                <a href="${verifyUrl}" style="display: inline-block; background: #000000; color: white; padding: 16px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Lihat Status Pendaftaran</a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">Lumpat &copy; ${new Date().getFullYear()}. All rights reserved.</p>
              <p style="font-size: 11px; color: #d1d5db; margin: 10px 0 0 0;">Email ini dikirim secara otomatis oleh sistem Lumpat.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    await recordEmailSend('confirmation');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL-SERVICE] Failed to send email:', error);
    return { success: false, error };
  }
}

export const DEFAULT_SUBMISSION_LINK = 'https://lumpat.online/event/virtual-run-submission?tab=Home';

const fillPlaceholders = (s: string, reg: any) => String(s || '')
  .replace(/\[nama\]/gi, reg.name || 'Kak')
  .replace(/\[event\]/gi, reg.eventName || '')
  .replace(/\[kategori\]/gi, reg.categoryName || '');

/** Shared branded email: black header + rose event strip + paragraphs + optional big CTA button. */
export async function sendBrandedLinkEmail(opts: {
  to: string;
  subject: string;
  eventName: string;
  badge: string;
  title: string;
  message: string;
  reg: any;
  linkUrl: string;
  linkLabel: string;
}) {
  const fromAddress = resolveFrom();
  const paragraphs = fillPlaceholders(opts.message, opts.reg)
    .split(/\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);
  // A link is optional — generic blasts (refund info, announcements) may not have one.
  const linkUrl = opts.linkUrl || '';
  const linkLabel = opts.linkLabel || 'Upload Your Strava Public Link Here';

  await transporter.sendMail({
    from: fromAddress,
    to: opts.to,
    subject: fillPlaceholders(opts.subject, opts.reg) || opts.subject,
    headers: { 'Auto-Submitted': 'auto-generated' },
    text: `${fillPlaceholders(opts.message, opts.reg)}${linkUrl ? `

${linkLabel}:
${linkUrl}` : ''}

— Lumpat`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">

          <div style="background: #000000; padding: 40px 30px; text-align: center;">
            <div style="display: inline-block; background: #e11d48; padding: 4px 12px; font-size: 10px; font-weight: 900; color: white; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; margin-bottom: 15px;">${opts.badge}</div>
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.02em;">${opts.title}</h1>
          </div>

          <div style="background: #e11d48; padding: 12px 30px; text-align: center;">
            <span style="color: white; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${opts.eventName || ''}</span>
          </div>

          <div style="padding: 40px 30px;">
            ${paragraphs.map((p: string) => `<p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563; line-height: 1.7;">${p}</p>`).join('')}

            ${linkUrl ? `
            <div style="margin-top: 30px; text-align: center;">
              <a href="${linkUrl}" style="display: inline-block; background: #000000; color: white; padding: 16px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">${linkLabel}</a>
            </div>

            <p style="margin: 25px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center; word-break: break-all;">
              Jika tombol tidak berfungsi, salin tautan ini: <br/>${linkUrl}
            </p>` : ''}
          </div>

          <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #f3f4f6;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Lumpat &copy; ${new Date().getFullYear()}. All rights reserved.</p>
            <p style="font-size: 11px; color: #d1d5db; margin: 10px 0 0 0;">Email ini dikirim secara otomatis oleh sistem Lumpat.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

/**
 * Virtual run submission emails — admin-configured per event via
 * event.content.submissionEmails (max 2). Sent together with the
 * registration confirmation at settlement. Placeholders: [nama], [event], [kategori].
 */
export async function sendSubmissionEmails(reg: any) {
  try {
    if (!reg?.email || !reg?.eventId) return;
    const { query } = await import('./db');
    const rows: any = await query('SELECT content FROM Event WHERE id = ? LIMIT 1', [reg.eventId]);
    if (!rows.length) return;

    const content = typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content;
    const emails: any[] = Array.isArray(content?.submissionEmails) ? content.submissionEmails : [];
    if (emails.length === 0) return;

    for (const mail of emails) {
      if (!mail?.message) continue;
      await sendBrandedLinkEmail({
        to: reg.email,
        subject: mail.subject || `Upload Hasil Lari - ${reg.eventName}`,
        eventName: reg.eventName,
        badge: 'SUBMISSION',
        title: 'Upload Hasil Lari',
        message: mail.message,
        reg,
        linkUrl: mail.linkUrl || DEFAULT_SUBMISSION_LINK,
        linkLabel: mail.linkLabel,
      });
      await recordEmailSend('submission');
    }
  } catch (error) {
    console.error('[EMAIL-SERVICE] Failed to send submission emails:', error);
  }
}

/** H-3 closing reminder for virtual runs — fired by the scheduler in submission-reminder.ts. */
export async function sendSubmissionReminder(reg: any, reminder: any) {
  try {
    if (!reg?.email) return { success: false };
    await sendBrandedLinkEmail({
      to: reg.email,
      subject: reminder.subject || `Pengingat: Upload Hasil Lari - ${reg.eventName}`,
      eventName: reg.eventName,
      badge: 'REMINDER',
      title: 'Segera Upload Hasil Lari',
      message: reminder.message,
      reg,
      linkUrl: reminder.linkUrl || DEFAULT_SUBMISSION_LINK,
      linkLabel: reminder.linkLabel,
    });
    await recordEmailSend('reminder');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL-SERVICE] Failed to send submission reminder:', error);
    return { success: false, error };
  }
}
