import type { HijriDate } from '@myathan/shared';
import { HIJRI_MONTH_NAMES, ISLAMIC_HOLIDAYS, IslamicHoliday } from '@myathan/shared';

// ─────────────────────────────────────────────────────────────
// Hijri Calendar Service — Tabular algorithm (matches firmware)
// ─────────────────────────────────────────────────────────────

const LEAP_YEARS = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];

export function isHijriLeapYear(year: number): boolean {
  const cycle = ((year - 1) % 30) + 1;
  return LEAP_YEARS.includes(cycle);
}

export function gregorianToHijri(gYear: number, gMonth: number, gDay: number, adjustment = 0): HijriDate {
  const jd = gregorianToJulianDay(gYear, gMonth, gDay) + adjustment;
  return julianDayToHijri(jd);
}

export function isRamadan(date: HijriDate): boolean {
  return date.month === 9;
}

export function getHoliday(date: HijriDate): IslamicHoliday {
  const match = ISLAMIC_HOLIDAYS.find(
    h => h.hijriMonth === date.month && h.hijriDay === date.day
  );
  return match?.key ?? IslamicHoliday.NONE;
}

function gregorianToJulianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524;
}

function julianDayToHijri(jd: number): HijriDate {
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;

  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor((l / 5670)) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor((j / 16)) * Math.floor((15238 * j) / 43) + 29;

  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return {
    day,
    month,
    year,
    monthName: HIJRI_MONTH_NAMES[month] || '',
  };
}
