import { query, pool } from './src/lib/db.js';

function getRandomMs() {
  let msStr;
  while (true) {
    const ms = Math.floor(Math.random() * 999) + 1; // 1 to 999
    msStr = String(ms).padStart(3, "0");
    // Hindari angka urut/kembar supaya tidak terlihat aneh
    const badPatterns = ["123", "234", "345", "456", "567", "678", "789", "321", "432", "543", "654", "765", "876", "987", "111", "222", "333", "444", "555", "666", "777", "888", "999", "000"];
    if (!badPatterns.includes(msStr)) {
      break;
    }
  }
  return msStr;
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
