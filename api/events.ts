import { query } from '../src/lib/db';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

function formatEvent(event: any) {
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    description: event.description || '',
    eventDate: event.eventDate instanceof Date ? event.eventDate.toISOString() : event.eventDate,
    location: event.location || '',
    latitude: event.latitude || undefined,
    longitude: event.longitude || undefined,
    status: event.status || 'upcoming',
    gpxFile: event.gpxFile || undefined,
    logoUrl: event.logoUrl || undefined,
    bannerUrl: event.bannerUrl || undefined,
    tshirtSizes: event.tshirtSizes || null,
    bibCustomPrice: event.bibCustomPrice || 0,
    isActive: !!event.isActive,
    categories: event._categories || [],
    createdAt: event.createdAt instanceof Date ? event.createdAt.getTime() : event.createdAt,
  };
}

export default async function handler(req: any) {
  if (req.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    const eventId = req.queryStringParameters?.eventId;

    if (req.httpMethod === 'GET') {
      if (eventId) {
        const events: any = await query(
          'SELECT * FROM Event WHERE id = ? OR slug = ? LIMIT 1',
          [eventId, eventId]
        );
        if (events.length === 0) return errorResponse('Event not found', 404);

        const categories: any = await query(
          'SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC',
          [events[0].id]
        );
        events[0]._categories = categories.map((c: any) => c.name);
        return successResponse(formatEvent(events[0]));
      }

      const events: any = await query(
        'SELECT * FROM Event ORDER BY createdAt DESC'
      );

      if (events.length > 0) {
        const eventIds = events.map((e: any) => e.id);
        const placeholders = eventIds.map(() => '?').join(',');
        const categories: any = await query(
          `SELECT eventId, name FROM Category WHERE eventId IN (${placeholders}) ORDER BY \`order\` ASC`,
          eventIds
        );
        
        const catMap = new Map();
        categories.forEach((c: any) => {
          if (!catMap.has(c.eventId)) catMap.set(c.eventId, []);
          catMap.get(c.eventId).push(c.name);
        });

        for (const event of events) {
          event._categories = catMap.get(event.id) || [];
        }
      }

      return successResponse(events.map(formatEvent));
    }

    if (req.httpMethod === 'POST') {
      const { name, description, eventDate, location, latitude, longitude, isActive, categories } = parseBody(req);
      if (!name || !eventDate) return errorResponse('Name and eventDate are required', 400);

      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = baseSlug;
      let counter = 1;
      let existing: any = await query('SELECT id FROM Event WHERE slug = ? LIMIT 1', [slug]);
      while (existing.length > 0) {
        slug = `${baseSlug}-${counter++}`;
        existing = await query('SELECT id FROM Event WHERE slug = ? LIMIT 1', [slug]);
      }

      const eventIdNew = crypto.randomUUID();
      await query(
        'INSERT INTO Event (id, name, slug, description, eventDate, location, latitude, longitude, isActive, status, logoUrl, bannerUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [eventIdNew, name, slug, description || null, new Date(eventDate), location || null, latitude || null, longitude || null, isActive ?? true, 'upcoming', null, null]
      );

      const defaultCategories = categories || ['10K Laki-laki', '10K Perempuan', '5K Laki-Laki', '5K Perempuan'];
      for (let i = 0; i < defaultCategories.length; i++) {
        await query(
          'INSERT INTO Category (id, name, eventId, `order`, createdAt) VALUES (?, ?, ?, ?, NOW())',
          [crypto.randomUUID(), defaultCategories[i], eventIdNew, i]
        );
      }

      const created: any = await query('SELECT * FROM Event WHERE id = ? LIMIT 1', [eventIdNew]);
      const cats: any = await query('SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC', [eventIdNew]);
      created[0]._categories = cats.map((c: any) => c.name);

      return successResponse(formatEvent(created[0]), 201);
    }

    if (req.httpMethod === 'PUT') {
      if (!eventId) return errorResponse('eventId is required', 400);
      const body = parseBody(req);

      const fields: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
      if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
      if (body.eventDate !== undefined) { fields.push('eventDate = ?'); values.push(new Date(body.eventDate)); }
      if (body.location !== undefined) { fields.push('location = ?'); values.push(body.location); }
      if (body.latitude !== undefined) { fields.push('latitude = ?'); values.push(body.latitude); }
      if (body.longitude !== undefined) { fields.push('longitude = ?'); values.push(body.longitude); }
      if (body.isActive !== undefined) { fields.push('isActive = ?'); values.push(body.isActive); }
      if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
      if (body.logoUrl !== undefined) { fields.push('logoUrl = ?'); values.push(body.logoUrl); }
      if (body.bannerUrl !== undefined) { fields.push('bannerUrl = ?'); values.push(body.bannerUrl); }
      if (body.cutoffMs !== undefined) { fields.push('cutoffMs = ?'); values.push(body.cutoffMs); }
      if (body.categoryStartTimes !== undefined) { fields.push('categoryStartTimes = ?'); values.push(JSON.stringify(body.categoryStartTimes)); }
      if (body.tshirtSizes !== undefined) { fields.push('tshirtSizes = ?'); values.push(body.tshirtSizes); }
      if (body.bibCustomPrice !== undefined) { fields.push('bibCustomPrice = ?'); values.push(body.bibCustomPrice); }

      fields.push('updatedAt = NOW()');
      values.push(eventId);

      await query(`UPDATE Event SET ${fields.join(', ')} WHERE id = ?`, values);

      const updated: any = await query('SELECT * FROM Event WHERE id = ? LIMIT 1', [eventId]);
      const cats: any = await query('SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC', [eventId]);
      updated[0]._categories = cats.map((c: any) => c.name);

      return successResponse(formatEvent(updated[0]));
    }

    if (req.httpMethod === 'DELETE') {
      if (!eventId) return errorResponse('eventId is required', 400);
      await query('DELETE FROM Category WHERE eventId = ?', [eventId]);
      await query('DELETE FROM Banner WHERE eventId = ?', [eventId]);
      await query('DELETE FROM EventRegistration WHERE eventId = ?', [eventId]);
      await query('DELETE FROM Event WHERE id = ?', [eventId]);
      return successResponse({ success: true });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[EVENTS] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
