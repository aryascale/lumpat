import prisma from '../src/lib/prisma';
import { verifyToken } from '../src/lib/jwt';

export default async function handler(req: any) {
  if (req.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const token = req.cookies?.token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }), headers: {} };

    const decoded: any = verifyToken(token);
    if (!decoded || !decoded.id) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }), headers: {} };

    const { phoneNumber } = JSON.parse(req.body || '{}');

    if (!phoneNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Phone number is required' }), headers: {} };
    }

    // Update user profile with the new phone number and set unverified
    await prisma.user.update({
      where: { id: decoded.id },
      data: { phoneNumber, isPhoneVerified: false }
    });

    // Delete existing OTPs for this number
    await prisma.otp.deleteMany({ where: { phoneNumber } });

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otp.create({
      data: {
        phoneNumber,
        code,
        expiresAt
      }
    });

    // MOCK OTP SENDER
    console.log(`\n================================`);
    console.log(`[MOCK SMS] To: ${phoneNumber}`);
    console.log(`[MOCK SMS] Code: ${code}`);
    console.log(`================================\n`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'OTP sent successfully (Check server console)' }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
