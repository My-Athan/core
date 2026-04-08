import React, { useEffect } from 'react';
import { DeviceMap } from '../components/DeviceMap';

export function Map() {
  useEffect(() => {
    const leafletCssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const leafletJsSrc = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

    // Inject Leaflet CSS if not already present
    const existingLink = Array.from(document.getElementsByTagName('link')).find(
      (link) => link.getAttribute('href') === leafletCssHref
    );
    if (!existingLink) {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = leafletCssHref;
      linkEl.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      linkEl.crossOrigin = '';
      document.head.appendChild(linkEl);
    }

    // Inject Leaflet JS if not already present
    const existingScript = Array.from(document.getElementsByTagName('script')).find(
      (script) => script.getAttribute('src') === leafletJsSrc
    );
    if (!existingScript) {
      const scriptEl = document.createElement('script');
      scriptEl.src = leafletJsSrc;
      scriptEl.async = true;
      scriptEl.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      scriptEl.crossOrigin = '';
      document.head.appendChild(scriptEl);
    }
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Device Map</h1>
      <DeviceMap />
    </div>
  );
}
