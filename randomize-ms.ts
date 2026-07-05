import { query, pool } from './src/lib/db.js';

function getRandomMs() {
  const ms = Math.floor(Math.random() * 999) + 1; // 1 to 999
  return String(ms).padStart(3, "0");
}

async function run() {
  try {
    let count = 0;
    
    // Update ManualStart
    const starts = await query(`SELECT id, timeStr FROM ManualStart`);
    for (const s of starts) {
      if (s.timeStr.length === 8) { // format HH:MM:SS
        const newTime = `${s.timeStr}.${getRandomMs()}`;
        await query(`UPDATE ManualStart SET timeStr = ? WHERE id = ?`, [newTime, s.id]);
        console.log(`Updated start ${s.id}: ${s.timeStr} -> ${newTime}`);
        count++;
      } else if (s.timeStr.endsWith(".000")) {
        const newTime = `${s.timeStr.slice(0, 8)}.${getRandomMs()}`;
        await query(`UPDATE ManualStart SET timeStr = ? WHERE id = ?`, [newTime, s.id]);
        console.log(`Updated start ${s.id}: ${s.timeStr} -> ${newTime}`);
        count++;
      }
    }
    
    
    console.log(`Done. Updated ${count} records with random milliseconds.`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
