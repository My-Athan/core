import { describe, it, expect } from 'vitest';
import { gregorianToHijri, isRamadan, getHoliday } from '../hijri.js';
import { IslamicHoliday } from '@myathan/shared';

describe('Hijri Calendar', () => {
  describe('gregorianToHijri', () => {
    it('converts Ramadan 2024 start correctly', () => {
      const h = gregorianToHijri(2024, 3, 11);
      expect(h.year).toBe(1445);
      expect(h.month).toBe(9); // Ramadan
      expect(h.day).toBeGreaterThanOrEqual(1);
      expect(h.day).toBeLessThanOrEqual(3); // ±1 day tolerance
    });

    it('converts Eid al-Fitr 2024 correctly', () => {
      const h = gregorianToHijri(2024, 4, 10);
      expect(h.year).toBe(1445);
      expect(h.month).toBe(10); // Shawwal
      expect(h.day).toBeGreaterThanOrEqual(1);
      expect(h.day).toBeLessThanOrEqual(3);
    });

    it('applies adjustment correctly', () => {
      const h0 = gregorianToHijri(2024, 3, 11, 0);
      const h1 = gregorianToHijri(2024, 3, 11, 1);
      const hm1 = gregorianToHijri(2024, 3, 11, -1);
      expect(h1.day).toBe(h0.day + 1);
      expect(hm1.day).toBe(h0.day - 1);
    });

    it('returns valid month names', () => {
      const h = gregorianToHijri(2024, 3, 15);
      expect(h.monthName).toBe('Ramadan');
    });
  });

  describe('isRamadan', () => {
    it('returns true during Ramadan', () => {
      const h = gregorianToHijri(2024, 3, 20);
      expect(isRamadan(h)).toBe(true);
    });

    it('returns false outside Ramadan', () => {
      const h = gregorianToHijri(2024, 5, 1);
      expect(isRamadan(h)).toBe(false);
    });
  });

  describe('getHoliday', () => {
    it('detects Eid al-Fitr', () => {
      expect(getHoliday({ day: 1, month: 10, year: 1445, monthName: 'Shawwal' }))
        .toBe(IslamicHoliday.EID_FITR);
    });

    it('detects Eid al-Adha', () => {
      expect(getHoliday({ day: 10, month: 12, year: 1445, monthName: 'Dhul Hijjah' }))
        .toBe(IslamicHoliday.EID_ADHA);
    });

    it('detects Mawlid', () => {
      expect(getHoliday({ day: 12, month: 3, year: 1445, monthName: 'Rabi al-Awwal' }))
        .toBe(IslamicHoliday.MAWLID);
    });

    it('detects Laylat al-Qadr', () => {
      expect(getHoliday({ day: 27, month: 9, year: 1445, monthName: 'Ramadan' }))
        .toBe(IslamicHoliday.LAYLAT_AL_QADR);
    });

    it('returns NONE for regular day', () => {
      expect(getHoliday({ day: 15, month: 5, year: 1445, monthName: '' }))
        .toBe(IslamicHoliday.NONE);
    });
  });
});
