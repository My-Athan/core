import { describe, it, expect } from 'vitest';
import { compareSemver } from '../../utils/semver.js';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.0.0', '0.0.0')).toBe(0);
  });

  it('returns 1 when a > b (major)', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
  });

  it('returns -1 when a < b (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compares minor versions correctly', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
  });

  it('compares patch versions correctly', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
  });

  it('handles numeric comparison (not lexicographic)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('1.2.0', '1.10.0')).toBe(-1);
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1);
  });

  it('handles missing patch versions', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1', '1.0.0')).toBe(0);
  });
});
