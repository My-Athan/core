import { describe, it, expect } from 'vitest';
import { calculatePrayerTimes } from '../prayer-times.js';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

describe('Prayer Times Service', () => {
  describe('calculatePrayerTimes', () => {
    it('returns valid times for Mecca', () => {
      const t = calculatePrayerTimes(new Date(2024, 2, 21), 21.4225, 39.8262, 'MAKKAH');
      expect(t.fajr).toMatch(/^\d{2}:\d{2}$/);
      expect(t.dhuhr).toMatch(/^\d{2}:\d{2}$/);
      expect(timeToMinutes(t.fajr)).toBeLessThan(timeToMinutes(t.sunrise));
      expect(timeToMinutes(t.sunrise)).toBeLessThan(timeToMinutes(t.dhuhr));
      expect(timeToMinutes(t.dhuhr)).toBeLessThan(timeToMinutes(t.asr));
      expect(timeToMinutes(t.asr)).toBeLessThan(timeToMinutes(t.maghrib));
      expect(timeToMinutes(t.maghrib)).toBeLessThan(timeToMinutes(t.isha));
    });

    it('returns valid times for New York ISNA', () => {
      const t = calculatePrayerTimes(new Date(2024, 2, 21), 40.7128, -74.006, 'ISNA');
      const dhuhr = timeToMinutes(t.dhuhr);
      // adhan-js returns times in local timezone of the server
      // Just verify dhuhr is a valid time and times are in order
      expect(dhuhr).toBeGreaterThan(0);
      expect(dhuhr).toBeLessThan(24 * 60);
      expect(timeToMinutes(t.fajr)).toBeLessThan(timeToMinutes(t.sunrise));
      expect(timeToMinutes(t.sunrise)).toBeLessThan(dhuhr);
    });

    it('Hanafi ASR is later than Standard', () => {
      const standard = calculatePrayerTimes(new Date(2024, 2, 21), 40.7128, -74.006, 'ISNA', 'standard');
      const hanafi = calculatePrayerTimes(new Date(2024, 2, 21), 40.7128, -74.006, 'ISNA', 'hanafi');
      expect(timeToMinutes(hanafi.asr)).toBeGreaterThan(timeToMinutes(standard.asr));
    });

    it('all 7 methods return valid results', () => {
      const methods = ['ISNA', 'MWL', 'EGYPT', 'MAKKAH', 'KARACHI', 'TEHRAN', 'JAFARI'] as const;
      for (const method of methods) {
        const t = calculatePrayerTimes(new Date(2024, 2, 21), 40.7128, -74.006, method);
        expect(timeToMinutes(t.fajr)).toBeGreaterThan(0);
        expect(timeToMinutes(t.isha)).toBeLessThan(24 * 60);
      }
    });

    it('handles equator correctly', () => {
      const t = calculatePrayerTimes(new Date(2024, 2, 21), 0, 0, 'MWL');
      expect(t.fajr).toMatch(/^\d{2}:\d{2}$/);
      expect(timeToMinutes(t.dhuhr)).toBeGreaterThan(11 * 60);
    });
  });
});
