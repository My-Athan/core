import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db/index.js';
import { deviceAuth, deriveApiKey } from '../../middleware/device-auth.js';
import { calculatePrayerTimes } from '../../services/prayer-times.js';
import { gregorianToHijri, isRamadan, getHoliday } from '../../services/hijri.js';
import type { CalcMethod, AsrJuristic } from '@myathan/shared';
import { compareSemver, hashDeviceId } from '../../utils/semver.js';

// ── Zod Schemas ─────────────────────────────────────────────
const registerSchema = z.object({
  deviceId: z.string().regex(/^myathan-[a-f0-9]{6}$/).max(32),
  firmwareVersion: z.string().max(20).optional(),
});

const heartbeatSchema = z.object({
  firmwareVersion: z.string().max(20).optional(),
  hardwareType: z.string().max(30).optional(),
  freeHeap: z.number().int().nonnegative().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  wifiRssi: z.number().int().min(-100).max(0).optional(),
  uptime: z.number().int().nonnegative().optional(),
  prayerPlays: z.record(z.number().int().nonnegative()).optional(),
  errors: z.number().int().nonnegative().optional(),
  consumedTriggerId: z.string().uuid().optional(),
});

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
const ALLOWED_CONFIG_KEYS = [
  'audio', 'schedule', 'ramadan', 'hijri', 'holidays',
  'led', 'multiRoom', 'location', 'timetable',
] as const;

const configUpdateSchema = z.record(z.string(), z.unknown()).transform((obj) => {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if ((ALLOWED_CONFIG_KEYS as readonly string[]).includes(key) &&
        !DANGEROUS_KEYS.includes(key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
});

const timetableSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  method: z.string().max(10).optional(),
  asr: z.string().max(10).optional(),
  date: z.string().max(10).optional(),
});

export async function deviceRoutes(app: FastifyInstance) {

  // ── POST /api/device/register ─────────────────────────────
  // Called once on first boot. Device sends its MAC-derived ID.
  // Server generates API key and stores the device.
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { deviceId, firmwareVersion } = parsed.data;

    // Check if already registered
    const [existing] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.deviceId, deviceId))
      .limit(1);

    if (existing) {
      return reply.send({
        deviceId: existing.deviceId,
        apiKey: existing.apiKey,
        registered: false,
      });
    }

    // Register new device
    const apiKey = deriveApiKey(deviceId);
    const [device] = await db
      .insert(schema.devices)
      .values({
        deviceId,
        apiKey,
        firmwareVersion: firmwareVersion || 'unknown',
      })
      .returning();

    app.log.info(`Device registered: ${deviceId}`);

    return reply.status(201).send({
      deviceId: device.deviceId,
      apiKey: device.apiKey,
      registered: true,
    });
  });

  // ── GET /api/device/config ────────────────────────────────
  // Device polls for config changes. Returns stored config.
  app.get('/config', {
    preHandler: deviceAuth,
  }, async (request, reply) => {
    const device = (request as any).device;
    return reply.send({
      config: device.config || {},
      deviceId: device.deviceId,
      groupId: device.groupId,
    });
  });

  // ── PUT /api/device/config ────────────────────────────────
  // Device or PWA pushes config updates.
  app.put<{
    Body: Record<string, unknown>;
  }>('/config', {
    preHandler: deviceAuth,
  }, async (request, reply) => {
    const parsed = configUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid config' });
    }
    const device = (request as any).device;
    const incoming = parsed.data;

    // Merge incoming config with existing
    const currentConfig = (device.config || {}) as Record<string, unknown>;
    const mergedConfig = { ...currentConfig, ...incoming };

    await db
      .update(schema.devices)
      .set({
        config: mergedConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.devices.id, device.id));

    return reply.send({ ok: true });
  });

  // ── POST /api/device/heartbeat ────────────────────────────
  app.post('/heartbeat', {
    preHandler: deviceAuth,
  }, async (request, reply) => {
    const parsed = heartbeatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }
    const device = (request as any).device;
    const { firmwareVersion, hardwareType, freeHeap, wifiRssi, uptime, prayerPlays, errors, consumedTriggerId, lat, lon } = parsed.data;

    // Update device record (including location if provided)
    await db
      .update(schema.devices)
      .set({
        lastHeartbeat: new Date(),
        lastIp: request.ip,
        firmwareVersion: firmwareVersion || device.firmwareVersion,
        hardwareType: hardwareType ?? device.hardwareType,
        lat: lat ?? device.lat,
        lon: lon ?? device.lon,
        updatedAt: new Date(),
      })
      .where(eq(schema.devices.id, device.id));

    // Store stats if provided
    if (prayerPlays || errors || uptime) {
      await db.insert(schema.stats).values({
        deviceId: device.deviceId,
        date: new Date(),
        prayerPlays: prayerPlays || {},
        errors: errors || 0,
        uptime: uptime || 0,
        freeHeap: freeHeap || null,
        wifiRssi: wifiRssi || null,
      });
    }

    // Mark previously consumed trigger if device reports it
    if (consumedTriggerId) {
      await db
        .update(schema.syncTriggers)
        .set({ consumed: true })
        .where(eq(schema.syncTriggers.id, consumedTriggerId));
    }

    // Return any pending sync triggers
    const response: Record<string, unknown> = { ok: true };

    if (device.groupId) {
      const [trigger] = await db
        .select()
        .from(schema.syncTriggers)
        .where(
          and(
            eq(schema.syncTriggers.groupId, device.groupId),
            eq(schema.syncTriggers.consumed, false),
          )
        )
        .orderBy(schema.syncTriggers.createdAt)
        .limit(1);

      if (trigger) {
        response.syncTrigger = {
          id: trigger.id,
          prayer: trigger.prayer,
          triggerAtEpoch: trigger.triggerAtEpoch,
        };
      }
    }

    // Check for pending commands
    const [pendingCmd] = await db
      .select()
      .from(schema.deviceCommands)
      .where(
        and(
          eq(schema.deviceCommands.deviceId, device.deviceId),
          eq(schema.deviceCommands.status, 'pending'),
        )
      )
      .orderBy(schema.deviceCommands.createdAt)
      .limit(1);

    if (pendingCmd) {
      response.command = {
        id: pendingCmd.id,
        command: pendingCmd.command,
        payload: pendingCmd.payload,
      };
      // Mark as delivered
      await db
        .update(schema.deviceCommands)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(eq(schema.deviceCommands.id, pendingCmd.id));
    }

    return reply.send(response);
  });

  // ── GET /api/device/timetable ─────────────────────────────
  // Server-side prayer time calculation (verification/fallback).
  app.get('/timetable', async (request, reply) => {
    const parsed = timetableSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { lat: latitude, lon: longitude, method, asr, date: dateStr } = parsed.data;

    const date = dateStr ? new Date(dateStr) : new Date();
    const calcMethod = (method as CalcMethod) || 'ISNA';
    const asrJuristic = (asr as AsrJuristic) || 'standard';

    const today = calculatePrayerTimes(date, latitude, longitude, calcMethod, asrJuristic);

    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = calculatePrayerTimes(tomorrow, latitude, longitude, calcMethod, asrJuristic);

    // Hijri date
    const hijri = gregorianToHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const ramadan = isRamadan(hijri);
    const holiday = getHoliday(hijri);

    return reply.send({
      today,
      tomorrow: {
        fajr: tomorrowTimes.fajr,
        dhuhr: tomorrowTimes.dhuhr,
      },
      method: calcMethod,
      asrJuristic,
      location: { lat: latitude, lon: longitude },
      hijri: {
        ...hijri,
        ramadan,
        holiday: holiday !== 'none' ? holiday : undefined,
      },
    });
  });

  // ── GET /api/device/ota/check ─────────────────────────────
  // Device checks if a newer firmware version is available.
  app.get<{
    Querystring: { currentVersion: string; hardwareType?: string };
  }>('/ota/check', {
    preHandler: deviceAuth,
  }, async (request, reply) => {
    const { currentVersion, hardwareType: rawHardwareType } = request.query;
    const device = (request as any).device;

    const ALLOWED_HARDWARE_TYPES = ['esp32c3-v1', 'esp32-s3-v1', 'esp32-s3-v2'] as const;
    const hardwareType = (ALLOWED_HARDWARE_TYPES as readonly string[]).includes(rawHardwareType ?? '')
      ? rawHardwareType
      : undefined;

    // Update device hardware type if provided and valid
    if (hardwareType) {
      await db
        .update(schema.devices)
        .set({ hardwareType, updatedAt: new Date() })
        .where(eq(schema.devices.id, device.id));
    }

    const hwType = hardwareType || device.hardwareType || 'esp32c3-v1';

    // Find latest stable release with autoUpdate enabled for this hardware type
    const [latest] = await db
      .select()
      .from(schema.releases)
      .where(
        and(
          eq(schema.releases.isStable, true),
          eq(schema.releases.autoUpdate, true),
          eq(schema.releases.hardwareType, hwType),
        )
      )
      .orderBy(desc(schema.releases.createdAt))
      .limit(1);

    // Check for pending force ota_update command
    const [forceCmd] = await db
      .select()
      .from(schema.deviceCommands)
      .where(
        and(
          eq(schema.deviceCommands.deviceId, device.deviceId),
          eq(schema.deviceCommands.command, 'ota_update'),
          eq(schema.deviceCommands.status, 'pending'),
        )
      )
      .orderBy(desc(schema.deviceCommands.createdAt))
      .limit(1);

    // If no autoUpdate release and no force command, no update
    if (!latest && !forceCmd) {
      return reply.send({ updateAvailable: false });
    }

    // Determine target release: force command specifies a version, otherwise use latest
    let targetRelease = latest;
    if (forceCmd) {
      const forcePayload = forceCmd.payload as Record<string, unknown>;
      const forceVersion = forcePayload?.version as string | undefined;
      if (forceVersion) {
        const [forced] = await db
          .select()
          .from(schema.releases)
          .where(eq(schema.releases.version, forceVersion))
          .limit(1);
        if (forced) targetRelease = forced;
      }
    }

    if (!targetRelease) {
      return reply.send({ updateAvailable: false });
    }

    // Semver comparison: release must be newer than current
    if (compareSemver(targetRelease.version, currentVersion) <= 0) {
      return reply.send({ updateAvailable: false });
    }

    // Check minVersion constraint: device must be at or above minVersion
    if (targetRelease.minVersion && compareSemver(currentVersion, targetRelease.minVersion) < 0) {
      return reply.send({ updateAvailable: false, reason: 'below_min_version' });
    }

    // Check rollout percentage
    if (targetRelease.rolloutPercent < 100 && !forceCmd) {
      const hash = hashDeviceId(device.deviceId);
      if (hash > targetRelease.rolloutPercent) {
        return reply.send({ updateAvailable: false, reason: 'staged_rollout' });
      }
    }

    // Check device config ota.autoUpdateEnabled (skip if false, unless force command)
    if (!forceCmd) {
      const config = (device.config || {}) as Record<string, unknown>;
      const otaConfig = config.ota as Record<string, unknown> | undefined;
      if (otaConfig && otaConfig.autoUpdateEnabled === false) {
        return reply.send({ updateAvailable: false, reason: 'auto_update_disabled' });
      }
    }

    // If force command, mark it as delivered
    if (forceCmd) {
      await db
        .update(schema.deviceCommands)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(eq(schema.deviceCommands.id, forceCmd.id));
    }

    return reply.send({
      updateAvailable: true,
      version: targetRelease.version,
      sha256: targetRelease.sha256,
      size: targetRelease.size,
      url: targetRelease.r2Url,
      releaseNotes: targetRelease.releaseNotes,
      forced: !!forceCmd,
    });
  });

  // ── GET /api/device/sync ──────────────────────────────────
  // Get pending multi-room sync triggers for this device's group.
  app.get('/sync', {
    preHandler: deviceAuth,
  }, async (request, reply) => {
    const device = (request as any).device;

    if (!device.groupId) {
      return reply.send({ triggers: [] });
    }

    const triggers = await db
      .select()
      .from(schema.syncTriggers)
      .where(
        and(
          eq(schema.syncTriggers.groupId, device.groupId),
          eq(schema.syncTriggers.consumed, false),
        )
      )
      .orderBy(schema.syncTriggers.createdAt);

    return reply.send({
      triggers: triggers.map(t => ({
        prayer: t.prayer,
        triggerAtEpoch: t.triggerAtEpoch,
      })),
    });
  });
}

