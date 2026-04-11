// ─────────────────────────────────────────────────────────────
// App User — mobile/PWA end users (separate from admin users)
// ─────────────────────────────────────────────────────────────

export type AppUserStatus = 'active' | 'invited' | 'blocked' | 'deleted';

export type AppUserAuthProvider = 'google' | 'email';

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  language: string;
  status: AppUserStatus;
  emailVerified: boolean;
  authProviders: AppUserAuthProvider[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  deletedAt: string | null;
  purgeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Fields the user can update on their own profile
export interface AppUserProfileUpdate {
  displayName?: string;
  avatarUrl?: string;
  language?: string;
}

// Fields an admin provides when creating a user directly
export interface AdminAppUserCreate {
  email: string;
  displayName: string;
  tempPassword: string;
  language?: string;
}

// Fields an admin can edit on an existing user
export interface AdminAppUserUpdate {
  email?: string;
  displayName?: string;
  language?: string;
}

export interface AdminAppUserBlockRequest {
  reason: string;
}

// Admin list endpoint query params
export interface AdminAppUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AppUserStatus;
  authProvider?: AppUserAuthProvider;
}

export interface AdminAppUserListResponse {
  users: AppUser[];
  total: number;
  page: number;
  limit: number;
}

// Response shape when admin creates a user or resets a password —
// the temp password is shown ONCE and never stored in plaintext again.
export interface AdminAppUserCredentialResponse {
  user: AppUser;
  tempPassword: string;
}
