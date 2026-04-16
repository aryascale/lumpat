import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma';

interface APIEvent {
  httpMethod: string;
  headers: { [key: string]: string };
  body: string | null;
  isBase64Encoded: boolean;
}

interface APIResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const getUploadDir = (): string => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export default async function handler(event: APIEvent): Promise<APIResponse> {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    if (!event.body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body as string, 'base64').toString())
      : JSON.parse(event.body);

    const { eventId, content, filename } = body;
    if (!eventId || !content) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'eventId and content are required' }) };

    const gpxDir = path.join(getUploadDir(), 'events', eventId, 'gpx');
    ensureDir(gpxDir);

    const gpxFilePath = path.join(gpxDir, 'route.gpx');
    fs.writeFileSync(gpxFilePath, content, 'utf-8');

    await prisma.event.update({
      where: { id: eventId },
      data: { gpxFile: `/uploads/events/${eventId}/gpx/route.gpx` },
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        filename: filename || 'route.gpx',
        path: gpxFilePath,
        url: `/uploads/events/${eventId}/gpx/route.gpx`,
      }),
    };
  } catch (error: any) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Failed to upload GPX' }) };
  }
}
