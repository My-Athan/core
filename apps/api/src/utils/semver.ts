import crypto from 'node:crypto';

const SEMVER_PARTS_COUNT = 3; // major.minor.patch

// Compare semver strings: returns 1 if a > b, -1 if a < b, 0 if equal
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < SEMVER_PARTS_COUNT; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// Hash device ID to 0-99 for staged rollout selection
export function hashDeviceId(deviceId: string): number {
  const hash = crypto.createHash('sha256').update(deviceId).digest();
  return hash.readUInt16BE(0) % 100;
}
