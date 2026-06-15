import { prisma } from './prisma';

export async function logActivity(
  action: string,
  detail?: string,
  actor?: string,
  eventId?: string,
  metadata?: Record<string, any>
) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        detail: detail || null,
        actor: actor || 'system',
        eventId: eventId || null,
        metadata: metadata || null,
      }
    });
  } catch (error) {
    console.error('[ACTIVITY-LOG] Failed to log:', error);
  }
}
