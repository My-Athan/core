// ─────────────────────────────────────────────────────────────
// Analytics Types — shared between API and admin frontend
// ─────────────────────────────────────────────────────────────

export interface MapDevice {
  deviceId: string;
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
  online: boolean;
  firmwareVersion: string | null;
  lastHeartbeat: string | null;
  wifiRssi: number | null;
  prayerPlaysToday: number;
  groupId: string | null;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  command: 'ota_update' | 'wifi_reset' | 'restart';
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'executed';
  createdAt: string;
  deliveredAt: string | null;
  executedAt: string | null;
}

export interface DailyStats {
  date: string;
  totalPlays: number;
  totalErrors: number;
  avgUptime: number;
  deviceCount: number;
}
