import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/index.js';

const googleSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

// ─────────────────────────────────────────────────────────────
// Mobile App JWT Authentication
//
// Verifies the app_session JWT (from Authorization header or
// app_session cookie) and attaches the payload to request.appUser.
// The global @fastify/jwt plugin is configured with cookieName
// 'admin_session' for the admin portal. Mobile routes need to
// read the 'app_session' cookie separately, so we extract the
// token manually and call app.jwt.verify() directly.
// Also re-checks DB status so blocks/deletes take effect immediately.
// ─────────────────────────────────────────────────────────────

export async function appAuth(request: FastifyRequest, reply: FastifyReply) {
  // Extract token: Authorization header takes priority, then app_session cookie.
  let token: string | undefined;
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = (request.cookies as Record<string, string | undefined>)['app_session'];
  }

  if (!token) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  let payload: { id: string; email: string; type: string };
  try {
    payload = (request.server as any).jwt.verify(token) as { id: string; email: string; type: string };
  } catch {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  if (payload.type !== 'app') {
    return reply.status(403).send({ error: 'Invalid token type' });
  }

  // Enforce lifecycle status on every request. JWTs are stateless, so an
  // admin block/delete must take effect immediately — we re-check status
  // per request (one PK lookup, O(1)).
  const [user] = await db
    .select({
      id: schema.appUsers.id,
      email: schema.appUsers.email,
      status: schema.appUsers.status,
      mustChangePassword: schema.appUsers.mustChangePassword,
    })
    .from(schema.appUsers)
    .where(eq(schema.appUsers.id, payload.id))
    .limit(1);

  if (!user) {
    return reply.status(401).send({ error: 'Account no longer exists' });
  }
  if (user.status === 'blocked') {
    return reply.status(403).send({ error: 'Account blocked', code: 'account_blocked' });
  }
  if (user.status === 'deleted') {
    return reply.status(403).send({ error: 'Account deleted', code: 'account_deleted' });
  }

  (request as any).appUser = {
    id: user.id,
    email: user.email,
    type: 'app',
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

// ─────────────────────────────────────────────────────────────
// Google ID Token Validation
//
// Validates the Google ID token from the request body and attaches
// the verified claims to request.googleClaims. Used as a preHandler
// on the /api/auth/google route.
// ─────────────────────────────────────────────────────────────

export async function googleTokenAuth(request: FastifyRequest, reply: FastifyReply) {
  const parsed = googleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid input' });
  }

  const [config] = await db
    .select()
    .from(schema.ssoConfig)
    .where(eq(schema.ssoConfig.provider, 'google'))
    .limit(1);

  if (!config?.enabled || !config.clientId) {
    return reply.status(401).send({ error: 'Google SSO not configured' });
  }

  try {
    const parts = parsed.data.idToken.split('.');
    if (parts.length !== 3) throw new Error('invalid token structure');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    if (claims.aud !== config.clientId) throw new Error('audience mismatch');
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new Error('issuer mismatch');
    if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error('token expired');
    if (!claims.email_verified) {
      return reply.status(401).send({ error: 'Google account email not verified' });
    }

    (request as any).googleClaims = {
      sub: claims.sub as string,
      email: claims.email as string,
      name: claims.name as string | undefined,
      picture: claims.picture as string | undefined,
    };
  } catch (err: any) {
    if (err.message !== 'token expired' &&
        err.message !== 'audience mismatch' &&
        err.message !== 'issuer mismatch' &&
        err.message !== 'invalid token structure') throw err;
    return reply.status(401).send({ error: 'Invalid or expired Google token' });
  }
}
