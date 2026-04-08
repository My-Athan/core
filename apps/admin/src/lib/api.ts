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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; role: string }; mustChangePassword: boolean }>('POST', '/api/admin/auth/login', { email, password }),
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
};
