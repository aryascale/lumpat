import prisma from '../src/lib/prisma';
import { verifyToken } from '../src/lib/jwt';

export default async function handler(req: any) {
  try {
    if (req.httpMethod === 'GET') {
      const eventId = req.queryStringParameters?.eventId;
      if (!eventId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'eventId is required' }), headers: {} };
      }

      // Fetch participants for the event
      const registrations = await prisma.eventRegistration.findMany({
        where: { eventId },
        include: {
          user: { select: { id: true, name: true, username: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const participants = registrations.map((r: any) => ({
        id: r.id,
        user: r.user,
        category: r.category,
        status: r.status,
        createdAt: r.createdAt,
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants }),
      };
    }

    if (req.httpMethod === 'POST') {
      const token = req.cookies?.token;
      if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }), headers: {} };

      const decoded: any = verifyToken(token);
      if (!decoded || !decoded.id) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }), headers: {} };

      const { eventId, categoryId } = JSON.parse(req.body || '{}');
      if (!eventId || !categoryId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'eventId and categoryId are required' }), headers: {} };
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }), headers: {} };

      // Optional check if they verified phone number
      if (!user.isPhoneVerified) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Please verify your phone number first' }), headers: {} };
      }

      const existingReg = await prisma.eventRegistration.findFirst({
        where: { userId: decoded.id, eventId }
      });

      if (existingReg) {
        return { statusCode: 400, body: JSON.stringify({ error: 'You are already registered for this event' }), headers: {} };
      }

      const registration = await prisma.eventRegistration.create({
        data: {
          userId: decoded.id,
          eventId,
          categoryId,
          status: 'registered'
        }
      });

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration }),
      };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
