// ─────────────────────────────────────────────────────────────
// Prayer Times — shared between firmware and backend
// ─────────────────────────────────────────────────────────────

export interface PrayerTimes {
  fajr: string;      // "HH:MM" format
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface PrayerTimesResponse {
  today: PrayerTimes;
  tomorrow: Partial<PrayerTimes>;
  method: string;
  asrJuristic: string;
  location: {
    lat: number;
    lon: number;
  };
}

// ── Hijri Date ──────────────────────────────────────────────

export interface HijriDate {
  day: number;
  month: number;       // 1-12
  year: number;
  monthName: string;
}

export const HIJRI_MONTH_NAMES = [
  '', 'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', 'Dhul Qi\'dah', 'Dhul Hijjah'
] as const;

// ── Device Status ───────────────────────────────────────────

export interface DeviceStatus {
  deviceId: string;
  firmwareVersion: string;
  uptime: number;
  wifi: {
    connected: boolean;
    ip: string;
    rssi: number;
  };
  time: {
    synced: boolean;
    local?: string;
  };
  audio: {
    playing: boolean;
    volume: number;
  };
  prayer: {
    nextIndex: number;
    next: string;
    nextInMinutes: number;
  };
  hijri?: HijriDate & {
    ramadan: boolean;
    holiday?: string;
  };
}
