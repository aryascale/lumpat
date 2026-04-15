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

export default async function handler(event: APIEvent): Promise<APIResponse> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const eventId = event.queryStringParameters?.eventId;

    if (!eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'eventId is required' }),
      };
    }

    // GET - Fetch timing rules for an event
    if (event.httpMethod === 'GET') {
      const eventRecord = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          cutoffMs: true,
          categoryStartTimes: true,
        },
      });

      if (!eventRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Event not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          cutoffMs: eventRecord.cutoffMs,
          categoryStartTimes: eventRecord.categoryStartTimes,
        }),
      };
    }

    // POST/PUT - Save timing rules for an event
    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing request body' }),
        };
      }

      const body = event.isBase64Encoded
        ? JSON.parse(Buffer.from(event.body, 'base64').toString())
        : JSON.parse(event.body);

      const { cutoffMs, categoryStartTimes } = body as TimingData;

      // Validate cutoffMs if provided
      if (cutoffMs !== null && cutoffMs !== undefined) {
        if (typeof cutoffMs !== 'number' || cutoffMs < 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'cutoffMs must be a positive number or null' }),
          };
        }
      }

      // Validate categoryStartTimes if provided
      if (categoryStartTimes !== null && categoryStartTimes !== undefined) {
        if (typeof categoryStartTimes !== 'object' || Array.isArray(categoryStartTimes)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'categoryStartTimes must be an object or null' }),
          };
        }
      }

      // Check if event exists
      const existingEvent = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!existingEvent) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Event not found' }),
        };
      }

      // Update event with timing data
      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: {
          cutoffMs: cutoffMs ?? null,
          categoryStartTimes: categoryStartTimes ?? null,
        },
        select: {
          id: true,
          cutoffMs: true,
          categoryStartTimes: true,
        },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          cutoffMs: updatedEvent.cutoffMs,
          categoryStartTimes: updatedEvent.categoryStartTimes,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error: any) {
    console.error('Timing API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
