// Pure helpers — no DB import (tests run without a database).

export function slugCategory(name: string): string {
  const slug = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (slug || 'EVENT').slice(0, 12);
}

export function formatWibTimestamp(now: Date = new Date()): string {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)) {
    parts[p.type] = p.value;
  }
  const hh = parts.hour === '24' ? '00' : parts.hour; // id-ID may render midnight as 24
  return `${hh}${parts.minute}${parts.day}${parts.month}${parts.year}`;
}

export function buildOrderId(categoryName: string, now: Date = new Date()): string {
  const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `LMPT-${slugCategory(categoryName)}-${formatWibTimestamp(now)}-${rand}`;
}
