import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev-only-change-me';

export type UserRole = 'super_admin' | 'event_admin' | 'scan_admin' | 'payment_admin' | 'user';

export function normalizeUserRole(role?: string | null): UserRole {
  const value = (role || '').toLowerCase().trim();

  if (!value || value === 'user') return 'user';
  if (value === 'admin' || value === 'super_admin' || value === 'superadmin') return 'super_admin';
  if (value.includes('event')) return 'event_admin';
  if (value.includes('scan') || value.includes('rpc') || value.includes('verify')) return 'scan_admin';
  if (value.includes('payment')) return 'payment_admin';

  return 'user';
}

export function signToken(payload: object, expiresIn: string | number = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function getRequestUser(event: any) {
  const cookieHeader = event?.headers?.cookie || event?.cookies ? (event.cookies && typeof event.cookies === 'object' ? '' : '') : '';
  const cookies = event?.cookies && typeof event.cookies === 'object' ? event.cookies : {};
  const token = cookies.token || (typeof cookieHeader === 'string'
    ? cookieHeader.split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith('token='))?.split('=')[1]
    : null);

  if (!token) return null;

  const decoded: any = verifyToken(token);
  if (!decoded || !decoded.id) return null;

  return {
    ...decoded,
    role: normalizeUserRole(decoded.role),
  };
}

export function requireRole(event: any, allowedRoles: UserRole[]) {
  const user = getRequestUser(event);
  if (!user) {
    return { allowed: false, statusCode: 401, message: 'Not authenticated' as const };
  }

  const role = normalizeUserRole(user.role);
  if (!allowedRoles.includes(role)) {
    return { allowed: false, statusCode: 403, message: 'Forbidden' as const, role };
  }

  return { allowed: true, user, role };
}
