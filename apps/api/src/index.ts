import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { deviceRoutes } from './routes/device/index.js';
import { adminRoutes } from './routes/admin/index.js';

const app = Fastify({
  logger: true,
});

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });

// Routes
await app.register(deviceRoutes, { prefix: '/api/device' });
await app.register(adminRoutes, { prefix: '/api/admin' });

// Health check
app.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

// Start
const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`MyAthan API running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
