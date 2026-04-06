// ─────────────────────────────────────────────────────────────
// Device Config — matches firmware config.json v2 schema exactly
// ─────────────────────────────────────────────────────────────

export interface DeviceConfig {
  configVersion: number;
  deviceId: string;
  firmwareVersion: string;
  wifi: WifiConfig;
  location: LocationConfig;
  audio: AudioConfig;
  schedule: ScheduleConfig;
  ramadan: RamadanConfig;
  hijri: HijriConfig;
  holidays: HolidaysConfig;
  led: LedConfig;
  multiRoom: MultiRoomDeviceConfig;
  recovery: RecoveryConfig;
  timetable: TimetableConfig;
  ota: OtaConfig;
  stats: StatsConfig;
}

export interface WifiConfig {
  ssid: string;
  password: string;
}

export interface LocationConfig {
  lat: number;
  lon: number;
  city: string;
  country: string;
  timezone: string;
  method: CalcMethod;
  asrJuristic: AsrJuristic;
  highLatitudeRule: HighLatitudeRule;
}

export type CalcMethod = 'ISNA' | 'MWL' | 'EGYPT' | 'MAKKAH' | 'KARACHI' | 'TEHRAN' | 'JAFARI';
export type AsrJuristic = 'standard' | 'hanafi';
export type HighLatitudeRule = 'angle_based' | 'midnight' | 'one_seventh' | 'none';

export interface AudioConfig {
  volume: number;         // 0-30
  defaultTrack: number;
  prayers: Record<PrayerName, PrayerAudioConfig>;
}

export interface PrayerAudioConfig {
  track: number;
  enabled: boolean;
  volume: number;         // 0 = use global
  iqamaDelay: number;     // 0-60 minutes, 0 = disabled
  iqamaTrack: number;
  ramadanTrack: number;
  doaa: DoaaConfig;
}

export interface DoaaConfig {
  enabled: boolean;
  track: number;
  delayMin: number;
}

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_NAMES: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export interface ScheduleConfig {
  fridayJumuah: boolean;
  jumuahTrack: number;
}

export interface RamadanConfig {
  enabled: boolean;
  suhoorAlertMinutes: number;
  suhoorMode: SuhoorMode;
  suhoorTrack: number;
  suhoorLed: boolean;
  iftarAlertEnabled: boolean;
  iftarTrack: number;
}

export type SuhoorMode = 'none' | 'sound' | 'led' | 'custom';

export interface HijriConfig {
  adjustment: number;     // -2 to +2
}

export interface HolidaysConfig {
  eidFitr: HolidayConfig & { postAthanTrack: number };
  eidAdha: HolidayConfig & { postAthanTrack: number };
  mawlid: HolidayConfig;
  israMiraj: HolidayConfig;
  muharram: HolidayConfig;
  ashura: HolidayConfig;
  laylatAlQadr: HolidayConfig;
}

export interface HolidayConfig {
  enabled: boolean;
  track: number;
}

export interface LedConfig {
  enabled: boolean;
  preAthanMinutes: number;
  preAthanPattern: string;
  playingPattern: string;
  iqamaPattern: string;
  errorPattern: string;
  noWifiPattern: string;
}

export interface MultiRoomDeviceConfig {
  groupId: string;        // Empty = standalone
  syncOffsetMs: number;
}

export interface RecoveryConfig {
  lastState: 'idle' | 'playing' | 'iqama';
  lastPrayerPlayed: number;
  lastPlayTimestamp: number;
  playedTodayMask: number;
}

export interface TimetableConfig {
  fetchedAt: string;
  offsets: Record<PrayerName, number>;
  days: Record<string, Record<PrayerName, string>>;
}

export interface OtaConfig {
  checkHour: number;
  lastChecked: string;
}

export interface StatsConfig {
  lastSent: string;
}

// ── Device Registry ─────────────────────────────────────────

export interface Device {
  id: string;
  deviceId: string;       // "myathan-XXXXXX"
  userId: string | null;
  groupId: string | null;
  firmwareVersion: string;
  lastHeartbeat: Date | null;
  config: Partial<DeviceConfig>;
  createdAt: Date;
  updatedAt: Date;
}
