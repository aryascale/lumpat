import { getCsvFileContent } from '../src/lib/fileStorage';

interface APIEvent {
  httpMethod: string;
  headers: { [key: string]: string };
  queryStringParameters?: { [key: string]: string };
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method tidak diizinkan' }),
    };
  }

  try {
    const kind = event.queryStringParameters?.kind;
    const eventId = event.queryStringParameters?.eventId || 'default';

    if (!kind || typeof kind !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Parameter kind tidak ditemukan',
        }),
      };
    }

    // Use eventId directly as folder name for consistency
    const eventFolderName = eventId;

    // Get CSV content from local filesystem
    const result = await getCsvFileContent(eventFolderName, kind as any);

    if (!result) {
      const optionalKinds = ['start', 'checkpoint'];
      if (optionalKinds.includes(kind)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ text: null, filename: null, updatedAt: null, url: null }),
        };
      }
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'CSV tidak ditemukan' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        text: result.text,
        filename: result.meta.filename,
        url: result.meta.url,
        updatedAt: result.meta.updatedAt,
      }),
    };
  } catch (error: any) {
    console.error('Get CSV error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Gagal mengambil CSV',
      }),
    };
  }
}
