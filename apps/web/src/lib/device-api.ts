import type { DeviceStatus, DeviceConfig, PrayerTimesResponse } from '@myathan/shared';

// ─────────────────────────────────────────────────────────────
// Device API Client — communicates with MyAthan device
// Uses local HTTP (myathan.local) or cloud API fallback
// ─────────────────────────────────────────────────────────────

const LOCAL_BASE = 'http://myathan.local';
const TIMEOUT_MS = 10000;  // 10 second timeout

const MIN_PRAYER_INDEX = 0;
const MAX_PRAYER_INDEX = 4;
const MIN_TRACK_NUMBER = 1;
const MAX_TRACK_NUMBER = 999;
const MIN_VOLUME = 0;
const MAX_VOLUME = 30;

export interface DeviceTimetableEntry {
  date: string;
  prayer: string;
  time: string;
  [key: string]: string | number | boolean | null;
}

export interface DeviceTimetable {
  [key: string]: DeviceTimetableEntry | DeviceTimetableEntry[];
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export class DeviceAPI {
  private baseUrl: string;

  constructor(baseUrl = LOCAL_BASE) {
    this.baseUrl = baseUrl;
  }

  async getStatus(): Promise<DeviceStatus> {
    const res = await fetchWithTimeout(`${this.baseUrl}/status`);
    return res.json();
  }

  async getTimetable(): Promise<PrayerTimesResponse> {
    const res = await fetchWithTimeout(`${this.baseUrl}/timetable`);
    return res.json();
  }

  async triggerAthan(prayer: number): Promise<void> {
    const params = new URLSearchParams({
      prayer: String(Math.max(MIN_PRAYER_INDEX, Math.min(MAX_PRAYER_INDEX, prayer))),
    });
    await fetchWithTimeout(`${this.baseUrl}/trigger?${params}`, { method: 'POST' });
  }

  async previewTrack(track: number): Promise<void> {
    const params = new URLSearchParams({
      track: String(Math.max(MIN_TRACK_NUMBER, Math.min(MAX_TRACK_NUMBER, track))),
    });
    await fetchWithTimeout(`${this.baseUrl}/preview?${params}`, { method: 'POST' });
  }

  async setVolume(level: number): Promise<void> {
    const clampedLevel = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, level));
    const params = new URLSearchParams({ level: String(clampedLevel) });
    await fetchWithTimeout(`${this.baseUrl}/volume?${params}`, { method: 'POST' });
  }

  async getConfig(): Promise<DeviceConfig> {
    const res = await fetchWithTimeout(`${this.baseUrl}/config`);
    return res.json();
  }

  async updateConfig(partial: Partial<DeviceConfig>): Promise<void> {
    await fetchWithTimeout(`${this.baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  }
}

export const deviceApi = new DeviceAPI();
