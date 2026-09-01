import 'dotenv/config';
import { query } from '../src/lib/db.js';
import bcrypt from 'bcryptjs';

/**
 * Dev seeder — fills the local database with everything needed to test
 * the admin platform end-to-end. Idempotent (fixed IDs + upserts).
 *
 * Run after `docker compose -f docker/docker-compose.yml up -d` and
 * `npm run prisma:push`. Then verify with `npm run smoke`.
 */

// Fixed IDs so re-running the seeder updates instead of duplicating.
const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';
const CAT_5K = 'c0000000-0000-4000-8000-000000000001';
const CAT_21K = 'c0000000-0000-4000-8000-000000000002';
const REG_BUDI = 'r0000000-0000-4000-8000-000000000001';
const REG_SARI = 'r0000000-0000-4000-8000-000000000002';
const REG_JOKO = 'r0000000-0000-4000-8000-000000000003';

const accounts = [
  { email: 'super_admin@lumpat.co.id', username: 'superadmin', password: 'Admin123!', name: 'Super Admin', role: 'super_admin' },
  { email: 'event_admin@lumpat.co.id', username: 'eventadmin', password: 'Event123!', name: 'Event Admin', role: 'event_admin' },
  { email: 'scan_admin@lumpat.co.id', username: 'scanadmin', password: 'Scan123!', name: 'Scan Admin', role: 'scan_admin' },
  { email: 'payment_admin@lumpat.co.id', username: 'paymentadmin', password: 'Payment123!', name: 'Payment Admin', role: 'payment_admin' },
  { email: 'user@example.com', username: 'regularuser', password: 'User123!', name: 'Regular User', role: 'user' },
] as const;

async function seedUsers() {
  for (const account of accounts) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    const userId = `u0000000-0000-4000-8000-${account.role.padEnd(12, '0').slice(0, 12)}`;
    await query(
      `INSERT INTO User (id, email, username, password, name, role, isEmailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         password = VALUES(password), name = VALUES(name), role = VALUES(role),
         isEmailVerified = true, updatedAt = NOW()`,
      [userId, account.email, account.username, hashedPassword, account.name, account.role]
    );
    console.log(`✅ User ${account.role}: ${account.email} / ${account.password}`);
  }
}

async function seedEvent() {
  const eventDate = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  await query(
    `INSERT INTO Event (id, name, slug, description, eventType, eventDate, location, status, isActive,
       timezoneOffset, bibCustomPrice, tshirtSizes, isDraft, isDeleted, content, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'Running', ?, ?, 'upcoming', true, 7, 50000, 'S,M,L,XL', false, false, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       eventDate = VALUES(eventDate), content = VALUES(content), status = 'upcoming', updatedAt = NOW()`,
    [
      EVENT_ID,
      'Lumpat Fun Run 2026',
      'lumpat-fun-run-2026',
      'Event dummy untuk test lokal admin platform lumpat.',
      eventDate,
      'Jakarta',
      JSON.stringify({ enableRegisteredScan: true }),
    ]
  );
  console.log('✅ Event: Lumpat Fun Run 2026 (slug lumpat-fun-run-2026)');

  await query(
    `INSERT INTO Category (id, name, eventId, \`order\`, price, quota, distanceKm, createdAt)
     VALUES (?, 'Fun Run 5K', ?, 1, 150000, 100, 5, NOW())
     ON DUPLICATE KEY UPDATE price = VALUES(price), quota = VALUES(quota)`,
    [CAT_5K, EVENT_ID]
  );
  await query(
    `INSERT INTO Category (id, name, eventId, \`order\`, price, quota, distanceKm, createdAt)
     VALUES (?, 'Half Marathon 21K', ?, 2, 350000, 50, 21, NOW())
     ON DUPLICATE KEY UPDATE price = VALUES(price), quota = VALUES(quota)`,
    [CAT_21K, EVENT_ID]
  );
  console.log('✅ Categories: Fun Run 5K (150k), Half Marathon 21K (350k)');
}

async function seedRegistrations() {
  const rows: Array<[string, string, string, string, string, string, string, string | null, number, string, number | null, string | null]> = [
    // id, name, email, phone, gender, categoryId, paymentStatus, bibNumber, grossAmount, orderId, paidAt offset days, bibName
    [REG_BUDI, 'Budi Santoso', 'budi@example.com', '081200000001', 'M', CAT_5K, 'settlement', '1001', 150000, 'ORD-DEV-1001', 2, null],
    [REG_SARI, 'Sari Dewi', 'sari@example.com', '081200000002', 'F', CAT_21K, 'settlement', '1002', 350000, 'ORD-DEV-1002', 1, 'SARI'],
    [REG_JOKO, 'Joko Pending', 'joko@example.com', '081200000003', 'M', CAT_5K, 'pending', null, 150000, 'ORD-DEV-1003', null, null],
  ];
  for (const [id, name, email, phone, gender, categoryId, paymentStatus, bibNumber, grossAmount, orderId, paidDaysAgo, bibName] of rows) {
    const paidAt = paidDaysAgo ? new Date(Date.now() - paidDaysAgo * 24 * 3600 * 1000) : null;
    await query(
      `INSERT INTO EventRegistration
         (id, eventId, categoryId, name, email, phoneNumber, gender, tshirtSize, bibName, bibNumber,
          bloodType, orderId, grossAmount, paymentStatus, paymentMethod, paidAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'M', ?, ?, 'O', ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         paymentStatus = VALUES(paymentStatus), bibNumber = VALUES(bibNumber), paidAt = VALUES(paidAt), updatedAt = NOW()`,
      [id, EVENT_ID, categoryId, name, email, phone, gender, bibName, bibNumber, orderId, grossAmount, paymentStatus, paymentStatus === 'settlement' ? 'qris' : null, paidAt]
    );
    console.log(`✅ Registration: ${name} (${paymentStatus}${bibNumber ? `, BIB ${bibNumber}` : ''})`);
  }
}

async function seedSupportTickets() {
  const tickets = [
    { id: 's0000000-0000-4000-8000-000000000001', num: 'LMPT-202609-DEV1', name: 'Budi Santoso', email: 'budi@example.com', phone: '081200000001', category: 'payment', subject: 'Pembayaran belum terkonfirmasi', desc: 'Saya sudah bayar tapi status masih pending.', status: 'open', priority: 'high' },
    { id: 's0000000-0000-4000-8000-000000000002', num: 'LMPT-202609-DEV2', name: 'Sari Dewi', email: 'sari@example.com', phone: '081200000002', category: 'registration', subject: 'Salah ukuran kaos', desc: 'Minta ganti ukuran kaos dari M ke L.', status: 'in_progress', priority: 'medium' },
    { id: 's0000000-0000-4000-8000-000000000003', num: 'LMPT-202609-DEV3', name: 'Joko Pending', email: 'joko@example.com', phone: null, category: 'general', subject: 'Tanya jadwal race pack', desc: 'Race pack bisa diambil kapan saja?', status: 'resolved', priority: 'low' },
  ];
  for (const t of tickets) {
    await query(
      `INSERT INTO SupportTicket (id, eventId, ticketNumber, name, email, phoneNumber, category, subject, description,
         status, priority, resolvedAt, resolvedBy, resolutionNotes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status), priority = VALUES(priority), updatedAt = NOW()`,
      [
        t.id, EVENT_ID, t.num, t.name, t.email, t.phone, t.category, t.subject, t.desc,
        t.status, t.priority,
        t.status === 'resolved' ? new Date() : null,
        t.status === 'resolved' ? 'super_admin@lumpat.co.id' : null,
        t.status === 'resolved' ? 'Race pack dapat diambil H-2 sampai H-1 event.' : null,
      ]
    );
    console.log(`✅ SupportTicket: ${t.num} (${t.status}/${t.priority})`);
  }
}

async function main() {
  await seedUsers();
  await seedEvent();
  await seedRegistrations();
  await seedSupportTickets();
  console.log('\nSeed selesai. Jalankan `npm run smoke` (server harus jalan) untuk test semua fitur.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
