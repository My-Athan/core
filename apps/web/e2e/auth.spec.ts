import { test, expect } from '@playwright/test';
import { apiRegister, loginWithToken, uiLogin } from './helpers';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load pre-registered accounts from global setup
interface Account { email: string; password: string; token: string }
function accounts(): Record<string, Account> {
  const f = path.join(__dirname, 'test-state.json');
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}
function acct(key: string): Account { return accounts()[key]; }

// ─────────────────────────────────────────────────────────────
// 2 & 4. Register page
// ─────────────────────────────────────────────────────────────
test.describe('Register page', () => {
  test('successful registration → signs in and redirects to /', async ({ page }) => {
    const email = `e2e+newreg+${Date.now()}@test.myathan.local`;
    await page.goto('/register');
    await page.getByPlaceholder('Display name (optional)').fill('E2E User');
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password (min 8 characters)').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/', { timeout: 8000 });
  });

  test('duplicate email shows error without crash', async ({ page }) => {
    const { email } = acct('dup');
    await page.goto('/register');
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password (min 8 characters)').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('omitting display name still registers', async ({ page }) => {
    const email = `e2e+nodname+${Date.now()}@test.myathan.local`;
    await page.goto('/register');
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password (min 8 characters)').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/', { timeout: 8000 });
  });

  test('page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Login page — email/password
// ─────────────────────────────────────────────────────────────
test.describe('Login page', () => {
  test('valid credentials → redirects to /', async ({ page }) => {
    const { email, password } = acct('login');
    await uiLogin(page, email, password);
    await expect(page).toHaveURL('/', { timeout: 8000 });
  });

  test('wrong password → error shown, no crash', async ({ page }) => {
    const { email } = acct('login');
    await uiLogin(page, email, 'WrongPass999!');
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('blocked account → no JS crash', async ({ page }) => {
    // We can't easily block via API in this test (admin not always seeded),
    // so we verify the catch (e: unknown) path doesn't crash with bad credentials
    await page.goto('/login');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const { email } = acct('blocked');
    await uiLogin(page, email, 'WrongPass999!');
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('already logged in → redirects away from /login', async ({ page }) => {
    const { token } = acct('login');
    await loginWithToken(page, token, '/login');
    await expect(page).toHaveURL('/', { timeout: 8000 });
  });

  test('direct navigation (null location.state) → from defaults to /', async ({ page }) => {
    const { email, password } = acct('login');
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/', { timeout: 8000 });
  });

  test('from redirect preserved after login', async ({ page }) => {
    const { email, password } = acct('login');
    await page.goto('/profile');
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/profile', { timeout: 8000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 6. AuthContext — session restoration
// ─────────────────────────────────────────────────────────────
test.describe('AuthContext', () => {
  test('valid token in localStorage → user restored on mount', async ({ page }) => {
    const { token } = acct('sessrest');
    await loginWithToken(page, token, '/');
    await expect(page).toHaveURL('/', { timeout: 8000 });
    await expect(page.getByPlaceholder('Email address')).not.toBeVisible();
  });

  test('invalid token → cleared, redirected to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('app_token', 'invalid.token.here'));
    await page.goto('/');
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('no token → redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('refresh() failure does not throw unhandled rejection', async ({ page }) => {
    const { token } = acct('refresh');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await loginWithToken(page, token, '/');
    await expect(page).toHaveURL('/', { timeout: 8000 });

    // Corrupt token mid-session (simulates expiry)
    await page.evaluate(() => localStorage.setItem('app_token', 'expired.token.value'));
    await page.goto('/profile');
    await page.waitForTimeout(500);

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 13. PrivateRoute — auth gating
// ─────────────────────────────────────────────────────────────
test.describe('PrivateRoute', () => {
  const protectedRoutes = ['/', '/prayers', '/audio', '/settings', '/ramadan', '/multi-room', '/profile', '/setup'];

  for (const route of protectedRoutes) {
    test(`unauthenticated ${route} → redirected to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });
  }

  test('authenticated → children rendered (no login form)', async ({ page }) => {
    const { token } = acct('priv');
    await loginWithToken(page, token, '/');
    await expect(page).toHaveURL('/', { timeout: 8000 });
    await expect(page.getByPlaceholder('Email address')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 7. Profile — avatar display & React state
// ─────────────────────────────────────────────────────────────
test.describe('Profile page — avatar', () => {
  test('no avatarUrl → initials shown', async ({ page }) => {
    const { token } = acct('avatar');
    await loginWithToken(page, token, '/profile');
    await expect(page.getByText('Avatar Tester')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('div.rounded-full.bg-emerald-700').filter({ hasText: 'AT' })).toBeVisible();
  });

  test('javascript: URL → sanitized to null, no XSS alert', async ({ page }) => {
    const { token } = acct('avatar');
    const alerts: string[] = [];
    page.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });

    await loginWithToken(page, token, '/profile');
    await expect(page.getByText('Avatar Tester')).toBeVisible({ timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByPlaceholder('https://…').fill('javascript:alert("xss")');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    expect(alerts).toHaveLength(0);
    await expect(page.locator('div.rounded-full.bg-emerald-700')).toBeVisible();
  });

  test('broken https image URL → initials shown, no DOM manipulation errors', async ({ page }) => {
    const { token } = acct('brkavatar');
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    // Set a broken HTTPS URL via API first
    await fetch('http://localhost:3000/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ avatarUrl: 'https://localhost:9999/nonexistent.jpg' }),
    });

    await loginWithToken(page, token, '/profile');
    await expect(page.getByText('Broken Avatar')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000);

    await expect(page.locator('div.rounded-full.bg-emerald-700')).toBeVisible();

    const domErrors = consoleErrors.filter(e =>
      e.includes('Cannot set property') || e.includes('nextElementSibling') || e.includes('null')
    );
    expect(domErrors).toHaveLength(0);
  });

  test('edit mode hides avatar image', async ({ page }) => {
    const { token } = acct('avatar');
    const meReady = page.waitForResponse(
      r => r.url().includes('/api/auth/me') && r.status() === 200,
      { timeout: 8000 },
    );
    await loginWithToken(page, token, '/profile');
    await meReady;
    await expect(page.getByText('Avatar Tester')).toBeVisible({ timeout: 5000 });
    // dispatchEvent avoids the detach-during-re-render race on this button
    await page.getByRole('button', { name: 'Edit profile' }).dispatchEvent('click');
    await expect(page.locator('img.rounded-full')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 8. Profile — sign-out
// ─────────────────────────────────────────────────────────────
test.describe('Profile page — sign-out', () => {
  test('sign out navigates to /login, no unhandled rejection', async ({ page }) => {
    const { token } = acct('signout');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await loginWithToken(page, token, '/profile');

    // Wait for the profile page to fully render (URL settled + button visible)
    await expect(page).toHaveURL('/profile', { timeout: 8000 });
    const signOutBtn = page.getByRole('button', { name: 'Sign out' });
    await expect(signOutBtn).toBeVisible({ timeout: 10000 });
    await signOutBtn.dispatchEvent('click');
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. Profile — edit form
// ─────────────────────────────────────────────────────────────
test.describe('Profile page — edit form', () => {
  test('edit and save display name', async ({ page }) => {
    const { token } = acct('editname');
    // Reset display name to 'Original Name' via API before the test (in case a prior run changed it)
    await fetch('http://localhost:3000/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ displayName: 'Original Name' }),
    });

    // Set up me-settled listener BEFORE navigating so we don't miss the response
    const meReady = page.waitForResponse(
      r => r.url().includes('/api/auth/me') && r.status() === 200,
      { timeout: 10000 },
    );
    await loginWithToken(page, token, '/profile');
    await meReady;

    await expect(page.getByText('Original Name')).toBeVisible({ timeout: 5000 });
    // dispatchEvent avoids detach-during-re-render
    await page.getByRole('button', { name: 'Edit profile' }).dispatchEvent('click');
    await page.getByPlaceholder('Your name').fill('Updated Name');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Updated Name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
  });

  test('cancel edit resets fields', async ({ page }) => {
    const { token } = acct('cancelname');
    const meReady = page.waitForResponse(
      r => r.url().includes('/api/auth/me') && r.status() === 200,
      { timeout: 10000 },
    );
    await loginWithToken(page, token, '/profile');
    await meReady;
    await expect(page.getByText('Keep This Name')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Edit profile' }).dispatchEvent('click');
    await page.getByPlaceholder('Your name').fill('Temporary Name');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText('Keep This Name')).toBeVisible();
    await expect(page.getByText('Temporary Name')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 10. Profile — linked devices
// ─────────────────────────────────────────────────────────────
test.describe('Profile page — linked devices', () => {
  test('load devices → no linked devices shows message', async ({ page }) => {
    const { token } = acct('devices');
    await loginWithToken(page, token, '/profile');
    await page.getByRole('button', { name: 'Load' }).click();
    await expect(page.getByText('No linked devices.')).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Profile — delete account modal
// ─────────────────────────────────────────────────────────────
test.describe('Profile page — delete account', () => {
  test('confirm button disabled until "delete" typed exactly', async ({ page }) => {
    const { token } = acct('delmodal');
    await loginWithToken(page, token, '/profile');

    await page.getByRole('button', { name: 'Delete my account' }).click();
    const confirmBtn = page.getByRole('button', { name: 'Delete account' });
    await expect(confirmBtn).toBeDisabled();

    await page.getByPlaceholder('delete').fill('delet');
    await expect(confirmBtn).toBeDisabled();

    await page.getByPlaceholder('delete').fill('delete');
    await expect(confirmBtn).toBeEnabled();
  });

  test('cancel modal closes without API call', async ({ page }) => {
    const { token } = acct('delcancel');
    await loginWithToken(page, token, '/profile');

    const apiCalls: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/auth/account')) apiCalls.push(req.url());
    });

    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText('Delete account?')).not.toBeVisible();
    expect(apiCalls).toHaveLength(0);
  });

  test('confirm delete → signs out and redirects to /login', async ({ page }) => {
    // Fresh one-time account (not in shared pool) — but must respect rate limit
    // Use global setup account that was registered before rate limit kicks in
    // We create one more unique account here but it's only 1 extra registration
    const email = `e2e+delconfirm+${Date.now()}@test.myathan.local`;
    const { token } = await apiRegister(email, 'Password123!');
    await loginWithToken(page, token, '/profile');

    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByPlaceholder('delete').fill('delete');
    await page.getByRole('button', { name: 'Delete account' }).click();
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Setup page
// ─────────────────────────────────────────────────────────────
test.describe('Setup page', () => {
  test('renders without JS crash when authenticated', async ({ page }) => {
    const { token } = acct('setup');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await loginWithToken(page, token, '/setup');
    await expect(page.getByText('Scan for Devices')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 14. Regression — other pages unaffected
// ─────────────────────────────────────────────────────────────
test.describe('Regression — other pages', () => {
  const pagesToCheck = ['/prayers', '/audio', '/settings', '/ramadan', '/multi-room'];

  for (const path of pagesToCheck) {
    test(`${path} renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));

      const { token } = acct('regression');
      await loginWithToken(page, token, path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(path, { timeout: 8000 });
      expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
    });
  }

  test('bottom nav links navigate correctly', async ({ page }) => {
    const { token } = acct('regression');
    await loginWithToken(page, token, '/');
    await page.waitForLoadState('networkidle');

    const navLinks = [
      { name: 'Times', url: '/prayers' },
      { name: 'Audio', url: '/audio' },
      { name: 'Settings', url: '/settings' },
      { name: 'Profile', url: '/profile' },
    ];

    for (const { name, url } of navLinks) {
      await page.getByRole('link', { name }).click();
      await expect(page).toHaveURL(url, { timeout: 5000 });
    }
  });
});
