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
// Verifies the app_session JWT and attaches the payload to
// request.appUser. Used as a preHandler on protected app routes.
// ─────────────────────────────────────────────────────────────

export async function appAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify() as { id: string; email: string; type: string };
    if (payload.type !== 'app') {
      return reply.status(403).send({ error: 'Invalid token type' });
    }
    (request as any).appUser = payload;
  } catch {
    return reply.status(401).send({ error: 'Not authenticated' });
  }
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
    };
  } catch (err: any) {
    if (err.message !== 'token expired' &&
        err.message !== 'audience mismatch' &&
        err.message !== 'issuer mismatch' &&
        err.message !== 'invalid token structure') throw err;
    return reply.status(401).send({ error: 'Invalid or expired Google token' });
  }
}
