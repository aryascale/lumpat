import { query } from '../src/lib/db';
import { getDefaultCategories, saveDefaultCategories, resetDefaultCategories } from '../src/lib/defaultCategories';
import { successResponse, errorResponse, parseBody, CORS_HEADERS } from '../src/lib/api-utils';

const DEFAULT_CATEGORIES = ['10K Laki-laki', '10K Perempuan', '5K Laki-Laki', '5K Perempuan'];

export default async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    const eventId = event.queryStringParameters?.eventId;
    const isDefault = !eventId || eventId === 'default';

    if (event.httpMethod === 'GET') {
      if (isDefault) {
        const categories = await getDefaultCategories();
        return successResponse({ categories });
      }

      const categories: any = await query(
        'SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC', [eventId]
      );
      return successResponse({ categories: categories.map((c: any) => ({ id: c.id, name: c.name, price: c.price || 0, order: c.order })) });
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = parseBody(event);
      if (!body) return errorResponse('Missing request body', 400);

      const { categories } = body;
      if (!Array.isArray(categories)) return errorResponse('categories must be an array', 400);
      if (categories.length === 0) return errorResponse('At least one category is required', 400);

      if (isDefault) {
        const saved = await saveDefaultCategories(categories);
        return successResponse({ categories: saved });
      }

      await query('DELETE FROM Category WHERE eventId = ?', [eventId]);
      for (let i = 0; i < categories.length; i++) {
        const cat = typeof categories[i] === 'string' ? { name: categories[i], price: 0 } : categories[i];
        await query(
          'INSERT INTO Category (id, name, eventId, `order`, price, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
          [crypto.randomUUID(), cat.name, eventId, i, cat.price || 0]
        );
      }

      const updated: any = await query(
        'SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC', [eventId]
      );
      return successResponse({ categories: updated.map((c: any) => ({ id: c.id, name: c.name, price: c.price || 0, order: c.order })) });
    }

    if (event.httpMethod === 'DELETE') {
      if (isDefault) {
        const categories = await resetDefaultCategories();
        return successResponse({ categories });
      }

      await query('DELETE FROM Category WHERE eventId = ?', [eventId]);
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        await query(
          'INSERT INTO Category (id, name, eventId, `order`, price, createdAt) VALUES (?, ?, ?, ?, 0, NOW())',
          [crypto.randomUUID(), DEFAULT_CATEGORIES[i], eventId, i]
        );
      }

      const cats: any = await query(
        'SELECT * FROM Category WHERE eventId = ? ORDER BY `order` ASC', [eventId]
      );
      return successResponse({ categories: cats.map((c: any) => c.name) });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('[CATEGORIES] Error:', error);
    return errorResponse(error.message || 'Internal server error');
  }
}
