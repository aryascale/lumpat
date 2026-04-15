import { listCsvMetadata } from '../src/lib/fileStorage';
import path from 'node:path';
import fs from 'node:fs';

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
    const eventId = event.queryStringParameters?.eventId || 'default';

    // Use eventId directly as folder name for consistency
    const eventFolderName = eventId;

    // Debug: log paths
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const csvDir = path.join(uploadDir, 'events', eventFolderName, 'csv');
    const metaPath = path.join(csvDir, '_meta.json');
    
    console.log('[csv-list] eventId:', eventId);
    console.log('[csv-list] uploadDir:', uploadDir);
    console.log('[csv-list] csvDir:', csvDir);
    console.log('[csv-list] metaPath:', metaPath);
    console.log('[csv-list] metaPath exists:', fs.existsSync(metaPath));

    // Get CSV metadata from local filesystem
    const metaList = await listCsvMetadata(eventFolderName);
    console.log('[csv-list] metaList:', metaList);

    // Transform to expected format
    const result = metaList.map(meta => ({
      key: meta.kind,
      filename: meta.filename,
      updatedAt: meta.updatedAt,
      rows: meta.rows,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('List CSV error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Gagal mengambil daftar CSV',
      }),
    };
  }
}
