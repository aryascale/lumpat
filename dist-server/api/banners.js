import prisma from '../src/lib/prisma.js';
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
export default async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    try {
        const eventId = event.queryStringParameters?.eventId;
        const where = eventId ? { eventId } : {};
        const banners = await prisma.banner.findMany({
            where,
            orderBy: { order: 'asc' },
        });
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(banners) };
    }
    catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
    }
}
