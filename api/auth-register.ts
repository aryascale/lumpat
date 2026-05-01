import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '../src/lib/jwt';

export default async function handler(req: any) {
  if (req.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const { email, username, password } = JSON.parse(req.body || '{}');

    if (!email || !username || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }), headers: {} };
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email already exists' }), headers: {} };
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Username already exists' }), headers: {} };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return {
      statusCode: 201,
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
