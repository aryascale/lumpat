import { uploadCsvFile } from '../src/lib/fileStorage';

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
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method tidak diizinkan' }),
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
      ? JSON.parse(Buffer.from(event.body as string, 'base64').toString())
      : JSON.parse(event.body);

    const { kind, filename, rows, eventId, content } = body;

    const effectiveEventId = eventId || 'default';

    // Use eventId directly as folder name for consistency
    const eventFolderName = effectiveEventId;

    const validKinds = ['master', 'start', 'finish', 'checkpoint'];

    if (!kind || !validKinds.includes(kind)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Parameter kind harus salah satu dari: ${validKinds.join(', ')}`,
        }),
      };
    }

    // Upload to local filesystem
    const result = await uploadCsvFile(
      eventFolderName,
      kind,
      content || '',
      filename,
      rows || 0
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        kind,
        filename: result.filename,
        url: result.url,
        downloadUrl: result.url,
        rows: result.rows,
        updatedAt: result.updatedAt,
        path: result.path,
      }),
    };
  } catch (error: any) {
    console.error('Upload CSV error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Gagal memproses upload CSV',
      }),
    };
  }
}
