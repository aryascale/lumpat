import { query } from './db';
import crypto from 'crypto';

export async function logActivity(
  action: string,
  detail?: string,
  actor?: string,
  eventId?: string,
  metadata?: Record<string, any>
) {
  try {
    await query(
      "INSERT INTO ActivityLog (id, eventId, action, detail, actor, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [
        crypto.randomUUID(),
        eventId || null,
        action,
        detail || null,
        actor || 'system',
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (error) {
    console.error('[ACTIVITY-LOG] Failed to log:', error);
  }
}
