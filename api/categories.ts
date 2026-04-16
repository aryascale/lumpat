import prisma from '../src/lib/prisma';
import { getDefaultCategories, saveDefaultCategories, resetDefaultCategories } from '../src/lib/defaultCategories';

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

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT_CATEGORIES = ['10K Laki-laki', '10K Perempuan', '5K Laki-Laki', '5K Perempuan'];

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
    const isDefault = !eventId || eventId === 'default';

    if (event.httpMethod === 'GET') {
      if (isDefault) {
        const categories = await getDefaultCategories();
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories }) };
      }

      const categories = await prisma.category.findMany({
        where: { eventId },
        orderBy: { order: 'asc' },
      });

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories: categories.map((c: any) => c.name) }) };
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };

      const { categories } = body;
      if (!Array.isArray(categories)) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'categories must be an array' }) };
      if (categories.length === 0) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'At least one category is required' }) };

      if (isDefault) {
        const saved = await saveDefaultCategories(categories);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories: saved }) };
      }

      await prisma.category.deleteMany({ where: { eventId } });
      await prisma.category.createMany({
        data: categories.map((name: string, order: number) => ({ eventId, name, order })),
      });

      const updated = await prisma.category.findMany({
        where: { eventId },
        orderBy: { order: 'asc' },
      });

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories: updated.map((c: any) => c.name) }) };
    }

    if (event.httpMethod === 'DELETE') {
      if (isDefault) {
        const categories = await resetDefaultCategories();
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories }) };
      }

      await prisma.category.deleteMany({ where: { eventId } });
      await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((name, order) => ({ eventId, name, order })),
      });

      const categories = await prisma.category.findMany({
        where: { eventId },
        orderBy: { order: 'asc' },
      });

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ categories: categories.map((c: any) => c.name) }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error: any) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
}
