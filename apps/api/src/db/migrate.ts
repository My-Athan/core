import { db } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Creates all tables if they don't exist.
 * Uses raw SQL so we don't need drizzle-kit in the production image.
 */
export async function migrateDatabase() {
  console.log('[Migrate] Checking database schema...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS device_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      sync_enabled BOOLEAN NOT NULL DEFAULT true,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(32) NOT NULL UNIQUE,
      api_key VARCHAR(128) NOT NULL,
      user_id UUID REFERENCES users(id),
      app_user_id UUID,
      group_id UUID REFERENCES device_groups(id),
      firmware_version VARCHAR(20),
      last_heartbeat TIMESTAMP,
      last_ip VARCHAR(45),
      lat REAL,
      lon REAL,
      city VARCHAR(100),
      country VARCHAR(100),
      config JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS releases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      version VARCHAR(20) NOT NULL UNIQUE,
      sha256 VARCHAR(64) NOT NULL,
      size INTEGER NOT NULL,
      r2_url TEXT NOT NULL,
      release_notes TEXT,
      rollout_percent INTEGER NOT NULL DEFAULT 100,
      is_stable BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(32) NOT NULL,
      date TIMESTAMP NOT NULL,
      prayer_plays JSONB DEFAULT '{}',
      errors INTEGER DEFAULT 0,
      uptime INTEGER DEFAULT 0,
      free_heap INTEGER,
      wifi_rssi INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sync_triggers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL REFERENCES device_groups(id),
      prayer INTEGER NOT NULL,
      trigger_at_epoch INTEGER NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS device_commands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(32) NOT NULL,
      command VARCHAR(30) NOT NULL,
      payload JSONB DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMP,
      executed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT,
      google_id VARCHAR(128),
      display_name VARCHAR(100),
      avatar_url TEXT,
      language VARCHAR(8) NOT NULL DEFAULT 'en',
      email_verified BOOLEAN NOT NULL DEFAULT false,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      blocked_at TIMESTAMP,
      blocked_reason TEXT,
      deleted_at TIMESTAMP,
      purge_at TIMESTAMP,
      last_login_at TIMESTAMP,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sso_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider VARCHAR(30) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT false,
      client_id TEXT,
      client_secret TEXT,
      redirect_uri TEXT,
      logto_endpoint TEXT,
      require_email_verification BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_by UUID REFERENCES users(id)
    );

    -- Indexes (IF NOT EXISTS supported in PG 9.5+)
    CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
    CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices(last_heartbeat);
    CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_app_user_id ON devices(app_user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(lat, lon);
    CREATE INDEX IF NOT EXISTS idx_stats_device_date ON stats(device_id, date);
    CREATE INDEX IF NOT EXISTS idx_sync_group_consumed ON sync_triggers(group_id, consumed);
    CREATE INDEX IF NOT EXISTS idx_commands_device_status ON device_commands(device_id, status);
    CREATE INDEX IF NOT EXISTS idx_app_users_google_id ON app_users(google_id);
    CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);
    CREATE INDEX IF NOT EXISTS idx_app_users_purge_at ON app_users(purge_at);
  `);

  // Add must_change_password column if it doesn't exist (for upgrades)
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
  `);

  // Add location columns if they don't exist (for upgrades)
  await db.execute(sql`
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS lat REAL;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS lon REAL;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS country VARCHAR(100);
  `);

  // Add OTA hardware type and auto-update columns (for upgrades)
  await db.execute(sql`
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(30) NOT NULL DEFAULT 'esp32c3-v1';
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS auto_update BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE releases ADD COLUMN IF NOT EXISTS min_version VARCHAR(20);
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(30) DEFAULT 'esp32c3-v1';
  `);

  // Add app_users profile/lifecycle columns (for upgrades from pre-user-management schema)
  await db.execute(sql`
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'en';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS purge_at TIMESTAMP;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
  `);

  // Link devices to app users.
  // Column is created in the devices CREATE TABLE above (without FK, because
  // app_users didn't exist yet at that point in the block). This ALTER adds
  // the column for upgrade paths and then wires the FK constraint idempotently.
  await db.execute(sql`
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS app_user_id UUID;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_app_user_id_fkey'
      ) THEN
        ALTER TABLE devices
          ADD CONSTRAINT devices_app_user_id_fkey
          FOREIGN KEY (app_user_id) REFERENCES app_users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  console.log('[Migrate] Database schema ready.');
}
