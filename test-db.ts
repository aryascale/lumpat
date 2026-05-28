import { query } from './src/lib/db.ts';
(async () => {
  const events = await query('SELECT slug, content FROM Event WHERE slug = "fun-walk-perayaan-hari-bpr-bprs-nasional" OR slug LIKE "fun-walk%" LIMIT 1');
  console.log("content type:", typeof (events as any)[0].content);
  console.log("content value:", (events as any)[0].content);
  process.exit(0);
})();
