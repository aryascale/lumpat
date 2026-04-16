import { listCsvMetadata } from '../src/lib/fileStorage.js';
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
export default async function handler(event) {
    if (event.httpMethod === 'OPTIONS')
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    if (event.httpMethod !== 'GET')
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    try {
        const eventId = event.queryStringParameters?.eventId || 'default';
        const metaList = await listCsvMetadata(eventId);
        const result = metaList.map(meta => ({
            key: meta.kind,
            filename: meta.filename,
            updatedAt: meta.updatedAt,
            rows: meta.rows,
        }));
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
    }
    catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Failed to list CSV' }) };
    }
}
