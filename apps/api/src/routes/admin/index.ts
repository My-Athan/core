import type { FastifyInstance } from 'fastify';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { adminAuth } from '../../middleware/device-auth.js';
import crypto from 'node:crypto';

export async function adminRoutes(app: FastifyInstance) {

  // All admin routes require JWT admin auth
  app.addHook('preHandler', adminAuth);

  // ── POST /api/admin/auth/login ────────────────────────────
  // Admin login — returns JWT
  app.post<{
    Body: { email: string; password: string };
  }>('/auth/login', {
    preHandler: async () => {},  // Skip adminAuth for login
  }, async (request, reply) => {
    const { email, password } = request.body;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Verify password (bcrypt-style hash comparison)
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '24h' }
    );

    return reply.send({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // ── GET /api/admin/devices ────────────────────────────────
  // List all devices with status
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>('/devices', async (request, reply) => {
    const page = parseInt(request.query.page || '1');
    const limit = parseInt(request.query.limit || '50');
    const offset = (page - 1) * limit;

    const deviceList = await db
      .select({
        id: schema.devices.id,
        deviceId: schema.devices.deviceId,
        firmwareVersion: schema.devices.firmwareVersion,
        lastHeartbeat: schema.devices.lastHeartbeat,
        lastIp: schema.devices.lastIp,
        groupId: schema.devices.groupId,
        createdAt: schema.devices.createdAt,
      })
      .from(schema.devices)
      .orderBy(desc(schema.devices.lastHeartbeat))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.devices);

    // Determine online status (heartbeat within last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const devicesWithStatus = deviceList.map(d => ({
      ...d,
      online: d.lastHeartbeat ? d.lastHeartbeat > fiveMinAgo : false,
    }));

    return reply.send({
      devices: devicesWithStatus,
      total: Number(count),
      page,
      limit,
    });
  });

  // ── GET /api/admin/devices/:deviceId ──────────────────────
  // Device detail with config and recent stats
  app.get<{
    Params: { deviceId: string };
  }>('/devices/:deviceId', async (request, reply) => {
    const { deviceId } = request.params;

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.deviceId, deviceId))
      .limit(1);

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    // Get recent stats (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentStats = await db
      .select()
      .from(schema.stats)
      .where(
        and(
          eq(schema.stats.deviceId, deviceId),
          gte(schema.stats.date, weekAgo),
        )
      )
      .orderBy(desc(schema.stats.date))
      .limit(7);

    return reply.send({
      device: {
        ...device,
        apiKey: undefined,  // Don't expose API key
      },
      stats: recentStats,
    });
  });

  // ── PUT /api/admin/devices/:deviceId/config ───────────────
  // Admin pushes config to a specific device
  app.put<{
    Params: { deviceId: string };
    Body: Record<string, unknown>;
  }>('/devices/:deviceId/config', async (request, reply) => {
    const { deviceId } = request.params;

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.deviceId, deviceId))
      .limit(1);

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    const currentConfig = (device.config || {}) as Record<string, unknown>;
    const mergedConfig = { ...currentConfig, ...request.body };

    await db
      .update(schema.devices)
      .set({ config: mergedConfig, updatedAt: new Date() })
      .where(eq(schema.devices.id, device.id));

    return reply.send({ ok: true });
  });

  // ── GET /api/admin/releases ───────────────────────────────
  // List all firmware releases
  app.get('/releases', async (request, reply) => {
    const releaseList = await db
      .select()
      .from(schema.releases)
      .orderBy(desc(schema.releases.createdAt));

    return reply.send({ releases: releaseList });
  });

  // ── POST /api/admin/releases ──────────────────────────────
  // Register a new firmware release (binary uploaded via CI to R2)
  app.post<{
    Body: {
      version: string;
      sha256: string;
      size: number;
      r2Url: string;
      releaseNotes?: string;
      rolloutPercent?: number;
    };
  }>('/releases', async (request, reply) => {
    const { version, sha256, size, r2Url, releaseNotes, rolloutPercent } = request.body;

    // Check if version already exists
    const [existing] = await db
      .select()
      .from(schema.releases)
      .where(eq(schema.releases.version, version))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: 'Version already exists' });
    }

    const [release] = await db
      .insert(schema.releases)
      .values({
        version,
        sha256,
        size,
        r2Url,
        releaseNotes: releaseNotes || '',
        rolloutPercent: rolloutPercent || 10,  // Start at 10% by default
        isStable: false,
      })
      .returning();

    app.log.info(`Release registered: v${version} (${size} bytes)`);

    return reply.status(201).send({ release });
  });

  // ── PUT /api/admin/releases/:version ──────────────────────
  // Update release (rollout percent, stable flag)
  app.put<{
    Params: { version: string };
    Body: { rolloutPercent?: number; isStable?: boolean; releaseNotes?: string };
  }>('/releases/:version', async (request, reply) => {
    const { version } = request.params;
    const updates: Record<string, unknown> = {};

    if (request.body.rolloutPercent !== undefined) {
      updates.rolloutPercent = Math.min(100, Math.max(0, request.body.rolloutPercent));
    }
    if (request.body.isStable !== undefined) {
      updates.isStable = request.body.isStable;
    }
    if (request.body.releaseNotes !== undefined) {
      updates.releaseNotes = request.body.releaseNotes;
    }

    const [updated] = await db
      .update(schema.releases)
      .set(updates)
      .where(eq(schema.releases.version, version))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'Release not found' });
    }

    return reply.send({ release: updated });
  });

  // ── POST /api/admin/groups ────────────────────────────────
  // Create a multi-room device group
  app.post<{
    Body: { name: string; deviceIds?: string[] };
  }>('/groups', async (request, reply) => {
    const user = (request as any).user;
    const { name, deviceIds } = request.body;

    const [group] = await db
      .insert(schema.deviceGroups)
      .values({
        name,
        createdBy: user.id,
      })
      .returning();

    // Add devices to group if provided
    if (deviceIds?.length) {
      for (const did of deviceIds) {
        await db
          .update(schema.devices)
          .set({ groupId: group.id })
          .where(eq(schema.devices.deviceId, did));
      }
    }

    return reply.status(201).send({ group });
  });

  // ── GET /api/admin/groups ─────────────────────────────────
  app.get('/groups', async (request, reply) => {
    const groups = await db
      .select()
      .from(schema.deviceGroups)
      .orderBy(desc(schema.deviceGroups.createdAt));

    // Get device count per group
    const groupsWithCount = await Promise.all(
      groups.map(async (g) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.devices)
          .where(eq(schema.devices.groupId, g.id));
        return { ...g, deviceCount: Number(count) };
      })
    );

    return reply.send({ groups: groupsWithCount });
  });

  // ── POST /api/admin/groups/:id/sync ───────────────────────
  // Trigger synchronized playback for all devices in a group
  app.post<{
    Params: { id: string };
    Body: { prayer: number; delaySeconds?: number };
  }>('/groups/:id/sync', async (request, reply) => {
    const { id } = request.params;
    const { prayer, delaySeconds } = request.body;

    if (prayer < 0 || prayer > 4) {
      return reply.status(400).send({ error: 'Prayer must be 0-4' });
    }

    // Set trigger epoch to N seconds from now (default 30s to allow propagation)
    const delay = delaySeconds || 30;
    const triggerAtEpoch = Math.floor(Date.now() / 1000) + delay;

    const [trigger] = await db
      .insert(schema.syncTriggers)
      .values({
        groupId: id,
        prayer,
        triggerAtEpoch,
      })
      .returning();

    app.log.info(`Sync trigger created: group ${id}, prayer ${prayer}, at epoch ${triggerAtEpoch}`);

    return reply.send({ trigger });
  });

  // ── GET /api/admin/stats ──────────────────────────────────
  // Fleet-wide analytics
  app.get<{
    Querystring: { days?: string };
  }>('/stats', async (request, reply) => {
    const days = parseInt(request.query.days || '7');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [deviceCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.devices);

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [onlineCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.devices)
      .where(gte(schema.devices.lastHeartbeat, fiveMinAgo));

    const recentStats = await db
      .select({
        date: schema.stats.date,
        totalPlays: sql<number>`sum((prayer_plays->>'fajr')::int + (prayer_plays->>'dhuhr')::int + (prayer_plays->>'asr')::int + (prayer_plays->>'maghrib')::int + (prayer_plays->>'isha')::int)`,
        totalErrors: sql<number>`sum(errors)`,
        avgUptime: sql<number>`avg(uptime)`,
      })
      .from(schema.stats)
      .where(gte(schema.stats.date, since))
      .groupBy(schema.stats.date)
      .orderBy(desc(schema.stats.date));

    // Firmware version distribution
    const versionDist = await db
      .select({
        version: schema.devices.firmwareVersion,
        count: sql<number>`count(*)`,
      })
      .from(schema.devices)
      .groupBy(schema.devices.firmwareVersion);

    return reply.send({
      totalDevices: Number(deviceCount.count),
      onlineDevices: Number(onlineCount.count),
      dailyStats: recentStats,
      firmwareVersions: versionDist,
    });
  });
}
