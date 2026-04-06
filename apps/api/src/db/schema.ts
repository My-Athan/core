import { pgTable, text, integer, timestamp, boolean, jsonb, real, uuid, varchar, index } from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),  // 'user' | 'admin'
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
  groupId: uuid('group_id').references(() => deviceGroups.id),
  firmwareVersion: varchar('firmware_version', { length: 20 }),
  lastHeartbeat: timestamp('last_heartbeat'),
  lastIp: varchar('last_ip', { length: 45 }),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_devices_group_id').on(table.groupId),
  heartbeatIdx: index('idx_devices_last_heartbeat').on(table.lastHeartbeat),
  userIdIdx: index('idx_devices_user_id').on(table.userId),
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
