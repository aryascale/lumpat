import { deleteCsvFileFromStorage } from '../src/lib/fileStorage';

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
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
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

    // Delete CSV from local filesystem
    await deleteCsvFileFromStorage(eventFolderName, kind as any);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    console.error('Delete CSV error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Gagal menghapus CSV',
      }),
    };
  }
}
