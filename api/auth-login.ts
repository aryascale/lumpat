import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '../src/lib/jwt';

export default async function handler(req: any) {
  if (req.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const { email, password } = JSON.parse(req.body || '{}');

    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }), headers: {} };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }), headers: {} };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }), headers: {} };
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
      body: JSON.stringify({ 
        user: { id: user.id, email: user.email, username: user.username, role: user.role } 
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
