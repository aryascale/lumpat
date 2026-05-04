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

export async function sendRegistrationConfirmation(reg: any) {
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
                  <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 14px;">${reg.orderId}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-bottom: 25px;">
              <p style="font-size: 12px; color: #94a3b8; margin-bottom: 15px;">Tunjukkan bukti pembayaran ini atau Order ID saat pengambilan race pack.</p>
              <a href="https://lumpat.online/leaderboard" style="display: inline-block; background: #111; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">LIHAT LEADERBOARD</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 25px 0;" />
            
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Lumpat &copy; 2026. All rights reserved.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('[EMAIL-SERVICE] Failed to send email:', error);
    return { success: false, error };
  }
}
