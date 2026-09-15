import { query } from '../src/lib/db';
import bcrypt from 'bcryptjs';
import { requireRole } from '../src/lib/jwt';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

const roleOptions = ['super_admin', 'event_admin', 'scan_admin', 'payment_admin', 'user'];

function validateLumpatEmail(email: string) {
  return /^[^\s@]+@lumpat\.co\.id$/i.test(email.trim());
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  const auth = requireRole(event, ['super_admin']);
  if (!auth.allowed) return errorResponse(auth.message, auth.statusCode);

  try {
    const { action, id, email, username, password, name, role } = parseBody(event);

    if (event.httpMethod === 'GET') {
      const users: any[] = await query(
        'SELECT id, email, username, name, role, isEmailVerified, phoneNumber, createdAt FROM User ORDER BY createdAt DESC LIMIT 200'
      );

      return successResponse({ users: users.map((user) => ({
        ...user,
        isEmailVerified: !!user.isEmailVerified,
      })) });
    }

    if (event.httpMethod === 'POST') {
      if (!email || !username || !password || !role) {
        return errorResponse('Missing required fields', 400);
      }

      if (!validateLumpatEmail(email)) {
        return errorResponse('Email harus menggunakan domain @lumpat.co.id', 400);
      }

      const normalizedRole = role.toLowerCase().trim();
      if (!roleOptions.includes(normalizedRole)) {
        return errorResponse('Invalid role selected', 400);
      }

      const existing: any[] = await query(
        'SELECT id FROM User WHERE email = ? OR username = ? LIMIT 1',
        [email, username]
      );

      if (existing.length > 0) {
        return errorResponse('Email or username already exists', 409);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();

      await query(
        'INSERT INTO User (id, email, username, password, name, role, isEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW())',
        [userId, email, username, hashedPassword, name || username, normalizedRole]
      );

      return successResponse({ message: 'User created successfully' }, 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!id) return errorResponse('User id is required', 400);
      const updateFields: string[] = [];
      const values: any[] = [];

      if (role) {
        const normalizedRole = role.toLowerCase().trim();
        if (!roleOptions.includes(normalizedRole)) {
          return errorResponse('Invalid role selected', 400);
        }
        updateFields.push('role = ?');
        values.push(normalizedRole);
      }

      if (name) {
        updateFields.push('name = ?');
        values.push(name);
      }

      if (email) {
        if (!validateLumpatEmail(email)) {
          return errorResponse('Email harus menggunakan domain @lumpat.co.id', 400);
        }

        const exists: any[] = await query(
          'SELECT id FROM User WHERE email = ? AND id != ? LIMIT 1',
          [email, id]
        );
        if (exists.length > 0) return errorResponse('Email already in use', 409);
        updateFields.push('email = ?');
        values.push(email);
      }

      if (username) {
        const exists: any[] = await query(
          'SELECT id FROM User WHERE username = ? AND id != ? LIMIT 1',
          [username, id]
        );
        if (exists.length > 0) return errorResponse('Username already in use', 409);
        updateFields.push('username = ?');
        values.push(username);
      }

      if (password) {
        updateFields.push('password = ?');
        values.push(await bcrypt.hash(password, 10));
      }

      if (updateFields.length === 0) {
        return errorResponse('No valid update fields provided', 400);
      }

      values.push(id);
      await query(
        `UPDATE User SET ${updateFields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
        values
      );

      return successResponse({ message: 'User updated successfully' });
    }

    if (event.httpMethod === 'DELETE') {
      if (!id) return errorResponse('User id is required', 400);

      await query('DELETE FROM User WHERE id = ?', [id]);
      return successResponse({ message: 'User deleted successfully' });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[ADMIN USERS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
