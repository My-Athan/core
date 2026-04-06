import type { DeviceStatus, PrayerTimesResponse, DeviceConfig } from '@myathan/shared';

// ─────────────────────────────────────────────────────────────
// Device API Client — communicates with MyAthan device
// Uses local HTTP (myathan.local) or cloud API fallback
// ─────────────────────────────────────────────────────────────

const LOCAL_BASE = 'http://myathan.local';

export class DeviceAPI {
  private baseUrl: string;

  constructor(baseUrl = LOCAL_BASE) {
    this.baseUrl = baseUrl;
  }

  async getStatus(): Promise<DeviceStatus> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json();
  }

  async getTimetable(): Promise<PrayerTimesResponse> {
    const res = await fetch(`${this.baseUrl}/timetable`);
    return res.json();
  }

  async triggerAthan(prayer: number): Promise<void> {
    await fetch(`${this.baseUrl}/trigger?prayer=${prayer}`, { method: 'POST' });
  }

  async previewTrack(track: number): Promise<void> {
    await fetch(`${this.baseUrl}/preview?track=${track}`, { method: 'POST' });
  }

  async setVolume(level: number): Promise<void> {
    await fetch(`${this.baseUrl}/volume?level=${level}`, { method: 'POST' });
  }

  async getConfig(): Promise<DeviceConfig> {
    const res = await fetch(`${this.baseUrl}/config`);
    return res.json();
  }

  async updateConfig(partial: Partial<DeviceConfig>): Promise<void> {
    await fetch(`${this.baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  }
}

export const deviceApi = new DeviceAPI();
