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

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string;
  eventDate: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  gpxFile?: string;
  isActive: boolean;
  createdAt: number;
  categories: string[];
  cutoffMs?: number | null;
  categoryStartTimes?: Record<string, string> | null;
}

function formatEvent(event: any): Event {
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    description: event.description || '',
    eventDate: event.eventDate.toISOString(),
    location: event.location || '',
    latitude: event.latitude || undefined,
    longitude: event.longitude || undefined,
    status: event.status || 'upcoming',
    gpxFile: event.gpxFile || undefined,
    isActive: event.isActive,
    categories: event.categories.map((c: any) => c.name),
    createdAt: event.createdAt.getTime(),
    cutoffMs: event.cutoffMs ?? null,
    categoryStartTimes: event.categoryStartTimes ?? null,
  };
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function parseBody(event: APIEvent) {
  if (!event.body) return null;
  return event.isBase64Encoded
    ? JSON.parse(Buffer.from(event.body, 'base64').toString())
    : JSON.parse(event.body);
}

function resolveCoordinate(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  return parseFloat(value);
}

async function tryGeocode(location: string) {
  try {
    const { geocodeLocation } = await import('../src/lib/geocoding');
    return await geocodeLocation(location);
  } catch {
    return null;
  }
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  let slug = baseSlug;
  let counter = 1;
  let existing = await prisma.event.findUnique({ where: { slug } });

  while (existing) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    existing = await prisma.event.findUnique({ where: { slug } });
  }

  return slug;
}

export default async function handler(event: APIEvent): Promise<APIResponse> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const eventId = event.queryStringParameters?.eventId;

      if (eventId) {
        let record = await prisma.event.findUnique({
          where: { id: eventId },
          include: { categories: { orderBy: { order: 'asc' } } },
        });

        if (!record) {
          record = await prisma.event.findUnique({
            where: { slug: eventId },
            include: { categories: { orderBy: { order: 'asc' } } },
          });
        }

        if (!record) {
          return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Event not found' }) };
        }

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(formatEvent(record)) };
      }

      const events = await prisma.event.findMany({
        include: { categories: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(events.map(formatEvent)) };
    }

    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

      const { name, description, eventDate, location, latitude, longitude, isActive, categories } = body;
      if (!name || !eventDate) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Name and eventDate are required' }) };

      let finalLat = resolveCoordinate(latitude);
      let finalLon = resolveCoordinate(longitude);

      if ((finalLat === null || finalLon === null) && location?.trim()) {
        const coords = await tryGeocode(location);
        if (coords) {
          finalLat = finalLat ?? coords.latitude;
          finalLon = finalLon ?? coords.longitude;
        }
      }

      const slug = await generateUniqueSlug(name);
      const defaultCategories = categories || ['10K Laki-laki', '10K Perempuan', '5K Laki-Laki', '5K Perempuan'];

      const newEvent = await prisma.event.create({
        data: {
          name,
          slug,
          description,
          eventDate: new Date(eventDate),
          location,
          latitude: finalLat,
          longitude: finalLon,
          isActive: isActive !== undefined ? isActive : true,
          categories: {
            create: defaultCategories.map((name: string, order: number) => ({ name, order })),
          },
        },
        include: { categories: { orderBy: { order: 'asc' } } },
      });

      return { statusCode: 201, headers: CORS_HEADERS, body: JSON.stringify(formatEvent(newEvent)) };
    }

    if (event.httpMethod === 'PUT') {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'eventId is required' }) };

      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

      const { name, description, eventDate, location, latitude, longitude, isActive, status, gpxFile } = body;

      let finalLat = latitude !== undefined ? resolveCoordinate(latitude) : undefined;
      let finalLon = longitude !== undefined ? resolveCoordinate(longitude) : undefined;

      if (location !== undefined && finalLat === undefined && finalLon === undefined) {
        const currentEvent = await prisma.event.findUnique({
          where: { id: eventId },
          select: { location: true },
        });

        if (currentEvent && currentEvent.location !== location) {
          if (location?.trim()) {
            const coords = await tryGeocode(location);
            if (coords) {
              finalLat = coords.latitude;
              finalLon = coords.longitude;
            }
          } else {
            finalLat = null;
            finalLon = null;
          }
        }
      }

      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(eventDate && { eventDate: new Date(eventDate) }),
          ...(location !== undefined && { location }),
          ...(finalLat !== undefined && { latitude: finalLat }),
          ...(finalLon !== undefined && { longitude: finalLon }),
          ...(isActive !== undefined && { isActive }),
          ...(status !== undefined && { status }),
          ...(gpxFile !== undefined && { gpxFile }),
        },
        include: { categories: { orderBy: { order: 'asc' } } },
      });

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(formatEvent(updatedEvent)) };
    }

    if (event.httpMethod === 'DELETE') {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'eventId is required' }) };

      await prisma.event.delete({ where: { id: eventId } });
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error: any) {
    console.error('Events API error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
}
