// ─────────────────────────────────────────────────────────────
// Multi-Room Group Sync Types
// ─────────────────────────────────────────────────────────────

export interface DeviceGroup {
  id: string;
  name: string;
  syncEnabled: boolean;
  devices: string[];     // Device IDs in group
  createdAt: Date;
}

export interface SyncTrigger {
  groupId: string;
  prayer: number;        // Prayer index (0-4)
  triggerAtEpoch: number; // Unix timestamp for synchronized playback
  createdAt: Date;
}

export interface SyncTriggerRequest {
  prayer: number;
  triggerAtEpoch: number;
}
