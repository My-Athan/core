import type { AppUser } from '@myathan/shared';

const BASE = '';

// Token stored in memory + localStorage for persistence across reloads.
// The API also sets an httpOnly app_session cookie, but we carry the token
// in Authorization headers too so BLE-provisioned sessions (same-origin) work.
const TOKEN_KEY = 'app_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || `${res.status} ${res.statusText}`) as any;
    e.status = res.status;
    e.code = err.code;
    throw e;
  }
  return res.json();
}

export const authApi = {
  register: (email: string, password: string, displayName?: string) =>
    request<{ user: AppUser; token: string }>('POST', '/api/auth/register', { email, password, displayName }),

  login: (email: string, password: string) =>
    request<{ user: AppUser; token: string }>('POST', '/api/auth/login', { email, password }),

  googleAuth: (idToken: string) =>
    request<{ user: AppUser; token: string }>('POST', '/api/auth/google', { idToken }),

  me: () =>
    request<{ user: AppUser }>('GET', '/api/auth/me'),

  logout: () =>
    request<{ ok: boolean }>('POST', '/api/auth/logout'),

  updateProfile: (data: { displayName?: string; avatarUrl?: string; language?: string }) =>
    request<{ user: AppUser }>('PATCH', '/api/auth/profile', data),

  changePassword: (newPassword: string, currentPassword?: string) =>
    request<{ user: AppUser }>('POST', '/api/auth/change-password', { newPassword, currentPassword }),

  getDevices: () =>
    request<{ devices: any[] }>('GET', '/api/auth/devices'),

  unlinkDevice: (deviceId: string) =>
    request<{ ok: boolean }>('POST', `/api/auth/devices/${encodeURIComponent(deviceId)}/unlink`),

  deleteAccount: () =>
    request<{ ok: boolean; purgeAt: string }>('DELETE', '/api/auth/account'),

  getProviders: () =>
    request<{ providers: Record<string, boolean> }>('GET', '/api/auth/providers'),

  // Helpers — called by AuthContext after a successful auth response
  saveToken: setToken,
  clearToken,
};
