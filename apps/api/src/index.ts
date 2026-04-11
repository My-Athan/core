import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import crypto from 'node:crypto';
import { deviceRoutes } from './routes/device/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { analyticsRoutes } from './routes/admin/analytics.js';
import { appUserAdminRoutes } from './routes/admin/app-users.js';
import { appAuthRoutes } from './routes/auth/index.js';

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

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// ── Plugins ─────────────────────────────────────────────────

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: false, // Configured at reverse-proxy level
});

// Cookie support (must be before JWT so JWT can read cookies)
await app.register(cookie);

// CORS: restrict to known origins always (never use true)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
});

// JWT — also accepts admin_session cookie
const jwtSecret = process.env.JWT_SECRET || (() => {
  console.warn('[WARN] JWT_SECRET not set — using random dev secret (sessions will not persist across restarts)');
  return crypto.randomBytes(32).toString('hex');
})();
await app.register(jwt, {
  secret: jwtSecret,
  cookie: {
    cookieName: 'admin_session',
    signed: false,
  },
});

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// ── Routes ──────────────────────────────────────────────────
await app.register(deviceRoutes, { prefix: '/api/device' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(analyticsRoutes, { prefix: '/api/admin/analytics' });
await app.register(appUserAdminRoutes, { prefix: '/api/admin/app-users' });
await app.register(appAuthRoutes, { prefix: '/api/auth' });

// Health check
app.get('/health', async () => ({
  status: 'ok',
  version: '0.2.1',
  timestamp: new Date().toISOString(),
}));

// ── Database migration + seed ──────────────────────────────
import { migrateDatabase } from './db/migrate.js';
import { seedDefaultAdmin } from './db/seed.js';
await migrateDatabase();
await seedDefaultAdmin();

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
