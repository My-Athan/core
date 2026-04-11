/**
 * Mobile App Authentication Routes
 * Supports: Email/password + Google OAuth for PWA users.
 * Admin portal uses a separate auth system (/api/admin/auth).
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../../db/index.js';
import { appAuth, googleTokenAuth } from '../../middleware/app-auth.js';
import { toAppUser } from '../../utils/app-user.js';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(2048).optional().or(z.literal('')),
  language: z.string().min(2).max(8).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128),
});

// ── Helpers ──────────────────────────────────────────────────

function getDisplayName(displayName: string | null | undefined, email: string): string {
  return displayName || email.split('@')[0];
}

function issueAppToken(app: FastifyInstance, userId: string, email: string): string {
  return app.jwt.sign({ id: userId, email, type: 'app' }, { expiresIn: '7d' });
}

function setCookieForApp(reply: FastifyReply, token: string) {
  reply.setCookie('app_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 86400,
  });
}

export async function appAuthRoutes(app: FastifyInstance) {
  // All routes are defined inside a scoped plugin where @fastify/rate-limit is
  // explicitly registered on the same instance (scoped). This makes the rate-limiting
  // unambiguous to static analysis tools (CodeQL) which trace scope ownership.
  await app.register(async function rateLimitedRoutes(scoped: FastifyInstance) {
    await scoped.register(rateLimit, { max: process.env.NODE_ENV === 'test' ? 500 : 30, timeWindow: '1 minute' });

    // ── POST /api/auth/register ───────────────────────────────
    scoped.post('/register', {
      config: { rateLimit: { max: process.env.NODE_ENV === 'test' ? 200 : 10, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const [emailConfig] = await db.select().from(schema.ssoConfig)
        .where(eq(schema.ssoConfig.provider, 'email')).limit(1);
      if (emailConfig && !emailConfig.enabled) {
        return reply.status(403).send({ error: 'Email registration is disabled' });
      }

      const { email, password, displayName } = parsed.data;

      const [existing] = await db.select({ id: schema.appUsers.id })
        .from(schema.appUsers).where(eq(schema.appUsers.email, email)).limit(1);

      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const [user] = await db.insert(schema.appUsers).values({
        email,
        passwordHash,
        displayName: getDisplayName(displayName, email),
        emailVerified: !(emailConfig?.requireEmailVerification),
        status: 'active',
        lastLoginAt: now,
      }).returning({ id: schema.appUsers.id, email: schema.appUsers.email });

      const token = issueAppToken(app, user.id, user.email);
      setCookieForApp(reply, token);

      return reply.status(201).send({
        user: { id: user.id, email: user.email, displayName: getDisplayName(displayName, email) },
        token,
      });
    });

    // ── POST /api/auth/login ──────────────────────────────────
    scoped.post('/login', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }

      const { email, password } = parsed.data;

      const [user] = await db.select().from(schema.appUsers)
        .where(eq(schema.appUsers.email, email)).limit(1);

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Lifecycle gates — credentials may be valid but the account isn't usable.
      if (user.status === 'blocked') {
        return reply.status(403).send({ error: 'Account blocked', code: 'account_blocked' });
      }
      if (user.status === 'deleted') {
        return reply.status(403).send({ error: 'Account deleted', code: 'account_deleted' });
      }

      await db.update(schema.appUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(schema.appUsers.id, user.id));

      const token = issueAppToken(app, user.id, user.email);
      setCookieForApp(reply, token);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          mustChangePassword: user.mustChangePassword,
        },
        token,
      });
    });

    // ── POST /api/auth/google ─────────────────────────────────
    // googleTokenAuth preHandler validates the ID token; handler only does user upsert.
    scoped.post('/google', {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: googleTokenAuth,
    }, async (request, reply) => {
      const { sub, email, name, picture } = (request as any).googleClaims as {
        sub: string; email: string; name?: string; picture?: string;
      };

      const [existing] = await db.select().from(schema.appUsers)
        .where(eq(schema.appUsers.email, email)).limit(1);

      const now = new Date();
      let userId: string;
      let userEmail: string;
      let displayName: string;
      let mustChangePassword = false;

      if (existing) {
        if (existing.status === 'blocked') {
          return reply.status(403).send({ error: 'Account blocked', code: 'account_blocked' });
        }
        if (existing.status === 'deleted') {
          return reply.status(403).send({ error: 'Account deleted', code: 'account_deleted' });
        }

        // Link Google identity on first sign-in and backfill avatar if missing.
        const update: Record<string, unknown> = { updatedAt: now, lastLoginAt: now };
        if (!existing.googleId) update.googleId = sub;
        if (!existing.avatarUrl && picture) update.avatarUrl = picture;
        await db.update(schema.appUsers)
          .set(update)
          .where(eq(schema.appUsers.id, existing.id));

        userId = existing.id;
        userEmail = existing.email;
        displayName = existing.displayName || getDisplayName(name, email);
        mustChangePassword = existing.mustChangePassword;
      } else {
        const [newUser] = await db.insert(schema.appUsers).values({
          email,
          googleId: sub,
          displayName: getDisplayName(name, email),
          avatarUrl: picture || null,
          emailVerified: true,
          status: 'active',
          lastLoginAt: now,
        }).returning({
          id: schema.appUsers.id,
          email: schema.appUsers.email,
          displayName: schema.appUsers.displayName,
        });
        userId = newUser.id;
        userEmail = newUser.email;
        displayName = getDisplayName(newUser.displayName, email);
      }

      const token = issueAppToken(app, userId, userEmail);
      setCookieForApp(reply, token);

      return reply.send({
        user: { id: userId, email: userEmail, displayName, mustChangePassword },
        token,
      });
    });

    // ── GET /api/auth/me ──────────────────────────────────────
    // appAuth preHandler calls jwtVerify(); handler only does DB lookup.
    scoped.get('/me', {
      config: { rateLimit: { max: process.env.NODE_ENV === 'test' ? 500 : 60, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };

      const [row] = await db.select().from(schema.appUsers)
        .where(eq(schema.appUsers.id, id)).limit(1);

      if (!row) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(row) });
    });

    // ── POST /api/auth/logout ─────────────────────────────────
    scoped.post('/logout', {
      config: { rateLimit: { max: process.env.NODE_ENV === 'test' ? 500 : 60, timeWindow: '1 minute' } },
    }, async (_request, reply) => {
      reply.clearCookie('app_session', { path: '/api/auth' });
      return reply.send({ ok: true });
    });

    // ── PATCH /api/auth/profile ───────────────────────────────
    // Users update their own displayName, avatarUrl, and language.
    // Cannot change email here — email is tied to identity (Google/password).
    scoped.patch('/profile', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const parsed = profileUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }
      const { id } = (request as any).appUser as { id: string };
      const { displayName, avatarUrl, language } = parsed.data;

      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (displayName !== undefined) update.displayName = displayName;
      if (avatarUrl !== undefined) update.avatarUrl = avatarUrl === '' ? null : avatarUrl;
      if (language !== undefined) update.language = language;

      const [updated] = await db.update(schema.appUsers)
        .set(update)
        .where(eq(schema.appUsers.id, id))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user: toAppUser(updated) });
    });

    // ── POST /api/auth/change-password ────────────────────────
    // Required when mustChangePassword=true (admin-created or reset accounts).
    // Otherwise requires the current password for verification. Google-only
    // users (no passwordHash) cannot set a password here — they authenticate
    // via the Google flow.
    scoped.post('/change-password', {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }
      const { id } = (request as any).appUser as { id: string };
      const { currentPassword, newPassword } = parsed.data;

      const [user] = await db.select().from(schema.appUsers)
        .where(eq(schema.appUsers.id, id)).limit(1);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      if (!user.passwordHash) {
        return reply.status(409).send({
          error: 'Password auth is not set up for this account',
          code: 'no_password_set',
        });
      }

      // If the user is NOT in forced-rotation mode, verify the current password.
      if (!user.mustChangePassword) {
        if (!currentPassword) {
          return reply.status(400).send({ error: 'Current password required' });
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          return reply.status(401).send({ error: 'Invalid current password' });
        }
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const [updated] = await db.update(schema.appUsers)
        .set({
          passwordHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.appUsers.id, id))
        .returning();

      return reply.send({ user: toAppUser(updated) });
    });

    // ── GET /api/auth/devices ─────────────────────────────────
    // Lists devices owned by the authenticated user.
    scoped.get('/devices', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };

      const rows = await db
        .select({
          id: schema.devices.id,
          deviceId: schema.devices.deviceId,
          firmwareVersion: schema.devices.firmwareVersion,
          lastHeartbeat: schema.devices.lastHeartbeat,
          city: schema.devices.city,
          country: schema.devices.country,
          hardwareType: schema.devices.hardwareType,
        })
        .from(schema.devices)
        .where(eq(schema.devices.appUserId, id));

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const devices = rows.map(d => ({
        ...d,
        online: d.lastHeartbeat ? d.lastHeartbeat > fiveMinAgo : false,
      }));

      return reply.send({ devices });
    });

    // ── POST /api/auth/devices/:deviceId/link ────────────────
    // Link a device to the authenticated user's account.
    // The device must already exist in the DB (registered by the firmware).
    // A device already linked to a different user is rejected (403).
    // Linking to oneself is idempotent (200).
    scoped.post<{ Params: { deviceId: string } }>('/devices/:deviceId/link', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };
      const { deviceId } = request.params;

      const [device] = await db.select({
        id: schema.devices.id,
        appUserId: schema.devices.appUserId,
      }).from(schema.devices)
        .where(eq(schema.devices.deviceId, deviceId))
        .limit(1);

      if (!device) return reply.status(404).send({ error: 'Device not found' });

      if (device.appUserId && device.appUserId !== id) {
        return reply.status(403).send({ error: 'Device is linked to another account' });
      }

      if (device.appUserId === id) {
        return reply.send({ ok: true }); // idempotent
      }

      await db.update(schema.devices)
        .set({ appUserId: id, updatedAt: new Date() })
        .where(eq(schema.devices.id, device.id));

      return reply.send({ ok: true });
    });

    // ── POST /api/auth/devices/:deviceId/unlink ───────────────
    // Detach a device the user owns (e.g. giving it to someone else).
    // Only the owner can unlink — admins use the admin route.
    scoped.post<{ Params: { deviceId: string } }>('/devices/:deviceId/unlink', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };
      const { deviceId } = request.params;

      const [device] = await db.select({
        id: schema.devices.id,
        appUserId: schema.devices.appUserId,
      }).from(schema.devices)
        .where(eq(schema.devices.deviceId, deviceId))
        .limit(1);

      if (!device) return reply.status(404).send({ error: 'Device not found' });
      if (device.appUserId !== id) {
        return reply.status(403).send({ error: 'Not your device' });
      }

      await db.update(schema.devices)
        .set({ appUserId: null, updatedAt: new Date() })
        .where(eq(schema.devices.id, device.id));

      return reply.send({ ok: true });
    });

    // ── DELETE /api/auth/account ──────────────────────────────
    // User-initiated soft delete. Mirrors the admin soft-delete path:
    // status -> 'deleted', 30-day grace before the purge worker removes
    // the row. Clears the session cookie so the user is immediately logged out.
    scoped.delete('/account', {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };
      const now = new Date();
      const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [updated] = await db.update(schema.appUsers)
        .set({
          status: 'deleted',
          deletedAt: now,
          purgeAt,
          updatedAt: now,
        })
        .where(eq(schema.appUsers.id, id))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'User not found' });

      reply.clearCookie('app_session', { path: '/api/auth' });
      return reply.send({ ok: true, purgeAt: purgeAt.toISOString() });
    });

    // ── GET /api/auth/providers ───────────────────────────────
    // Returns which auth methods are enabled (for the mobile app to show correct UI)
    scoped.get('/providers', async (_request, reply) => {
      const configs = await db.select({
        provider: schema.ssoConfig.provider,
        enabled: schema.ssoConfig.enabled,
      }).from(schema.ssoConfig);

      const providers: Record<string, boolean> = {
        email: true, // default enabled unless explicitly disabled
        google: false,
      };
      for (const c of configs) {
        providers[c.provider] = c.enabled;
      }

      return reply.send({ providers });
    });
  });
}
