import { query } from '../src/lib/db';
import { verifyToken } from '../src/lib/jwt';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
export default async function handler(req) {
    if (req.httpMethod === 'OPTIONS')
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    if (req.httpMethod !== 'PUT')
        return errorResponse('Method not allowed', 405);
    try {
        const token = req.cookies?.token;
        if (!token)
            return errorResponse('Unauthorized', 401);
        const payload = verifyToken(token);
        if (!payload || !payload.id)
            return errorResponse('Invalid token', 401);
        const { username, name } = parseBody(req);
        const fields = [];
        const values = [];
        if (username !== undefined) {
            fields.push('username = ?');
            values.push(username);
        }
        if (name !== undefined) {
            fields.push('name = ?');
            values.push(name);
        }
        if (fields.length === 0)
            return errorResponse('No fields to update', 400);
        fields.push('updatedAt = NOW()');
        values.push(payload.id);
        await query(`UPDATE User SET ${fields.join(', ')} WHERE id = ?`, values);
        const users = await query('SELECT id, username, name, email FROM User WHERE id = ? LIMIT 1', [payload.id]);
        return successResponse({ message: 'Profile updated successfully', user: users[0] });
    }
    catch (error) {
        console.error('[PROFILE] Update error:', error);
        return errorResponse(error.message || 'Internal server error');
    }
}
