import { query } from '../src/lib/db';
import { successResponse, errorResponse, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  
  const name = event.queryStringParameters?.name;
  if (!name) return errorResponse('Name is required', 400);

  try {
    const nameWithSpaces = name.replace(/-/g, ' ');

    const registrations: any = await query(`
      SELECT r.*, c.name as categoryName, c.distanceKm, e.name as eventName, e.id as eventId, e.timezoneOffset
      FROM EventRegistration r
      JOIN Category c ON r.categoryId = c.id
      JOIN Event e ON r.eventId = e.id
      WHERE LOWER(r.name) = LOWER(?) OR LOWER(REPLACE(r.name, ' ', '-')) = LOWER(?)
      ORDER BY r.createdAt DESC
      LIMIT 1
    `, [nameWithSpaces, name]);

    if (registrations.length === 0) {
      return errorResponse('Participant not found', 404);
    }
    
    const reg = registrations[0];
    const eventId = reg.eventId;
    
    // We can just return the eventId and basic data, and let the frontend use loadMasterParticipants and useLiveTiming.
    // Wait, useLiveTiming needs eventId. If we return eventId, the frontend can load everything just like EventPage does!
    // And then we can just compute the exact same way as EventPage.
    
    return successResponse({
      eventId: reg.eventId,
      eventName: reg.eventName,
      bib: reg.bibNumber || reg.bibName,
      name: reg.name,
      category: reg.categoryName,
      gender: reg.gender,
      distanceKm: reg.distanceKm,
      timezoneOffset: reg.timezoneOffset
    });
  } catch (error: any) {
    console.error('Participant API Error:', error);
    return errorResponse('Internal server error', 500);
  }
}
