import React from 'react';

export function Setup() {
  // TODO: BLE WiFi provisioning via Web Bluetooth API
  // 1. Scan for MyAthan-XXXX devices
  // 2. Connect via BLE GATT
  // 3. Write SSID + password characteristics
  // 4. Monitor connection status
  return (
    <div>
      <h1>Device Setup</h1>
      <p>Connect to your MyAthan device via Bluetooth</p>
      <button>Scan for Devices</button>
    </div>
  );
}
