import type { FastifyInstance } from 'fastify';
import { eq, desc, sql, and, isNotNull, or, ilike } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from '@fastify/rate-limit';
import { db, schema } from '../../db/index.js';
import { adminAuth } from '../../middleware/device-auth.js';
import type { AppUser, AppUserAuthProvider, AppUserStatus } from '@myathan/shared';

const SOFT_DELETE_GRACE_DAYS = 30;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(255).optional(),
  status: z.enum(['active', 'invited', 'blocked', 'deleted']).optional(),
  authProvider: z.enum(['google', 'email']).optional(),
});

const createSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  tempPassword: z.string().min(8).max(128),
  language: z.string().min(2).max(8).optional(),
});

const updateSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().min(1).max(100).optional(),
  language: z.string().min(2).max(8).optional(),
});

const blockSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ── Serializer ──────────────────────────────────────────────
// Never leak passwordHash or raw googleId. The googleId is replaced
// by a boolean presence flag via the `authProviders` array.
function toAppUser(row: typeof schema.appUsers.$inferSelect): AppUser {
  const providers: AppUserAuthProvider[] = [];
  if (row.googleId) providers.push('google');
  if (row.passwordHash) providers.push('email');
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    language: row.language,
    status: row.status as AppUserStatus,
    emailVerified: row.emailVerified,
    authProviders: providers,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    blockedReason: row.blockedReason,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    purgeAt: row.purgeAt ? row.purgeAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function appUserAdminRoutes(app: FastifyInstance) {
  await app.register(async function rateLimitedAppUserRoutes(scoped: FastifyInstance) {
    await scoped.register(rateLimit, { max: 100, timeWindow: '1 minute' });

    // ── GET /api/admin/app-users ────────────────────────────
    scoped.get('/', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
      }
      const { page, limit, search, status, authProvider } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(schema.appUsers.email, `%${search}%`),
            ilike(schema.appUsers.displayName, `%${search}%`),
          )
        );
      }
      if (status) {
        conditions.push(eq(schema.appUsers.status, status));
      }
      if (authProvider === 'google') {
        conditions.push(isNotNull(schema.appUsers.googleId));
      } else if (authProvider === 'email') {
        conditions.push(isNotNull(schema.appUsers.passwordHash));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(schema.appUsers)
        .where(whereClause)
        .orderBy(desc(schema.appUsers.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appUsers)
        .where(whereClause);

      return reply.send({
        users: rows.map(toAppUser),
        total: Number(count),
        page,
        limit,
      });
    });

    // ── GET /api/admin/app-users/:userId ────────────────────
    scoped.get<{ Params: { userId: string } }>('/:userId', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;

      const [row] = await db
        .select()
        .from(schema.appUsers)
        .where(eq(schema.appUsers.id, userId))
        .limit(1);

      if (!row) return reply.status(404).send({ error: 'User not found' });

      const linkedDevices = await db
        .select({
          id: schema.devices.id,
          deviceId: schema.devices.deviceId,
          firmwareVersion: schema.devices.firmwareVersion,
          lastHeartbeat: schema.devices.lastHeartbeat,
          city: schema.devices.city,
          country: schema.devices.country,
        })
        .from(schema.devices)
        .where(eq(schema.devices.appUserId, userId));

      return reply.send({
        user: toAppUser(row),
        devices: linkedDevices,
      });
    });

    // ── POST /api/admin/app-users ───────────────────────────
    // Admin creates a user directly with a temp password.
    // The temp password is returned ONCE in the response so the
    // admin can copy it — after this it only exists as a bcrypt hash.
    scoped.post('/', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }
      const { email, displayName, tempPassword, language } = parsed.data;
      const admin = (request as any).user as { id: string };

      const [existing] = await db
        .select({ id: schema.appUsers.id })
        .from(schema.appUsers)
        .where(eq(schema.appUsers.email, email))
        .limit(1);

      if (existing) {
        return reply.status(409).send({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [created] = await db
        .insert(schema.appUsers)
        .values({
          email,
          passwordHash,
          displayName,
          language: language || 'en',
          status: 'active',
          mustChangePassword: true,
          createdBy: admin.id,
        })
        .returning();

      return reply.status(201).send({
        user: toAppUser(created),
        tempPassword,
      });
    });

    // ── PATCH /api/admin/app-users/:userId ──────────────────
    scoped.patch<{ Params: { userId: string } }>('/:userId', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }
      const { userId } = request.params;
      const { email, displayName, language } = parsed.data;

      // If email is changing, make sure it isn't taken by another user
      if (email) {
        const [clash] = await db
          .select({ id: schema.appUsers.id })
          .from(schema.appUsers)
          .where(eq(schema.appUsers.email, email))
          .limit(1);
        if (clash && clash.id !== userId) {
          return reply.status(409).send({ error: 'Email already in use' });
        }
      }

      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (email !== undefined) update.email = email;
      if (displayName !== undefined) update.displayName = displayName;
      if (language !== undefined) update.language = language;

      const [updated] = await db
        .update(schema.appUsers)
        .set(update)
        .where(eq(schema.appUsers.id, userId))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/admin/app-users/:userId/block ─────────────
    scoped.post<{ Params: { userId: string } }>('/:userId/block', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = blockSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }
      const { userId } = request.params;
      const { reason } = parsed.data;

      const [updated] = await db
        .update(schema.appUsers)
        .set({
          status: 'blocked',
          blockedAt: new Date(),
          blockedReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(schema.appUsers.id, userId))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/admin/app-users/:userId/unblock ───────────
    scoped.post<{ Params: { userId: string } }>('/:userId/unblock', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;

      const [current] = await db
        .select()
        .from(schema.appUsers)
        .where(eq(schema.appUsers.id, userId))
        .limit(1);

      if (!current) return reply.status(404).send({ error: 'User not found' });
      if (current.status !== 'blocked') {
        return reply.status(409).send({ error: 'User is not blocked' });
      }

      const [updated] = await db
        .update(schema.appUsers)
        .set({
          status: 'active',
          blockedAt: null,
          blockedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.appUsers.id, userId))
        .returning();

      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/admin/app-users/:userId/reset-password ────
    // Generates a new temp password, forces change on next login,
    // and returns it ONCE in the response.
    scoped.post<{ Params: { userId: string } }>('/:userId/reset-password', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;

      // Generate a 16-char random temp password (alphanumeric, ambiguity-safe)
      const tempPassword = generateTempPassword(16);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [updated] = await db
        .update(schema.appUsers)
        .set({
          passwordHash,
          mustChangePassword: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.appUsers.id, userId))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(updated), tempPassword });
    });

    // ── DELETE /api/admin/app-users/:userId ─────────────────
    // Soft delete: mark as deleted and schedule purge after grace period.
    scoped.delete<{ Params: { userId: string } }>('/:userId', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;
      const now = new Date();
      const purgeAt = new Date(now.getTime() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(schema.appUsers)
        .set({
          status: 'deleted',
          deletedAt: now,
          purgeAt,
          updatedAt: now,
        })
        .where(eq(schema.appUsers.id, userId))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/admin/app-users/:userId/restore ───────────
    // Undo a soft delete, only valid during the grace window.
    scoped.post<{ Params: { userId: string } }>('/:userId/restore', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;

      const [current] = await db
        .select()
        .from(schema.appUsers)
        .where(eq(schema.appUsers.id, userId))
        .limit(1);

      if (!current) return reply.status(404).send({ error: 'User not found' });
      if (current.status !== 'deleted') {
        return reply.status(409).send({ error: 'User is not deleted' });
      }
      if (current.purgeAt && current.purgeAt <= new Date()) {
        return reply.status(410).send({ error: 'Grace period expired, user cannot be restored' });
      }

      const [updated] = await db
        .update(schema.appUsers)
        .set({
          status: 'active',
          deletedAt: null,
          purgeAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.appUsers.id, userId))
        .returning();

      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/admin/app-users/:userId/purge ─────────────
    // Immediate hard delete (GDPR right-to-erasure).
    // Requires the user to already be in 'deleted' status to prevent
    // accidental single-click data loss.
    scoped.post<{ Params: { userId: string } }>('/:userId/purge', {
      preHandler: adminAuth,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const { userId } = request.params;

      const [current] = await db
        .select({ id: schema.appUsers.id, status: schema.appUsers.status })
        .from(schema.appUsers)
        .where(eq(schema.appUsers.id, userId))
        .limit(1);

      if (!current) return reply.status(404).send({ error: 'User not found' });
      if (current.status !== 'deleted') {
        return reply.status(409).send({
          error: 'User must be soft-deleted before purge. Call DELETE first.',
        });
      }

      await db.delete(schema.appUsers).where(eq(schema.appUsers.id, userId));
      return reply.send({ ok: true });
    });
  });
}

// 16-char password from an unambiguous alphabet (no 0/O/1/l/I).
function generateTempPassword(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
