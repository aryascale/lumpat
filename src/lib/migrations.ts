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

    console.log('[MIGRATIONS] All migrations complete ✅');
  } catch (error: any) {
    console.error('[MIGRATIONS] Error (non-fatal):', error.message);
  }
}
