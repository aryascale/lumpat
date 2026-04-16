import prisma from '../src/lib/prisma.js';
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
export default async function handler(event) {
    if (event.httpMethod === 'OPTIONS')
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    if (event.httpMethod !== 'POST')
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    try {
        if (!event.body)
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing request body' }) };
        const body = event.isBase64Encoded
            ? JSON.parse(Buffer.from(event.body, 'base64').toString())
            : JSON.parse(event.body);
        const { bannerId, isActive } = body;
        if (!bannerId)
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'bannerId is required' }) };
        if (typeof isActive !== 'boolean')
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'isActive is required (boolean)' }) };
        const banner = await prisma.banner.update({
            where: { id: bannerId },
            data: { isActive },
        });
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(banner) };
    }
    catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
    }
}
