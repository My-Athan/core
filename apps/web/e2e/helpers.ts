import { type Page } from '@playwright/test';

/** Unique email for each test run to avoid duplicate conflicts */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}+${Date.now()}@test.myathan.local`;
}

const BASE = 'http://localhost:3000';

/** Register a user directly via API and return token */
export async function apiRegister(email: string, password: string, displayName?: string) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);
  return res.json() as Promise<{ token: string; user: Record<string, unknown> }>;
}

/** Login a user directly via API and return token */
export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const err = Object.assign(new Error(String(body['error'] ?? 'Login failed')), { code: body['code'] });
    throw err;
  }
  return res.json() as Promise<{ token: string; user: Record<string, unknown> }>;
}

/**
 * Inject auth token into localStorage so the page sees the user as logged in.
 * Must be called AFTER the page has navigated to the app origin at least once.
 */
export async function injectToken(page: Page, token: string) {
  await page.evaluate((t) => localStorage.setItem('app_token', t), token);
}

/**
 * Inject token into localStorage BEFORE the page loads, so AuthContext.useEffect
 * reads it on first mount. Uses addInitScript which runs before any JS executes.
 */
export async function loginWithToken(page: Page, token: string, targetPath = '/') {
  // addInitScript runs before the page's own JS — localStorage is set before React mounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.addInitScript((t) => { (globalThis as any).localStorage.setItem('app_token', t); }, token);
  await page.goto(targetPath);
}

/** Sign in via the UI form */
export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Block a user via the admin API using the admin session cookie */
export async function apiBlockUser(userId: string, adminToken: string) {
  const res = await fetch(`${BASE}/api/admin/app-users/${userId}/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ reason: 'E2E test block' }),
  });
  if (!res.ok) throw new Error(`Block failed: ${await res.text()}`);
}

/** Get admin token by logging into the admin API */
export async function adminLogin(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@myathan.local',
      password: 'Admin1234!',
    }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${await res.text()}`);
  const data = await res.json() as { token?: string };
  return data.token ?? '';
}
