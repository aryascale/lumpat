import { query } from '../src/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signToken } from '../src/lib/jwt';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

function issueLoginResponse(user: { id: string; email: string; username: string; role: string }) {
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const response = successResponse({
    user: { id: user.id, email: user.email, username: user.username, role: user.role }
  });
  response.headers['Set-Cookie'] = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return response;
}

export default async function handler(req: any) {
  if (req.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (req.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { email, password } = parseBody(req);

    if (!email || !password) {
      return errorResponse('Missing required fields', 400);
    }

    const users: any = await query(
      'SELECT id, email, username, password, role FROM User WHERE email = ? LIMIT 1',
      [email]
    );

    const user = users[0];
    const isValidPassword = user?.password ? await bcrypt.compare(password, user.password) : false;

    if (!isValidPassword) {
      // Env admin fallback — the same ADMIN_USER/ADMIN_PASS pair that
      // /api/monitoring accepts via x-admin-key. Keeps env-based admin
      // access working even when the DB row is missing or has another
      // password. Find-or-create the super_admin row so the session
      // token resolves on /api/auth-me.
      const envEmail = process.env.ADMIN_USER || process.env.VITE_ADMIN_USER || '';
      const envPass = process.env.ADMIN_PASS || process.env.VITE_ADMIN_PASS || '';
      if (envEmail && envPass && email === envEmail && password === envPass) {
        let admin: any = (
          await query('SELECT id, email, username, role FROM User WHERE email = ? LIMIT 1', [envEmail])
        )[0];
        if (!admin) {
          await query(
            `INSERT INTO User (id, email, username, password, name, role, isEmailVerified, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'Admin', 'super_admin', true, NOW(), NOW())`,
            [crypto.randomUUID(), envEmail, envEmail.split('@')[0], await bcrypt.hash(envPass, 10)]
          );
          admin = (
            await query('SELECT id, email, username, role FROM User WHERE email = ? LIMIT 1', [envEmail])
          )[0];
        }
        return issueLoginResponse(admin);
      }
      return errorResponse('Invalid email or password', 401);
    }

    return issueLoginResponse(user);
  } catch (error: any) {
    console.error('[AUTH] Login error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
