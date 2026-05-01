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

    const { phoneNumber, code } = JSON.parse(req.body || '{}');

    if (!phoneNumber || !code) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Phone number and code are required' }), headers: {} };
    }

    const otp = await prisma.otp.findFirst({
      where: { phoneNumber, code }
    });

    if (!otp) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or expired OTP' }), headers: {} };
    }

    if (new Date() > otp.expiresAt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'OTP has expired' }), headers: {} };
    }

    // Mark user as verified
    await prisma.user.update({
      where: { id: decoded.id },
      data: { isPhoneVerified: true }
    });

    // Delete used OTPs
    await prisma.otp.deleteMany({ where: { phoneNumber } });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Phone number verified successfully' }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
