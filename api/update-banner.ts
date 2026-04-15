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

export default async function handler(event: APIEvent): Promise<APIResponse> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
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

    const { bannerId, isActive } = body;

    if (!bannerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'bannerId is required' }),
      };
    }

    if (typeof isActive !== 'boolean') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'isActive is required (boolean)' }),
      };
    }

    const banner = await prisma.banner.update({
      where: { id: bannerId },
      data: { isActive },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(banner),
    };
  } catch (error: any) {
    console.error('Update banner error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
