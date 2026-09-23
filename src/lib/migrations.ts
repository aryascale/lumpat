import { query } from './db';

/**
 * Run safe database migrations on server startup.
 * Each migration is idempotent - safe to run multiple times.
 */
export async function runMigrations() {
  console.log('[MIGRATIONS] Running startup migrations...');

  // ponytail: app container can boot while MySQL is still warming up (cold deploy);
  // retry connection errors instead of silently skipping migrations until next boot
  const isConnError = (msg: string) =>
    /ECONNREFUSED|ETIMEDOUT|ER_BAD_DB_ERROR|PROTOCOL_CONNECTION|handshake|Connection lost/i.test(msg || '');
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await runMigrationsOnce();
      return;
    } catch (error: any) {
      if (attempt < 5 && isConnError(error?.message)) {
        console.warn(`[MIGRATIONS] DB not ready (attempt ${attempt}/5), retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      console.error('[MIGRATIONS] Error (non-fatal):', error?.message);
      return;
    }
  }
}

async function runMigrationsOnce() {
  try {
    // Migration 1: Drop unique constraint on email+eventId to allow bulk registrations
    const indexes: any = await query(
      "SHOW INDEX FROM EventRegistration WHERE Key_name = 'EventRegistration_email_eventId_key'"
    );
    if (indexes.length > 0) {
      console.log('[MIGRATIONS] Dropping unique index EventRegistration_email_eventId_key...');
      await query('DROP INDEX `EventRegistration_email_eventId_key` ON `EventRegistration`');
      console.log('[MIGRATIONS] ✅ Unique index dropped');
    }

    // Migration 2: Ensure non-unique index exists for performance
    const perfIndex: any = await query(
      "SHOW INDEX FROM EventRegistration WHERE Key_name = 'EventRegistration_email_eventId_idx'"
    );
    if (perfIndex.length === 0) {
      console.log('[MIGRATIONS] Creating performance index EventRegistration_email_eventId_idx...');
      await query('CREATE INDEX `EventRegistration_email_eventId_idx` ON `EventRegistration`(`email`, `eventId`)');
      console.log('[MIGRATIONS] ✅ Performance index created');
    }

    // Migration 3: Add isDeleted to Event for soft-deleting
    try {
      await query("ALTER TABLE Event ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE");
      console.log('[MIGRATIONS] ✅ Added isDeleted column to Event');
    } catch (e: any) {
      if (e.message && e.message.includes("Duplicate column name")) {
        // Ignore if column already exists
      } else {
        throw e;
      }
    }

    // Migration 4: ScanLog table for RPC verification history
    try {
      await query(`CREATE TABLE IF NOT EXISTS ScanLog (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        registrationId VARCHAR(36) NULL,
        eventId VARCHAR(36) NULL,
        bibNumber VARCHAR(64) NULL,
        lookup VARCHAR(255) NULL,
        scannedBy VARCHAR(255) NULL,
        result VARCHAR(32) NOT NULL DEFAULT 'valid',
        source VARCHAR(32) NOT NULL DEFAULT 'rpc',
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX ScanLog_registrationId_idx (registrationId),
        INDEX ScanLog_event_created_idx (eventId, createdAt)
      )`);
      console.log('[MIGRATIONS] ✅ ScanLog table ready');
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) throw e;
    }

    // Migration 5: Voucher table
    await query(`CREATE TABLE IF NOT EXISTS Voucher (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      discountType VARCHAR(16) NOT NULL,
      value INT NOT NULL,
      maxDiscount INT NULL,
      quota INT NOT NULL DEFAULT 0,
      usedCount INT NOT NULL DEFAULT 0,
      eventId VARCHAR(36) NULL,
      validFrom DATETIME(3) NULL,
      validUntil DATETIME(3) NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX Voucher_eventId_idx (eventId)
    )`);
    console.log('[MIGRATIONS] ✅ Voucher table ready');

    // Migration 6: VoucherRedemption table (usage history)
    await query(`CREATE TABLE IF NOT EXISTS VoucherRedemption (
      id VARCHAR(36) PRIMARY KEY,
      voucherId VARCHAR(36) NOT NULL,
      orderId VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      eventId VARCHAR(36) NOT NULL,
      discountAmount INT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX VoucherRedemption_voucherId_idx (voucherId),
      INDEX VoucherRedemption_email_idx (email)
    )`);
    console.log('[MIGRATIONS] ✅ VoucherRedemption table ready');

    // Migration 7: align voucher tables' collation with legacy tables.
    // prisma db push creates them with the MySQL 8 default (utf8mb4_0900_ai_ci),
    // legacy tables use utf8mb4_unicode_ci -> JOIN columns error out with
    // "Illegal mix of collations". The FK prisma adds (voucherId -> Voucher.id)
    // blocks CONVERT while the sides differ, so: drop FK -> convert -> recreate.
    try {
      const legacyColl: any = await query(
        "SELECT TABLE_COLLATION as c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Event' LIMIT 1"
      );
      const target = legacyColl[0]?.c;
      if (target) {
        const tables: any = await query(
          "SELECT TABLE_NAME as t, TABLE_COLLATION as c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Voucher', 'VoucherRedemption')"
        );
        const mismatched = tables.filter((r: any) => r.c !== target);
        if (mismatched.length > 0) {
          try {
            await query('ALTER TABLE VoucherRedemption DROP FOREIGN KEY `VoucherRedemption_voucherId_fkey`');
          } catch {
            // FK absent (raw-SQL path) — nothing to drop
          }
          for (const r of mismatched) {
            await query(`ALTER TABLE \`${r.t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE \`${target}\``);
            console.log(`[MIGRATIONS] ✅ ${r.t} collation aligned to ${target}`);
          }
          await query('ALTER TABLE VoucherRedemption ADD CONSTRAINT `VoucherRedemption_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE');
          console.log('[MIGRATIONS] ✅ VoucherRedemption FK recreated');
        }
      }
    } catch (e: any) {
      console.warn('[MIGRATIONS] Collation align skipped:', e.message);
    }

    // Migration 8: voucher snapshot columns on EventRegistration
    for (const col of [
      'ALTER TABLE EventRegistration ADD COLUMN voucherCode VARCHAR(64) NULL',
      'ALTER TABLE EventRegistration ADD COLUMN discountAmount INT NOT NULL DEFAULT 0',
    ]) {
      try {
        await query(col);
        console.log(`[MIGRATIONS] ✅ ${col.split('ADD COLUMN ')[1]} added`);
      } catch (e: any) {
        if (!e.message?.includes('Duplicate column name')) throw e;
      }
    }

    // Migration 9: one redemption per email per voucher (DB-level backstop for the per-email check)
    const vrUnique: any = await query(
      "SHOW INDEX FROM VoucherRedemption WHERE Key_name = 'VoucherRedemption_voucherId_email_key'"
    );
    if (vrUnique.length === 0) {
      console.log('[MIGRATIONS] Creating unique index VoucherRedemption_voucherId_email_key...');
      try {
        await query('CREATE UNIQUE INDEX `VoucherRedemption_voucherId_email_key` ON `VoucherRedemption`(`voucherId`, `email`)');
        console.log('[MIGRATIONS] ✅ Unique index created');
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') {
          // Duplicate historical rows (none expected — feature unreleased); skip rather than crash startup.
          console.warn('[MIGRATIONS] ⚠️ Duplicate (voucherId, email) rows in VoucherRedemption, skipping unique index:', e.message);
        } else {
          throw e;
        }
      }
    }

    console.log('[MIGRATIONS] All migrations complete ✅');
  } catch (error: any) {
    throw error; // surfaced to runMigrations' retry / non-fatal handling
  }
}
