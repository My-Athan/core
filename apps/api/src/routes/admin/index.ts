import type { FastifyInstance } from 'fastify';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multipart from '@fastify/multipart';
import { db, schema } from '../../db/index.js';
import { adminAuth } from '../../middleware/device-auth.js';
import { uploadFirmware } from '../../services/audio-catalog.js';

// ── Zod Schemas ─────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const setupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  sha256: z.string().length(64),
  size: z.number().int().positive().max(2_000_000),
  r2Url: z.string().url(),
  releaseNotes: z.string().max(5000).optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  hardwareType: z.string().max(30).optional(),
});

const releaseUpdateSchema = z.object({
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  isStable: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
  autoUpdate: z.boolean().optional(),
  hardwareType: z.string().max(30).optional(),
  minVersion: z.string().max(20).optional(),
});

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  deviceIds: z.array(z.string().max(32)).max(50).optional(),
});

const syncSchema = z.object({
  prayer: z.number().int().min(0).max(4),
  delaySeconds: z.number().int().min(5).max(300).optional(),
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

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function adminRoutes(app: FastifyInstance) {
  // Register multipart support for file uploads
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

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

    reply.setCookie('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/admin',
      maxAge: 86400,
    });

    return reply.send({
      user: { id: user.id, email: user.email, role: user.role },
      mustChangePassword: user.mustChangePassword,
    });
  });

  // ── POST /api/admin/auth/setup ───────────────────────────
  // First-login setup: replace default admin with real credentials
  app.post('/auth/setup', async (request, reply) => {
    const parsed = setupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify JWT from the default admin
    let payload: { id: string; role: string };
    try {
      payload = await request.jwtVerify() as { id: string; role: string };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Verify the user must change password
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.id))
      .limit(1);

    if (!user || !user.mustChangePassword) {
      return reply.status(403).send({ error: 'Account setup not required' });
    }

    const { email, password } = parsed.data;

    // Check email isn't already taken by another user
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing && existing.id !== user.id) {
      return reply.status(409).send({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Update the default admin with real credentials
    await db
      .update(schema.users)
      .set({
        email,
        passwordHash: hash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // Issue new token with updated email
    const newToken = app.jwt.sign(
      { id: user.id, email, role: user.role },
      { expiresIn: '24h' }
    );

    reply.setCookie('admin_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/admin',
      maxAge: 86400,
    });

    return reply.send({
      user: { id: user.id, email, role: user.role },
    });
  });

  // ── GET /api/admin/auth/me ────────────────────────────────
  app.get('/auth/me', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const payload = await request.jwtVerify() as { id: string; email: string; role: string };
      return reply.send({ user: { id: payload.id, email: payload.email, role: payload.role } });
    } catch {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
  });

  // ── POST /api/admin/auth/logout ───────────────────────────
  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie('admin_session', { path: '/api/admin' });
    return reply.send({ ok: true });
  });

  // All routes below require admin auth (auth/me and auth/logout handle their own auth)
  app.addHook('preHandler', async (request, reply) => {
    const openPaths = ['/api/admin/auth/login', '/api/admin/auth/setup', '/api/admin/auth/me', '/api/admin/auth/logout'];
    if (openPaths.includes(request.url)) return;
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
      const parsed = configUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid config' });
      }
      const { deviceId } = request.params;

      const [device] = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.deviceId, deviceId))
        .limit(1);

      if (!device) return reply.status(404).send({ error: 'Device not found' });

      const currentConfig = (device.config || {}) as Record<string, unknown>;
      const mergedConfig = { ...currentConfig, ...parsed.data };

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
    const { version, sha256, size, r2Url, releaseNotes, rolloutPercent, hardwareType } = parsed.data;

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
        hardwareType: hardwareType || 'esp32c3-v1',
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

  // ── POST /api/admin/releases/upload ──────────────────────
  // Multipart firmware binary upload
  app.post('/releases/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    // Read form fields
    const fields = data.fields as Record<string, { value?: string }>;
    const version = fields.version?.value;
    const hardwareType = fields.hardwareType?.value || 'esp32c3-v1';
    const releaseNotes = fields.releaseNotes?.value || '';

    if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
      return reply.status(400).send({ error: 'Invalid or missing version field' });
    }

    // Validate file size
    if (buffer.length > 2 * 1024 * 1024) {
      return reply.status(400).send({ error: 'File too large (max 2MB)' });
    }

    // Compute SHA256
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Upload to R2
    const key = await uploadFirmware(version, buffer);

    // Check for existing version
    const [existing] = await db
      .select().from(schema.releases)
      .where(eq(schema.releases.version, version)).limit(1);

    if (existing) return reply.status(409).send({ error: 'Version already exists' });

    // Create release record
    const [release] = await db
      .insert(schema.releases)
      .values({
        version,
        sha256,
        size: buffer.length,
        r2Url: key,
        releaseNotes,
        rolloutPercent: 0,
        isStable: false,
        autoUpdate: false,
        hardwareType,
      })
      .returning();

    return reply.status(201).send({ release });
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

    // Daily aggregated stats
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dailyAgg = await db
      .select({
        date: sql<string>`date_trunc('day', ${schema.stats.date})::date`,
        totalPlays: sql<number>`coalesce(sum(
          coalesce((${schema.stats.prayerPlays}->>'fajr')::int, 0) +
          coalesce((${schema.stats.prayerPlays}->>'dhuhr')::int, 0) +
          coalesce((${schema.stats.prayerPlays}->>'asr')::int, 0) +
          coalesce((${schema.stats.prayerPlays}->>'maghrib')::int, 0) +
          coalesce((${schema.stats.prayerPlays}->>'isha')::int, 0)
        ), 0)`,
        totalErrors: sql<number>`coalesce(sum(${schema.stats.errors}), 0)`,
        avgUptime: sql<number>`coalesce(avg(${schema.stats.uptime}), 0)`,
        deviceCount: sql<number>`count(distinct ${schema.stats.deviceId})`,
      })
      .from(schema.stats)
      .where(gte(schema.stats.date, daysAgo))
      .groupBy(sql`date_trunc('day', ${schema.stats.date})::date`)
      .orderBy(sql`date_trunc('day', ${schema.stats.date})::date`);

    return reply.send({
      totalDevices: Number(deviceCount.count),
      onlineDevices: Number(onlineCount.count),
      firmwareVersions: versionDist,
      dailyStats: dailyAgg,
    });
  });
}
