import { query } from './db';

/**
 * Run safe database migrations on server startup.
 * Each migration is idempotent - safe to run multiple times.
 */
export async function runMigrations() {
  console.log('[MIGRATIONS] Running startup migrations...');

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

    // Migration 7: voucher snapshot columns on EventRegistration
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

    // Migration 8: one redemption per email per voucher (DB-level backstop for the per-email check)
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
    console.error('[MIGRATIONS] Error (non-fatal):', error.message);
  }
}
