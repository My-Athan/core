import type { FastifyInstance } from 'fastify';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../../db/index.js';
import { adminAuth } from '../../middleware/device-auth.js';

// ── Zod Schemas ─────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().length(64),
  size: z.number().int().positive().max(2_000_000),
  r2Url: z.string().url(),
  releaseNotes: z.string().max(5000).optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
});

const releaseUpdateSchema = z.object({
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  isStable: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
});

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  deviceIds: z.array(z.string().max(32)).max(50).optional(),
});

const syncSchema = z.object({
  prayer: z.number().int().min(0).max(4),
  delaySeconds: z.number().int().min(5).max(300).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function adminRoutes(app: FastifyInstance) {

  // ── POST /api/admin/auth/login ────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '24h' }
    );

    return reply.send({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // All routes below require admin auth
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/api/admin/auth/login') return;
    return adminAuth(request, reply);
  });

  // ── GET /api/admin/devices ────────────────────────────────
  app.get('/devices', async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
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

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const devicesWithStatus = deviceList.map(d => ({
      ...d,
      online: d.lastHeartbeat ? d.lastHeartbeat > fiveMinAgo : false,
    }));

    return reply.send({ devices: devicesWithStatus, total: Number(count), page, limit });
  });

  // ── GET /api/admin/devices/:deviceId ──────────────────────
  app.get<{ Params: { deviceId: string } }>('/devices/:deviceId', async (request, reply) => {
    const { deviceId } = request.params;
    if (!deviceId || deviceId.length > 32) {
      return reply.status(400).send({ error: 'Invalid deviceId' });
    }

    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.deviceId, deviceId))
      .limit(1);

    if (!device) return reply.status(404).send({ error: 'Device not found' });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentStats = await db
      .select()
      .from(schema.stats)
      .where(and(eq(schema.stats.deviceId, deviceId), gte(schema.stats.date, weekAgo)))
      .orderBy(desc(schema.stats.date))
      .limit(7);

    return reply.send({
      device: { ...device, apiKey: undefined },
      stats: recentStats,
    });
  });

  // ── PUT /api/admin/devices/:deviceId/config ───────────────
  app.put<{ Params: { deviceId: string }; Body: Record<string, unknown> }>(
    '/devices/:deviceId/config', async (request, reply) => {
      const { deviceId } = request.params;

      const [device] = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.deviceId, deviceId))
        .limit(1);

      if (!device) return reply.status(404).send({ error: 'Device not found' });

      const currentConfig = (device.config || {}) as Record<string, unknown>;
      const mergedConfig = { ...currentConfig, ...request.body };

      await db
        .update(schema.devices)
        .set({ config: mergedConfig, updatedAt: new Date() })
        .where(eq(schema.devices.id, device.id));

      return reply.send({ ok: true });
    }
  );

  // ── GET /api/admin/releases ───────────────────────────────
  app.get('/releases', async (_request, reply) => {
    const releaseList = await db
      .select()
      .from(schema.releases)
      .orderBy(desc(schema.releases.createdAt));
    return reply.send({ releases: releaseList });
  });

  // ── POST /api/admin/releases ──────────────────────────────
  app.post('/releases', async (request, reply) => {
    const parsed = releaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { version, sha256, size, r2Url, releaseNotes, rolloutPercent } = parsed.data;

    const [existing] = await db
      .select().from(schema.releases)
      .where(eq(schema.releases.version, version)).limit(1);

    if (existing) return reply.status(409).send({ error: 'Version already exists' });

    const [release] = await db
      .insert(schema.releases)
      .values({
        version, sha256, size, r2Url,
        releaseNotes: releaseNotes || '',
        rolloutPercent: rolloutPercent || 10,
        isStable: false,
      })
      .returning();

    return reply.status(201).send({ release });
  });

  // ── PUT /api/admin/releases/:version ──────────────────────
  app.put<{ Params: { version: string } }>('/releases/:version', async (request, reply) => {
    const parsed = releaseUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const [updated] = await db
      .update(schema.releases)
      .set(parsed.data)
      .where(eq(schema.releases.version, request.params.version))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Release not found' });
    return reply.send({ release: updated });
  });

  // ── POST /api/admin/groups ────────────────────────────────
  app.post('/groups', async (request, reply) => {
    const parsed = groupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { name, deviceIds } = parsed.data;
    const user = (request as any).user;

    const [group] = await db
      .insert(schema.deviceGroups)
      .values({ name, createdBy: user.id })
      .returning();

    if (deviceIds?.length) {
      for (const did of deviceIds) {
        await db.update(schema.devices).set({ groupId: group.id })
          .where(eq(schema.devices.deviceId, did));
      }
    }

    return reply.status(201).send({ group });
  });

  // ── GET /api/admin/groups — fixed N+1 with subquery ───────
  app.get('/groups', async (_request, reply) => {
    const groups = await db
      .select({
        id: schema.deviceGroups.id,
        name: schema.deviceGroups.name,
        syncEnabled: schema.deviceGroups.syncEnabled,
        createdAt: schema.deviceGroups.createdAt,
        deviceCount: sql<number>`(SELECT count(*) FROM devices WHERE group_id = ${schema.deviceGroups.id})`,
      })
      .from(schema.deviceGroups)
      .orderBy(desc(schema.deviceGroups.createdAt));

    return reply.send({ groups });
  });

  // ── POST /api/admin/groups/:id/sync ───────────────────────
  app.post<{ Params: { id: string } }>('/groups/:id/sync', async (request, reply) => {
    const parsed = syncSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { prayer, delaySeconds } = parsed.data;
    const triggerAtEpoch = Math.floor(Date.now() / 1000) + (delaySeconds || 30);

    const [trigger] = await db
      .insert(schema.syncTriggers)
      .values({ groupId: request.params.id, prayer, triggerAtEpoch })
      .returning();

    return reply.send({ trigger });
  });

  // ── GET /api/admin/stats ──────────────────────────────────
  app.get<{ Querystring: { days?: string } }>('/stats', async (request, reply) => {
    const days = Math.min(90, Math.max(1, parseInt(request.query.days || '7')));
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.devices);
    const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.devices)
      .where(gte(schema.devices.lastHeartbeat, fiveMinAgo));

    const versionDist = await db
      .select({ version: schema.devices.firmwareVersion, count: sql<number>`count(*)` })
      .from(schema.devices)
      .groupBy(schema.devices.firmwareVersion);

    return reply.send({
      totalDevices: Number(deviceCount.count),
      onlineDevices: Number(onlineCount.count),
      firmwareVersions: versionDist,
    });
  });
}
