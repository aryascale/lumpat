import { query } from '../src/lib/db';
import { uploadFile } from '../src/lib/fileStorage';
import { successResponse, errorResponse, parseMultipart, CORS_HEADERS } from '../src/lib/api-utils';

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) return errorResponse('Content-Type must be multipart/form-data', 400);

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return errorResponse('Missing boundary', 400);
    if (!event.body) return errorResponse('Missing request body', 400);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const { file, fields } = parseMultipart(body, boundary);
    if (!file) return errorResponse('No file uploaded', 400);

    const eventId = fields.eventId;
    if (!eventId) return errorResponse('eventId is required', 400);

    const targetField = fields.field;
    if (targetField !== 'logo' && targetField !== 'banner') {
      return errorResponse('Invalid field type, must be "logo" or "banner"', 400);
    }

    const result = await uploadFile(eventId, file.data, file.name, 'images');
    const updateColumn = targetField === 'logo' ? 'logoUrl' : 'bannerUrl';

    await query(
      `UPDATE Event SET ${updateColumn} = ?, updatedAt = NOW() WHERE id = ?`,
      [result.url, eventId]
    );

    const updatedEvent: any = await query('SELECT * FROM Event WHERE id = ? LIMIT 1', [eventId]);

    return successResponse({ ...result, event: updatedEvent[0] });
  } catch (error: any) {
    console.error('[UPLOAD-EVENT-MEDIA] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
