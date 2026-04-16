import prisma from '../src/lib/prisma';

interface APIEvent {
  httpMethod: string;
  headers: { [key: string]: string };
  queryStringParameters?: { [key: string]: string };
  body: string | null;
  isBase64Encoded: boolean;
}

interface APIResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
}

interface TimingData {
  cutoffMs: number | null;
  categoryStartTimes: Record<string, string> | null;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function parseBody(event: APIEvent) {
  if (!event.body) return null;
  return event.isBase64Encoded
    ? JSON.parse(Buffer.from(event.body, 'base64').toString())
    : JSON.parse(event.body);
}

export default async function handler(event: APIEvent): Promise<APIResponse> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const eventId = event.queryStringParameters?.eventId;
    if (!eventId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'eventId is required' }) };

    if (event.httpMethod === 'GET') {
      const record = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, cutoffMs: true, categoryStartTimes: true },
      });

      if (!record) return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Event not found' }) };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ cutoffMs: record.cutoffMs, categoryStartTimes: record.categoryStartTimes }),
      };
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

      const { cutoffMs, categoryStartTimes } = body as TimingData;

      if (cutoffMs !== null && cutoffMs !== undefined && (typeof cutoffMs !== 'number' || cutoffMs < 0)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'cutoffMs must be a positive number or null' }) };
      }

      if (categoryStartTimes !== null && categoryStartTimes !== undefined && (typeof categoryStartTimes !== 'object' || Array.isArray(categoryStartTimes))) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'categoryStartTimes must be an object or null' }) };
      }

      const existing = await prisma.event.findUnique({ where: { id: eventId } });
      if (!existing) return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Event not found' }) };

      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { cutoffMs: cutoffMs ?? null, categoryStartTimes: categoryStartTimes ?? null },
        select: { id: true, cutoffMs: true, categoryStartTimes: true },
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ cutoffMs: updated.cutoffMs, categoryStartTimes: updated.categoryStartTimes }),
      };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error: any) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
}
