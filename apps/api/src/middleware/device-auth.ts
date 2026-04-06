import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────
// Device Authentication Middleware
//
// Devices authenticate via API key in the Authorization header:
//   Authorization: Bearer <api_key>
//
// API key is derived from the device MAC address + server salt.
// ─────────────────────────────────────────────────────────────

const API_KEY_SALT = process.env.API_KEY_SALT || 'myathan-default-salt-change-in-prod';

export function deriveApiKey(deviceId: string): string {
  return crypto
    .createHmac('sha256', API_KEY_SALT)
    .update(deviceId)
    .digest('hex');
}

export async function deviceAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing API key' });
  }

  const apiKey = authHeader.slice(7);

  const [device] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.apiKey, apiKey))
    .limit(1);

  if (!device) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  // Attach device to request for downstream handlers
  (request as any).device = device;
}

// ─────────────────────────────────────────────────────────────
// Admin JWT Authentication
// ─────────────────────────────────────────────────────────────

export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify();
    const user = payload as { id: string; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }
    (request as any).user = user;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}
