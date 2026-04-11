import { Coordinates, CalculationMethod, PrayerTimes, CalculationParameters, Madhab } from 'adhan';
import type { PrayerTimes as PrayerTimesResult, CalcMethod, AsrJuristic } from '@myathan/shared';

// ─────────────────────────────────────────────────────────────
// Prayer Time Service — server-side calculation using adhan-js
// Used for: verification of on-device calculation, timetable API
// ─────────────────────────────────────────────────────────────

const METHOD_MAP: Record<CalcMethod, () => CalculationParameters> = {
  ISNA: () => CalculationMethod.NorthAmerica(),
  MWL: () => CalculationMethod.MuslimWorldLeague(),
  EGYPT: () => CalculationMethod.Egyptian(),
  MAKKAH: () => CalculationMethod.UmmAlQura(),
  KARACHI: () => CalculationMethod.Karachi(),
  TEHRAN: () => CalculationMethod.Tehran(),
  JAFARI: () => CalculationMethod.Tehran(),  // Closest available
};

export function calculatePrayerTimes(
  date: Date,
  lat: number,
  lon: number,
  method: CalcMethod = 'ISNA',
  asrJuristic: AsrJuristic = 'standard',
): PrayerTimesResult {
  const coordinates = new Coordinates(lat, lon);
  const params = (METHOD_MAP[method] || METHOD_MAP.ISNA)();

  if (asrJuristic === 'hanafi') {
    params.madhab = Madhab.Hanafi;
  }

  const prayerTimes = new PrayerTimes(coordinates, date, params);

  return {
    fajr: formatTime(prayerTimes.fajr),
    sunrise: formatTime(prayerTimes.sunrise),
    dhuhr: formatTime(prayerTimes.dhuhr),
    asr: formatTime(prayerTimes.asr),
    maghrib: formatTime(prayerTimes.maghrib),
    isha: formatTime(prayerTimes.isha),
  };
}

function formatTime(date: Date): string {
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
