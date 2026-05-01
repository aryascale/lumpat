import prisma from '../src/lib/prisma';
import { verifyToken } from '../src/lib/jwt';

export default async function handler(req: any) {
  if (req.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const token = req.cookies?.token;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }), headers: {} };
    }

    const decoded: any = verifyToken(token);
    if (!decoded || !decoded.id) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }), headers: {} };
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        phoneNumber: true,
        isPhoneVerified: true,
        role: true,
        googleId: true,
      }
    });

    if (!user) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }), headers: {} };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
