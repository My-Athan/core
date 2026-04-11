// Use relative URLs so the Vite proxy (dev) or same-domain routing (prod) handles API requests.
// This ensures the httpOnly admin_session cookie is same-site and works without CORS credentials.
const BASE = import.meta.env.VITE_API_URL ?? '';

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.append(key, String(value));
  }
  return searchParams.toString();
}

async function request<T>(method: string, path: string, body?: unknown, opts?: { skipAuthRedirect?: boolean }): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !opts?.skipAuthRedirect) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; role: string }; mustChangePassword: boolean }>('POST', '/api/admin/auth/login', { email, password }, { skipAuthRedirect: true }),
  setup: (email: string, password: string) =>
    request<{ user: { id: string; email: string; role: string } }>('POST', '/api/admin/auth/setup', { email, password }),
  me: () =>
    request<{ user: { id: string; email: string; role: string } }>('GET', '/api/admin/auth/me'),
  logout: () =>
    request<{ ok: boolean }>('POST', '/api/admin/auth/logout'),
  getDevices: (page = 1, limit = 50) =>
    request<{ devices: any[]; total: number }>('GET', `/api/admin/devices?${buildQuery({ page, limit })}`),
  getDevice: (deviceId: string) =>
    request<{ device: any; stats: any[] }>('GET', `/api/admin/devices/${encodeURIComponent(deviceId)}`),
  updateDeviceConfig: (deviceId: string, config: Record<string, unknown>) =>
    request<{ ok: boolean }>('PUT', `/api/admin/devices/${encodeURIComponent(deviceId)}/config`, config),
  getReleases: () =>
    request<{ releases: any[] }>('GET', '/api/admin/releases'),
  createRelease: (data: { version: string; sha256: string; size: number; r2Url: string; releaseNotes?: string }) =>
    request<{ release: any }>('POST', '/api/admin/releases', data),
  updateRelease: (version: string, data: { rolloutPercent?: number; isStable?: boolean }) =>
    request<{ release: any }>('PUT', `/api/admin/releases/${encodeURIComponent(version)}`, data),
  getGroups: () =>
    request<{ groups: any[] }>('GET', '/api/admin/groups'),
  createGroup: (name: string, deviceIds?: string[]) =>
    request<{ group: any }>('POST', '/api/admin/groups', { name, deviceIds }),
  triggerSync: (groupId: string, prayer: number) =>
    request<{ trigger: any }>('POST', `/api/admin/groups/${encodeURIComponent(groupId)}/sync`, { prayer }),
  getStats: (days = 7) =>
    request<{ totalDevices: number; onlineDevices: number; dailyStats: any[]; firmwareVersions: any[] }>('GET', `/api/admin/stats?${buildQuery({ days })}`),
  getMapDevices: () =>
    request<{ devices: any[] }>('GET', '/api/admin/analytics/map'),
  sendDeviceCommand: (deviceId: string, command: string, payload?: Record<string, unknown>) =>
    request<{ command: any }>('POST', `/api/admin/analytics/devices/${encodeURIComponent(deviceId)}/command`, { command, payload }),
  getDeviceCommands: (deviceId: string) =>
    request<{ commands: any[] }>('GET', `/api/admin/analytics/devices/${encodeURIComponent(deviceId)}/commands`),
  uploadRelease: (file: File, version: string, hardwareType: string, releaseNotes?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('version', version);
    form.append('hardwareType', hardwareType);
    if (releaseNotes) form.append('releaseNotes', releaseNotes);
    return fetch(`${BASE}/api/admin/releases/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(r => r.json());
  },
  forceUpdateDevice: (deviceId: string, version: string) =>
    request<{ command: any }>('POST', `/api/admin/analytics/devices/${encodeURIComponent(deviceId)}/command`, {
      command: 'ota_update',
      payload: { version, force: true },
    }),
  getSSOConfig: () =>
    request<{ configs: any[] }>('GET', '/api/admin/sso-config'),
  updateSSOConfig: (provider: string, data: {
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    logtoEndpoint?: string;
    requireEmailVerification?: boolean;
  }) =>
    request<{ ok: boolean }>('PUT', `/api/admin/sso-config/${encodeURIComponent(provider)}`, data),

  // ── App Users ─────────────────────────────────────────────
  getAppUsers: (params: { page?: number; limit?: number; search?: string; status?: string; authProvider?: string }) =>
    request<{ users: any[]; total: number; page: number; limit: number }>('GET', `/api/admin/app-users?${buildQuery(params)}`),
  getAppUser: (userId: string) =>
    request<{ user: any; devices: any[] }>('GET', `/api/admin/app-users/${encodeURIComponent(userId)}`),
  createAppUser: (data: { email: string; displayName: string; tempPassword: string; language?: string }) =>
    request<{ user: any; tempPassword: string }>('POST', '/api/admin/app-users', data),
  updateAppUser: (userId: string, data: { email?: string; displayName?: string; language?: string }) =>
    request<{ user: any }>('PATCH', `/api/admin/app-users/${encodeURIComponent(userId)}`, data),
  blockAppUser: (userId: string, reason: string) =>
    request<{ user: any }>('POST', `/api/admin/app-users/${encodeURIComponent(userId)}/block`, { reason }),
  unblockAppUser: (userId: string) =>
    request<{ user: any }>('POST', `/api/admin/app-users/${encodeURIComponent(userId)}/unblock`),
  resetAppUserPassword: (userId: string) =>
    request<{ user: any; tempPassword: string }>('POST', `/api/admin/app-users/${encodeURIComponent(userId)}/reset-password`),
  deleteAppUser: (userId: string) =>
    request<{ user: any }>('DELETE', `/api/admin/app-users/${encodeURIComponent(userId)}`),
  restoreAppUser: (userId: string) =>
    request<{ user: any }>('POST', `/api/admin/app-users/${encodeURIComponent(userId)}/restore`),
  purgeAppUser: (userId: string) =>
    request<{ ok: boolean }>('POST', `/api/admin/app-users/${encodeURIComponent(userId)}/purge`),
};
