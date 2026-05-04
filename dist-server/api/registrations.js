import { query } from '../src/lib/db';
import { verifyToken } from '../src/lib/jwt';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';
export default async function handler(req) {
    if (req.httpMethod === 'OPTIONS')
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    try {
        if (req.httpMethod === 'GET') {
            const eventId = req.queryStringParameters?.eventId;
            if (!eventId)
                return errorResponse('eventId is required', 400);
            const registrations = await query(`SELECT er.id, er.status, er.createdAt,
                u.id as userId, u.name as userName, u.username as userUsername,
                c.id as categoryId, c.name as categoryName
         FROM EventRegistration er
         JOIN User u ON er.userId = u.id
         JOIN Category c ON er.categoryId = c.id
         WHERE er.eventId = ?
         ORDER BY er.createdAt DESC`, [eventId]);
            const participants = registrations.map((r) => ({
                id: r.id,
                user: { id: r.userId, name: r.userName, username: r.userUsername },
                category: { id: r.categoryId, name: r.categoryName },
                status: r.status,
                createdAt: r.createdAt,
            }));
            return successResponse({ participants });
        }
        if (req.httpMethod === 'POST') {
            const token = req.cookies?.token;
            if (!token)
                return errorResponse('Unauthorized', 401);
            const decoded = verifyToken(token);
            if (!decoded || !decoded.id)
                return errorResponse('Invalid token', 401);
            const { eventId, categoryId } = parseBody(req);
            if (!eventId || !categoryId)
                return errorResponse('eventId and categoryId are required', 400);
            const users = await query('SELECT id, isPhoneVerified FROM User WHERE id = ? LIMIT 1', [decoded.id]);
            if (users.length === 0)
                return errorResponse('User not found', 404);
            if (!users[0].isPhoneVerified) {
                return errorResponse('Please verify your phone number first', 403);
            }
            const existingReg = await query('SELECT id FROM EventRegistration WHERE userId = ? AND eventId = ? LIMIT 1', [decoded.id, eventId]);
            if (existingReg.length > 0)
                return errorResponse('You are already registered for this event', 400);
            const regId = crypto.randomUUID();
            await query('INSERT INTO EventRegistration (id, userId, eventId, categoryId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [regId, decoded.id, eventId, categoryId, 'registered']);
            const regs = await query('SELECT * FROM EventRegistration WHERE id = ? LIMIT 1', [regId]);
            return successResponse({ registration: regs[0] }, 201);
        }
        return errorResponse('Method not allowed', 405);
    }
    catch (error) {
        console.error('[REGISTRATIONS] Error:', error);
        return errorResponse(error.message || 'Internal server error');
    }
}
