import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, schema } from './index.js';

const DEFAULT_ADMIN_EMAIL = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin@MyAthan';

/**
 * Seeds the database with a default admin user if no admin users exist.
 * The default user has mustChangePassword=true, forcing credential update on first login.
 */
export async function seedDefaultAdmin() {
  const [existingAdmin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);

  if (existingAdmin) {
    return; // Admin already exists, skip seeding
  }

  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  await db.insert(schema.users).values({
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash: hash,
    role: 'admin',
    mustChangePassword: true,
  });

  console.log('[Seed] Default admin user created (admin / admin@MyAthan). Change credentials on first login.');
}
