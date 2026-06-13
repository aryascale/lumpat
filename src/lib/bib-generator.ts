import { query } from './db';

export async function assignAutoBibsIfEnabled(orderId: string): Promise<void> {
  // 1. Fetch all registrations for this order
  const registrations: any = await query(
    `SELECT er.id, er.eventId, er.categoryId, e.content as eventContent
     FROM EventRegistration er
     JOIN Event e ON er.eventId = e.id
     WHERE er.orderId = ? AND (er.bibNumber IS NULL OR er.bibNumber = '')`,
    [orderId]
  );

  if (!registrations || registrations.length === 0) return;

  // Process event by event (though usually it's one event per order)
  const eventIds = [...new Set(registrations.map((r: any) => r.eventId))];

  for (const eventId of eventIds) {
    const regsForEvent = registrations.filter((r: any) => r.eventId === eventId);
    if (regsForEvent.length === 0) continue;

    // Parse event content
    let content: any = {};
    try {
      content = typeof regsForEvent[0].eventContent === 'string' 
        ? JSON.parse(regsForEvent[0].eventContent) 
        : (regsForEvent[0].eventContent || {});
    } catch (e) {
      console.error('[BIB_GEN] Error parsing event content', e);
    }

    if (!content.autoGenerateBibs?.enabled) {
      continue; // Auto generate is disabled for this event
    }

    // Process each registration sequentially to prevent race conditions within the same order
    for (const reg of regsForEvent) {
      const categoryId = reg.categoryId;
      const configuredStartStr = content.autoGenerateBibs.categories?.[categoryId];
      
      if (!configuredStartStr) continue; // No start number configured for this category

      // Fetch the max bib number currently assigned for this event & category
      // We'll cast to UNSIGNED to find the numeric maximum
      const maxRes: any = await query(
        `SELECT MAX(CAST(bibNumber AS UNSIGNED)) as maxBib
         FROM EventRegistration
         WHERE eventId = ? AND categoryId = ? AND bibNumber IS NOT NULL AND bibNumber != ''`,
        [eventId, categoryId]
      );

      let nextBibInt = parseInt(configuredStartStr, 10);
      
      if (maxRes && maxRes.length > 0 && maxRes[0].maxBib !== null) {
        const currentMax = parseInt(maxRes[0].maxBib, 10);
        if (!isNaN(currentMax) && currentMax >= nextBibInt) {
          nextBibInt = currentMax + 1;
        }
      }

      const nextBibString = nextBibInt.toString();

      // Update the DB
      await query(
        `UPDATE EventRegistration SET bibNumber = ?, updatedAt = NOW() WHERE id = ?`,
        [nextBibString, reg.id]
      );
      
      // We MUST ensure the next query in the loop sees this update, 
      // but since we compute max dynamically in the DB, as long as it's sequential, it should be fine.
      // However, to be absolutely safe against concurrent midtrans webhooks, we could use a transaction, 
      // but our `query` helper doesn't support transactions easily. Sequential execution here is usually enough 
      // for bulk registrations in the same order.
    }
  }
}
