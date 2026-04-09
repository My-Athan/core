/**
 * Mobile App Authentication Routes
 * Supports: Email/password + Google OAuth for PWA users.
 * Admin portal uses a separate auth system (/api/admin/auth).
 */
import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../../db/index.js';
import { appAuth, googleTokenAuth } from '../../middleware/app-auth.js';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// ── Helpers ──────────────────────────────────────────────────

function issueAppToken(app: FastifyInstance, userId: string, email: string): string {
  return app.jwt.sign({ id: userId, email, type: 'app' }, { expiresIn: '30d' });
}

function setCookieForApp(reply: any, token: string) {
  reply.setCookie('app_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 86400,
  });
}

export async function appAuthRoutes(app: FastifyInstance) {
  // All routes are defined inside a scoped plugin where @fastify/rate-limit is
  // explicitly registered on the same instance (scoped). This makes the rate-limiting
  // unambiguous to static analysis tools (CodeQL) which trace scope ownership.
  await app.register(async function rateLimitedRoutes(scoped: FastifyInstance) {
    await scoped.register(rateLimit, { max: 30, timeWindow: '1 minute' });

    // ── POST /api/auth/register ───────────────────────────────
    scoped.post('/register', {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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
      const [user] = await db.insert(schema.appUsers).values({
        email,
        passwordHash,
        displayName: displayName || email.split('@')[0],
        emailVerified: !(emailConfig?.requireEmailVerification),
      }).returning({ id: schema.appUsers.id, email: schema.appUsers.email });

      const token = issueAppToken(app, user.id, user.email);
      setCookieForApp(reply, token);

      return reply.status(201).send({
        user: { id: user.id, email: user.email, displayName: displayName || email.split('@')[0] },
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

      const token = issueAppToken(app, user.id, user.email);
      setCookieForApp(reply, token);

      return reply.send({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        token,
      });
    });

    // ── POST /api/auth/google ─────────────────────────────────
    // googleTokenAuth preHandler validates the ID token; handler only does user upsert.
    scoped.post('/google', {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: googleTokenAuth,
    }, async (request, reply) => {
      const { sub, email, name } = (request as any).googleClaims as {
        sub: string; email: string; name?: string;
      };

      const [existing] = await db.select().from(schema.appUsers)
        .where(eq(schema.appUsers.email, email)).limit(1);

      let userId: string;
      let userEmail: string;
      let displayName: string;

      if (existing) {
        if (!existing.googleId) {
          await db.update(schema.appUsers)
            .set({ googleId: sub, updatedAt: new Date() })
            .where(eq(schema.appUsers.id, existing.id));
        }
        userId = existing.id;
        userEmail = existing.email;
        displayName = existing.displayName || name || email.split('@')[0];
      } else {
        const [newUser] = await db.insert(schema.appUsers).values({
          email,
          googleId: sub,
          displayName: name || email.split('@')[0],
          emailVerified: true,
        }).returning({ id: schema.appUsers.id, email: schema.appUsers.email, displayName: schema.appUsers.displayName });
        userId = newUser.id;
        userEmail = newUser.email;
        displayName = newUser.displayName || email.split('@')[0];
      }

      const token = issueAppToken(app, userId, userEmail);
      setCookieForApp(reply, token);

      return reply.send({
        user: { id: userId, email: userEmail, displayName },
        token,
      });
    });

    // ── GET /api/auth/me ──────────────────────────────────────
    // appAuth preHandler calls jwtVerify(); handler only does DB lookup.
    scoped.get('/me', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      preHandler: appAuth,
    }, async (request, reply) => {
      const { id } = (request as any).appUser as { id: string };

      const [user] = await db.select({
        id: schema.appUsers.id,
        email: schema.appUsers.email,
        displayName: schema.appUsers.displayName,
        emailVerified: schema.appUsers.emailVerified,
        createdAt: schema.appUsers.createdAt,
      }).from(schema.appUsers).where(eq(schema.appUsers.id, id)).limit(1);

      if (!user) return reply.status(404).send({ error: 'User not found' });
      return reply.send({ user });
    });

    // ── POST /api/auth/logout ─────────────────────────────────
    scoped.post('/logout', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (_request, reply) => {
      reply.clearCookie('app_session', { path: '/api/auth' });
      return reply.send({ ok: true });
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
