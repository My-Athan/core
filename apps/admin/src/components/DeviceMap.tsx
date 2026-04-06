import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

// Leaflet loaded via CDN in Map.tsx to avoid bundling issues
declare const L: any;

interface MapDevice {
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

export function DeviceMap() {
  const [devices, setDevices] = useState<MapDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setActionLoading] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await api.getMapDevices();
      setDevices(data.devices);
    } catch {
      // API error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadDevices, 60000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  // Initialize Leaflet map
  useEffect(() => {
    if (loading || typeof L === 'undefined') return;

    const existing = document.getElementById('device-map');
    if (!existing) return;

    // Clean up previous map instance
    if ((existing as any)._leaflet_id) {
      (existing as any)._leafletMap?.remove();
    }

    const map = L.map('device-map').setView([25, 45], 3); // Center on Middle East
    (existing as any)._leafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Add markers
    const bounds: [number, number][] = [];

    devices.forEach(d => {
      if (!d.lat || !d.lon) return;
      bounds.push([d.lat, d.lon]);

      const color = d.online ? '#22c55e' : '#ef4444';
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      });

      const marker = L.marker([d.lat, d.lon], { icon });

      const popupHtml = `
        <div style="font-family:system-ui;min-width:240px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-weight:700;font-size:14px;font-family:monospace">${d.deviceId}</span>
            <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;
              background:${d.online ? '#dcfce7' : '#fee2e2'};color:${d.online ? '#166534' : '#991b1b'}">
              ${d.online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div style="font-size:12px;color:#555;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
            <span>Firmware</span><span style="font-weight:600">v${d.firmwareVersion || '?'}</span>
            <span>Location</span><span style="font-weight:600">${d.city || ''} ${d.country || ''}</span>
            <span>WiFi</span><span style="font-weight:600">${d.wifiRssi ? d.wifiRssi + ' dBm' : '—'}</span>
            <span>Prayers today</span><span style="font-weight:600">${d.prayerPlaysToday}</span>
            <span>Last seen</span><span style="font-weight:600">${d.lastHeartbeat ? new Date(d.lastHeartbeat).toLocaleString() : 'Never'}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid #eee;padding-top:10px">
            <button onclick="window.__deviceCmd('${d.deviceId}','ota_update')"
              style="flex:1;padding:6px;font-size:11px;font-weight:600;border:1px solid #ddd;border-radius:6px;background:#eff6ff;color:#2563eb;cursor:pointer">
              Update
            </button>
            <button onclick="window.__deviceCmd('${d.deviceId}','wifi_reset')"
              style="flex:1;padding:6px;font-size:11px;font-weight:600;border:1px solid #ddd;border-radius:6px;background:#fef3c7;color:#92400e;cursor:pointer">
              Reset WiFi
            </button>
            <button onclick="window.__deviceCmd('${d.deviceId}','restart')"
              style="flex:1;padding:6px;font-size:11px;font-weight:600;border:1px solid #ddd;border-radius:6px;background:#fee2e2;color:#991b1b;cursor:pointer">
              Restart
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });
      marker.addTo(map);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    return () => { map.remove(); };
  }, [devices, loading]);

  // Global command handler for popup buttons
  useEffect(() => {
    (window as any).__deviceCmd = async (deviceId: string, command: string) => {
      const confirmMsg = command === 'restart'
        ? `Restart device ${deviceId}?`
        : command === 'wifi_reset'
        ? `Reset WiFi on ${deviceId}? Device will need re-provisioning.`
        : `Send firmware update to ${deviceId}?`;

      if (!confirm(confirmMsg)) return;

      setActionLoading(deviceId);
      try {
        await api.sendDeviceCommand(deviceId, command);
        alert(`Command "${command}" queued for ${deviceId}. Device will execute on next heartbeat (~5 min).`);
      } catch {
        alert(`Failed to send command to ${deviceId}`);
      } finally {
        setActionLoading(null);
      }
    };

    return () => { delete (window as any).__deviceCmd; };
  }, []);

  const onlineCount = devices.filter(d => d.online).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 14, color: '#666' }}>
            {devices.length} devices &middot; <span style={{ color: '#22c55e', fontWeight: 600 }}>{onlineCount} online</span>
          </span>
        </div>
        <button onClick={loadDevices} style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 12 }}>
          Loading devices...
        </div>
      ) : devices.length === 0 ? (
        <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 12, color: '#999' }}>
          No devices with location data. Devices will appear after sending their first heartbeat with GPS coordinates.
        </div>
      ) : (
        <div id="device-map" style={{ height: 'calc(100vh - 180px)', minHeight: 400, borderRadius: 12, overflow: 'hidden' }} />
      )}
    </div>
  );
}
