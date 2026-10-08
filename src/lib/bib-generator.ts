import { pool, query } from './db';

export async function assignAutoBibsIfEnabled(orderId: string): Promise<void> {
  const registrations: any = await query(
    `SELECT er.id, er.eventId, er.categoryId, e.content as eventContent
     FROM EventRegistration er
     JOIN Event e ON er.eventId = e.id
     WHERE er.orderId = ? AND (er.bibNumber IS NULL OR er.bibNumber = '')`,
    [orderId]
  );

  if (!registrations || registrations.length === 0) return;

  const eventIds = [...new Set(registrations.map((r: any) => r.eventId))];

  // One connection for the whole assignment: GET_LOCK/RELEASE_LOCK are
  // per-connection, so acquiring and releasing must share it.
  const conn = await pool.getConnection();
  try {
    for (const eventId of eventIds) {
      const regsForEvent = registrations.filter((r: any) => r.eventId === eventId);
      if (regsForEvent.length === 0) continue;

      let content: any = {};
      try {
        content = typeof regsForEvent[0].eventContent === 'string'
          ? JSON.parse(regsForEvent[0].eventContent)
          : (regsForEvent[0].eventContent || {});
      } catch (e) {
        console.error('[BIB_GEN] Error parsing event content', e);
      }

      if (!content.autoGenerateBibs?.enabled) continue;

      for (const reg of regsForEvent) {
        const categoryId = reg.categoryId;
        const configuredStartStr = content.autoGenerateBibs.categories?.[categoryId];

        if (!configuredStartStr || String(configuredStartStr).trim() === '') continue;

        // MAX+1 read across concurrent orders hands out the same number twice.
        // GET_LOCK serializes assignments per event+category; 10s wait is plenty
        // at this scale (ponytail: per-registration lock churn is fine, it is
        // held for two queries).
        const lockKey = `bib:${eventId}:${categoryId}`;
        const [lockRes]: any = await conn.query('SELECT GET_LOCK(?, 10) AS ok', [lockKey]);
        if (lockRes?.[0]?.ok !== 1) {
          console.warn(`[BIB_GEN] Could not acquire lock ${lockKey} — skipping ${reg.id}`);
          continue;
        }
        try {
          const [maxRes]: any = await conn.query(
            `SELECT MAX(CAST(bibNumber AS UNSIGNED)) as maxBib
             FROM EventRegistration
             WHERE eventId = ? AND categoryId = ? AND bibNumber IS NOT NULL AND bibNumber != ''`,
            [eventId, categoryId]
          );

          let nextBibInt = parseInt(String(configuredStartStr).trim(), 10);

          if (maxRes && maxRes.length > 0 && maxRes[0].maxBib !== null) {
            const currentMax = parseInt(maxRes[0].maxBib, 10);
            if (!isNaN(currentMax) && currentMax >= nextBibInt) {
              nextBibInt = currentMax + 1;
            }
          }

          await conn.query(
            `UPDATE EventRegistration SET bibNumber = ?, updatedAt = NOW() WHERE id = ?`,
            [nextBibInt.toString(), reg.id]
          );
        } finally {
          await conn.query('SELECT RELEASE_LOCK(?)', [lockKey]);
        }
      }
    }
  } finally {
    conn.release();
  }
}
