import { pgTable, text, integer, timestamp, boolean, jsonb, real, uuid, varchar, index } from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),  // 'user' | 'admin'
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Devices
// ─────────────────────────────────────────────────────────────

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 32 }).notNull().unique(),  // "myathan-XXXXXX"
  apiKey: varchar('api_key', { length: 128 }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  appUserId: uuid('app_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
  groupId: uuid('group_id').references(() => deviceGroups.id),
  firmwareVersion: varchar('firmware_version', { length: 20 }),
  lastHeartbeat: timestamp('last_heartbeat'),
  lastIp: varchar('last_ip', { length: 45 }),
  lat: real('lat'),
  lon: real('lon'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  hardwareType: varchar('hardware_type', { length: 30 }).default('esp32c3-v1'),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_devices_group_id').on(table.groupId),
  heartbeatIdx: index('idx_devices_last_heartbeat').on(table.lastHeartbeat),
  userIdIdx: index('idx_devices_user_id').on(table.userId),
  appUserIdIdx: index('idx_devices_app_user_id').on(table.appUserId),
  locationIdx: index('idx_devices_location').on(table.lat, table.lon),
}));

// ─────────────────────────────────────────────────────────────
// Device Groups (Multi-Room)
// ─────────────────────────────────────────────────────────────

export const deviceGroups = pgTable('device_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  syncEnabled: boolean('sync_enabled').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Firmware Releases (OTA)
// ─────────────────────────────────────────────────────────────

export const releases = pgTable('releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: varchar('version', { length: 20 }).notNull().unique(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  size: integer('size').notNull(),
  r2Url: text('r2_url').notNull(),
  releaseNotes: text('release_notes'),
  rolloutPercent: integer('rollout_percent').notNull().default(100),
  isStable: boolean('is_stable').notNull().default(false),
  hardwareType: varchar('hardware_type', { length: 30 }).notNull().default('esp32c3-v1'),
  autoUpdate: boolean('auto_update').notNull().default(false),
  minVersion: varchar('min_version', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Device Stats
// ─────────────────────────────────────────────────────────────

export const stats = pgTable('stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 32 }).notNull(),
  date: timestamp('date').notNull(),
  prayerPlays: jsonb('prayer_plays').default({}),  // { fajr: 1, dhuhr: 1, ... }
  errors: integer('errors').default(0),
  uptime: integer('uptime').default(0),             // seconds
  freeHeap: integer('free_heap'),
  wifiRssi: integer('wifi_rssi'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  deviceDateIdx: index('idx_stats_device_date').on(table.deviceId, table.date),
}));

// ─────────────────────────────────────────────────────────────
// Sync Triggers (Multi-Room)
// ─────────────────────────────────────────────────────────────

export const syncTriggers = pgTable('sync_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => deviceGroups.id),
  prayer: integer('prayer').notNull(),               // 0-4
  triggerAtEpoch: integer('trigger_at_epoch').notNull(),
  consumed: boolean('consumed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  groupConsumedIdx: index('idx_sync_group_consumed').on(table.groupId, table.consumed),
}));

// ─────────────────────────────────────────────────────────────
// SSO Configuration (admin-managed, stored encrypted in DB)
// ─────────────────────────────────────────────────────────────

export const ssoConfig = pgTable('sso_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 30 }).notNull(),  // 'google' | 'email' | 'logto'
  enabled: boolean('enabled').notNull().default(false),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  redirectUri: text('redirect_uri'),
  logtoEndpoint: text('logto_endpoint'),
  requireEmailVerification: boolean('require_email_verification').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// ─────────────────────────────────────────────────────────────
// App Users (mobile PWA users, separate from admin users)
// ─────────────────────────────────────────────────────────────

export const appUsers = pgTable('app_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: varchar('google_id', { length: 128 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  language: varchar('language', { length: 8 }).notNull().default('en'),
  emailVerified: boolean('email_verified').notNull().default(false),
  status: varchar('status', { length: 16 }).notNull().default('active'),  // 'active' | 'invited' | 'blocked' | 'deleted'
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  blockedAt: timestamp('blocked_at'),
  blockedReason: text('blocked_reason'),
  deletedAt: timestamp('deleted_at'),
  purgeAt: timestamp('purge_at'),
  lastLoginAt: timestamp('last_login_at'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  googleIdIdx: index('idx_app_users_google_id').on(table.googleId),
  statusIdx: index('idx_app_users_status').on(table.status),
  purgeAtIdx: index('idx_app_users_purge_at').on(table.purgeAt),
}));

// ─────────────────────────────────────────────────────────────
// Device Commands (remote management)
// ─────────────────────────────────────────────────────────────

export const deviceCommands = pgTable('device_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 32 }).notNull(),
  command: varchar('command', { length: 30 }).notNull(),  // 'ota_update' | 'wifi_reset' | 'restart'
  payload: jsonb('payload').default({}),
  status: varchar('status', { length: 20 }).notNull().default('pending'),  // 'pending' | 'delivered' | 'executed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  executedAt: timestamp('executed_at'),
}, (table) => ({
  deviceStatusIdx: index('idx_commands_device_status').on(table.deviceId, table.status),
}));
