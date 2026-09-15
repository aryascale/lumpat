import 'dotenv/config';
import { query } from '../src/lib/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const accounts = [
  {
    email: 'super_admin@lumpat.co.id',
    username: 'superadmin',
    password: 'Admin123!',
    name: 'Super Admin',
    role: 'super_admin',
  },
  {
    email: 'event_admin@lumpat.co.id',
    username: 'eventadmin',
    password: 'Event123!',
    name: 'Event Admin',
    role: 'event_admin',
  },
  {
    email: 'scan_admin@lumpat.co.id',
    username: 'scanadmin',
    password: 'Scan123!',
    name: 'Scan Admin',
    role: 'scan_admin',
  },
  {
    email: 'payment_admin@lumpat.co.id',
    username: 'paymentadmin',
    password: 'Payment123!',
    name: 'Payment Admin',
    role: 'payment_admin',
  },
] as const;

async function main() {
  for (const account of accounts) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    const userId = crypto.randomUUID();

    await query(
      `INSERT INTO User (id, email, username, password, name, role, isEmailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         password = VALUES(password),
         name = VALUES(name),
         role = VALUES(role),
         isEmailVerified = true,
         updatedAt = NOW()`,
      [userId, account.email, account.username, hashedPassword, account.name, account.role]
    );

    console.log(`✅ ${account.role} created: ${account.email} / ${account.password}`);
  }

  console.log('\nRole mapping:');
  console.log('- super_admin@lumpat.co.id -> full admin access');
  console.log('- event_admin@lumpat.co.id -> events, banners, tickets, activity logs');
  console.log('- scan_admin@lumpat.co.id -> tickets, verification, activity logs');
  console.log('- payment_admin@lumpat.co.id -> overview, payments, activity logs');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
