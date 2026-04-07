const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let token = localStorage.getItem('admin_token') || '';

export function setToken(t: string) {
  token = t;
  localStorage.setItem('admin_token', t);
}

export function clearToken() {
  token = '';
  localStorage.removeItem('admin_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; role: string }; mustChangePassword: boolean }>('POST', '/api/admin/auth/login', { email, password }),
  setup: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>('POST', '/api/admin/auth/setup', { email, password }),
  getDevices: (page = 1, limit = 50) =>
    request<{ devices: any[]; total: number }>('GET', `/api/admin/devices?page=${page}&limit=${limit}`),
  getDevice: (deviceId: string) =>
    request<{ device: any; stats: any[] }>('GET', `/api/admin/devices/${deviceId}`),
  updateDeviceConfig: (deviceId: string, config: Record<string, unknown>) =>
    request<{ ok: boolean }>('PUT', `/api/admin/devices/${deviceId}/config`, config),
  getReleases: () =>
    request<{ releases: any[] }>('GET', '/api/admin/releases'),
  createRelease: (data: { version: string; sha256: string; size: number; r2Url: string; releaseNotes?: string }) =>
    request<{ release: any }>('POST', '/api/admin/releases', data),
  updateRelease: (version: string, data: { rolloutPercent?: number; isStable?: boolean }) =>
    request<{ release: any }>('PUT', `/api/admin/releases/${version}`, data),
  getGroups: () =>
    request<{ groups: any[] }>('GET', '/api/admin/groups'),
  createGroup: (name: string, deviceIds?: string[]) =>
    request<{ group: any }>('POST', '/api/admin/groups', { name, deviceIds }),
  triggerSync: (groupId: string, prayer: number) =>
    request<{ trigger: any }>('POST', `/api/admin/groups/${groupId}/sync`, { prayer }),
  getStats: (days = 7) =>
    request<{ totalDevices: number; onlineDevices: number; dailyStats: any[]; firmwareVersions: any[] }>('GET', `/api/admin/stats?days=${days}`),
  getMapDevices: () =>
    request<{ devices: any[] }>('GET', '/api/admin/analytics/map'),
  sendDeviceCommand: (deviceId: string, command: string, payload?: Record<string, unknown>) =>
    request<{ command: any }>('POST', `/api/admin/analytics/devices/${deviceId}/command`, { command, payload }),
  getDeviceCommands: (deviceId: string) =>
    request<{ commands: any[] }>('GET', `/api/admin/analytics/devices/${deviceId}/commands`),
  uploadRelease: (file: File, version: string, hardwareType: string, releaseNotes?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('version', version);
    form.append('hardwareType', hardwareType);
    if (releaseNotes) form.append('releaseNotes', releaseNotes);
    // Use fetch directly since request() sets Content-Type to JSON
    return fetch(`${BASE}/api/admin/releases/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(r => r.json());
  },
  forceUpdateDevice: (deviceId: string, version: string) =>
    request<{ command: any }>('POST', `/api/admin/analytics/devices/${deviceId}/command`, {
      command: 'ota_update',
      payload: { version, force: true },
    }),
};
