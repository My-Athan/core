import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { deviceRoutes } from './routes/device/index.js';
import { adminRoutes } from './routes/admin/index.js';

// ── Environment validation ──────────────────────────────────
const requiredEnv = ['DATABASE_URL'];
if (process.env.NODE_ENV === 'production') {
  requiredEnv.push('JWT_SECRET');
}
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// ── Plugins ─────────────────────────────────────────────────

// CORS: restrict to known origins in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
  credentials: true,
});

// JWT
await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PRODUCTION',
});

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// ── Routes ──────────────────────────────────────────────────
await app.register(deviceRoutes, { prefix: '/api/device' });
await app.register(adminRoutes, { prefix: '/api/admin' });

// Health check
app.get('/health', async () => ({
  status: 'ok',
  version: '0.2.0',
  timestamp: new Date().toISOString(),
}));

// ── Start ───────────────────────────────────────────────────
const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`MyAthan API running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
