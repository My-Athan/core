import React from 'react';
import { DeviceMap } from '../components/DeviceMap';

export function Map() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Device Map</h1>

      {/* Load Leaflet from CDN */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

      <DeviceMap />
    </div>
  );
}
