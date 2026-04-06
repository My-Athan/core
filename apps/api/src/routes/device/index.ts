import type { FastifyInstance } from 'fastify';

export async function deviceRoutes(app: FastifyInstance) {

  // POST /api/device/register
  app.post('/register', async (request, reply) => {
    // TODO: Device registration with API key from MAC
    return { status: 'not_implemented' };
  });

  // GET /api/device/config
  app.get('/config', async (request, reply) => {
    // TODO: Return device config from database
    return { status: 'not_implemented' };
  });

  // PUT /api/device/config
  app.put('/config', async (request, reply) => {
    // TODO: Update device config
    return { status: 'not_implemented' };
  });

  // POST /api/device/heartbeat
  app.post('/heartbeat', async (request, reply) => {
    // TODO: Update device heartbeat + stats
    return { status: 'not_implemented' };
  });

  // GET /api/device/timetable
  app.get('/timetable', async (request, reply) => {
    // TODO: Server-side prayer time calculation using adhan
    return { status: 'not_implemented' };
  });

  // GET /api/device/ota/check
  app.get('/ota/check', async (request, reply) => {
    // TODO: Check for firmware updates
    return { status: 'not_implemented' };
  });

  // GET /api/device/sync
  app.get('/sync', async (request, reply) => {
    // TODO: Get pending multi-room sync triggers
    return { status: 'not_implemented' };
  });
}
