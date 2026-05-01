import { verifyToken } from '../src/lib/jwt';
import prisma from '../src/lib/prisma';

export default async function handler(req: any) {
  if (req.httpMethod !== 'PUT') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const cookies = req.headers.cookie || '';
    const tokenCookie = cookies.split(';').find((c: string) => c.trim().startsWith('token='));
    const token = tokenCookie ? tokenCookie.split('=')[1] : null;

    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }), headers: {} };
    }

    const payload = verifyToken(token) as any;
    if (!payload || !payload.userId) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }), headers: {} };
    }

    const { username, name } = JSON.parse(req.body || '{}');

    const dataToUpdate: any = {};
    if (username !== undefined) dataToUpdate.username = username;
    if (name !== undefined) dataToUpdate.name = name;

    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: dataToUpdate,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          name: updatedUser.name,
          email: updatedUser.email,
        }
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Profile update error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }), headers: {} };
  }
}
