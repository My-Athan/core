import { apiRegister } from './helpers';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'test-state.json');

export default async function globalSetup() {
  // Pre-register all shared test accounts once before any test runs.
  // This avoids rate-limiting (10/min) during the parallel test suite.
  const accounts: Record<string, { email: string; password: string; token: string }> = {};

  const keys: Array<[string, string | undefined]> = [
    ['dup', undefined],
    ['login', undefined],
    ['blocked', undefined],
    ['sessrest', undefined],
    ['refresh', undefined],
    ['priv', undefined],
    ['avatar', 'Avatar Tester'],
    ['brkavatar', 'Broken Avatar'],
    ['signout', undefined],
    ['editname', 'Original Name'],
    ['cancelname', 'Keep This Name'],
    ['devices', undefined],
    ['delmodal', undefined],
    ['delcancel', undefined],
    ['setup', undefined],
    ['regression', undefined],
  ];

  for (const [key, displayName] of keys) {
    const email = `e2e+${key}+${Date.now()}@test.myathan.local`;
    const password = 'Password123!';
    try {
      const { token } = await apiRegister(email, password, displayName);
      accounts[key] = { email, password, token };
    } catch (e) {
      console.error(`Failed to register account for key "${key}":`, e);
      throw e;
    }
    // Small pause to avoid rate-limiting (10/min = 1 per 6s)
    await new Promise(r => setTimeout(r, 700));
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(accounts, null, 2));
  console.log(`\n✓ Pre-registered ${Object.keys(accounts).length} test accounts`);
}
