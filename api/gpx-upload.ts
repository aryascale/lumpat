import fs from 'node:fs';
import path from 'node:path';
import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

const getUploadDir = (): string => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    if (!event.body) return errorResponse('Missing request body', 400);

    const body = parseBody(event);
    const { eventId, content, filename } = body;
    if (!eventId || !content) return errorResponse('eventId and content are required', 400);

    const gpxDir = path.join(getUploadDir(), 'events', eventId, 'gpx');
    ensureDir(gpxDir);

    const gpxFilePath = path.join(gpxDir, 'route.gpx');
    fs.writeFileSync(gpxFilePath, content, 'utf-8');

    await query('UPDATE Event SET gpxFile = ?, updatedAt = NOW() WHERE id = ?', [
      `/uploads/events/${eventId}/gpx/route.gpx`, eventId
    ]);

    return successResponse({
      success: true,
      filename: filename || 'route.gpx',
      path: gpxFilePath,
      url: `/uploads/events/${eventId}/gpx/route.gpx`,
    });
  } catch (error: any) {
    console.error('[GPX-UPLOAD] Error:', error);
    return errorResponse(error.message || 'Failed to upload GPX');
  }
}
