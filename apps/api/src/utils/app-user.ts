import { schema } from '../db/index.js';
import type { AppUser, AppUserAuthProvider, AppUserStatus } from '@myathan/shared';

// Serializes an app_users row into the public AppUser shape.
// Never leaks passwordHash or raw googleId — the googleId is replaced
// by a boolean presence flag in the authProviders array.
export function toAppUser(row: typeof schema.appUsers.$inferSelect): AppUser {
  const providers: AppUserAuthProvider[] = [];
  if (row.googleId) providers.push('google');
  if (row.passwordHash) providers.push('email');
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    language: row.language,
    status: row.status as AppUserStatus,
    emailVerified: row.emailVerified,
    authProviders: providers,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    blockedReason: row.blockedReason,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    purgeAt: row.purgeAt ? row.purgeAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
