import prisma from '../src/lib/prisma.js';
import { deleteFileByUrl } from '../src/lib/fileStorage.js';
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
export default async function handler(event) {
    if (event.httpMethod === 'OPTIONS')
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    if (event.httpMethod !== 'DELETE')
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    try {
        const bannerId = event.queryStringParameters?.bannerId;
        const imageUrl = event.queryStringParameters?.imageUrl;
        if (!bannerId)
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'bannerId is required' }) };
        if (!imageUrl)
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'imageUrl is required' }) };
        const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
        if (!banner)
            return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Banner not found' }) };
        await prisma.banner.delete({ where: { id: bannerId } });
        try {
            await deleteFileByUrl(imageUrl);
        }
        catch { }
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
    }
    catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
    }
}
