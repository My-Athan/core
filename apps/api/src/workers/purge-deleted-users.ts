import { lte } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

// Purge interval: every hour. Keep short enough that users who reach their
// purge_at date don't wait long, but long enough not to pound the DB.
const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Deletes app_users rows where status='deleted' AND purge_at <= NOW().
 * Called on boot (catches anything that expired while the server was down)
 * and then every hour via setInterval.
 */
async function runPurge(): Promise<void> {
  const now = new Date();
  const result = await db
    .delete(schema.appUsers)
    .where(lte(schema.appUsers.purgeAt, now))
    .returning({ id: schema.appUsers.id });

  if (result.length > 0) {
    console.log(`[PurgeWorker] Hard-deleted ${result.length} expired app_user(s)`);
  }
}

export function startPurgeWorker(): void {
  // Run once immediately on boot to catch accounts that expired while offline.
  runPurge().catch(err => console.error('[PurgeWorker] Boot purge failed:', err));

  // Then run every hour.
  setInterval(() => {
    runPurge().catch(err => console.error('[PurgeWorker] Scheduled purge failed:', err));
  }, INTERVAL_MS).unref(); // .unref() so the interval doesn't prevent clean shutdown
}
