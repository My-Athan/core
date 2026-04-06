import type { FastifyInstance } from 'fastify';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db/index.js';
import { adminAuth } from '../../middleware/device-auth.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminAuth);

  // ── GET /api/admin/analytics/map ──────────────────────────
  // All devices with location for map visualization
  app.get('/map', async (_request, reply) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const deviceList = await db
      .select({
        deviceId: schema.devices.deviceId,
        lat: schema.devices.lat,
        lon: schema.devices.lon,
        city: schema.devices.city,
        country: schema.devices.country,
        firmwareVersion: schema.devices.firmwareVersion,
        lastHeartbeat: schema.devices.lastHeartbeat,
        groupId: schema.devices.groupId,
      })
      .from(schema.devices)
      .where(sql`${schema.devices.lat} IS NOT NULL AND ${schema.devices.lon} IS NOT NULL`);

    // Get latest stats per device for RSSI and prayer plays
    const latestStats = await db
      .select({
        deviceId: schema.stats.deviceId,
        wifiRssi: schema.stats.wifiRssi,
        prayerPlays: schema.stats.prayerPlays,
      })
      .from(schema.stats)
      .where(gte(schema.stats.date, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy(desc(schema.stats.date));

    // Build a map of deviceId → latest stats
    const statsMap = new Map<string, { wifiRssi: number | null; prayerPlays: number }>();
    for (const s of latestStats) {
      if (!statsMap.has(s.deviceId)) {
        const plays = s.prayerPlays as Record<string, number> | null;
        const totalPlays = plays
          ? Object.values(plays).reduce((sum, v) => sum + (v || 0), 0)
          : 0;
        statsMap.set(s.deviceId, { wifiRssi: s.wifiRssi, prayerPlays: totalPlays });
      }
    }

    const devices = deviceList.map(d => ({
      ...d,
      online: d.lastHeartbeat ? d.lastHeartbeat > fiveMinAgo : false,
      wifiRssi: statsMap.get(d.deviceId)?.wifiRssi ?? null,
      prayerPlaysToday: statsMap.get(d.deviceId)?.prayerPlays ?? 0,
    }));

    return reply.send({ devices });
  });

  // ── POST /api/admin/devices/:deviceId/command ─────────────
  // Queue a remote command for a device
  const commandSchema = z.object({
    command: z.enum(['ota_update', 'wifi_reset', 'restart']),
    payload: z.record(z.unknown()).optional(),
  });

  app.post<{ Params: { deviceId: string } }>(
    '/devices/:deviceId/command', async (request, reply) => {
      const parsed = commandSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const { deviceId } = request.params;
      const { command, payload } = parsed.data;

      // Verify device exists
      const [device] = await db.select({ id: schema.devices.id })
        .from(schema.devices)
        .where(eq(schema.devices.deviceId, deviceId))
        .limit(1);

      if (!device) return reply.status(404).send({ error: 'Device not found' });

      const [cmd] = await db
        .insert(schema.deviceCommands)
        .values({
          deviceId,
          command,
          payload: payload || {},
        })
        .returning();

      return reply.status(201).send({ command: cmd });
    }
  );

  // ── GET /api/admin/devices/:deviceId/commands ─────────────
  // Command history for a device
  app.get<{ Params: { deviceId: string } }>(
    '/devices/:deviceId/commands', async (request, reply) => {
      const commands = await db
        .select()
        .from(schema.deviceCommands)
        .where(eq(schema.deviceCommands.deviceId, request.params.deviceId))
        .orderBy(desc(schema.deviceCommands.createdAt))
        .limit(20);

      return reply.send({ commands });
    }
  );
}
