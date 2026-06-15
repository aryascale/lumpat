import prisma from '../src/lib/prisma';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const eventId = event.queryStringParameters?.eventId;
    const action = event.queryStringParameters?.action;
    const category = event.queryStringParameters?.category;
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    let where: any = { AND: [] };

    if (eventId && eventId !== 'all') {
      where.AND.push({
        OR: [{ eventId: eventId }, { eventId: null }]
      });
    }

    if (action) {
      where.AND.push({ action: { startsWith: action } });
    }

    if (category && category !== 'ALL') {
      if (category === 'ERROR') {
        where.AND.push({ OR: [{ action: { contains: 'ERROR' } }, { action: { contains: 'FAIL' } }] });
      } else if (category === 'AUTH') {
        where.AND.push({ OR: [{ action: { contains: 'LOGIN' } }, { action: { contains: 'LOGOUT' } }, { action: { contains: 'REGISTER' } }] });
      } else if (category === 'PAYMENT') {
        where.AND.push({ OR: [{ action: { contains: 'PAYMENT' } }, { action: { contains: 'CHECKOUT' } }, { action: { contains: 'SETTLE' } }] });
      } else if (category === 'ADMIN') {
        where.AND.push({ action: { startsWith: 'ADMIN' } });
      } else if (category === 'SYSTEM') {
        where.AND.push({ OR: [{ action: { startsWith: 'SYSTEM' } }, { action: { startsWith: 'WEBHOOK' } }, { action: { startsWith: 'CRON' } }] });
      } else {
        where.AND.push({ action: { startsWith: category } });
      }
    }

    if (where.AND.length === 0) {
      delete where.AND;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.activityLog.count({ where });

    return successResponse({
      logs: logs.map((l: any) => ({
        id: l.id,
        eventId: l.eventId,
        action: l.action,
        detail: l.detail,
        actor: l.actor,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      total
    });
  } catch (error: any) {
    console.error('[ACTIVITY-LOGS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
