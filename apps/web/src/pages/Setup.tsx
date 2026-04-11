import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { bleProvisioner } from '../lib/ble-provisioning';
import { authApi } from '../lib/auth-api';

type SetupStep = 'scan' | 'connect' | 'wifi' | 'sending' | 'done' | 'error';

export function Setup() {
  const [step, setStep] = useState<SetupStep>('scan');
  const [deviceName, setDeviceName] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);

  async function handleScan() {
    try {
      setError('');
      const device = await bleProvisioner.scan();
      setDeviceName(device.name || 'MyAthan Device');
      setStep('connect');

      await bleProvisioner.connect();
      setStep('wifi');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bluetooth scan failed');
      setStep('error');
    }
  }

  async function handleSendCredentials() {
    if (!ssid) { setError('Enter WiFi network name'); return; }
    try {
      setStep('sending');
      await bleProvisioner.sendCredentials(ssid, password);

      // Link device to the logged-in user's account.
      // Best-effort: device may not be in DB yet if it hasn't phoned home,
      // but we try immediately and silently skip if not found.
      const deviceId = bleProvisioner.getDeviceId();
      if (deviceId) {
        try {
          await authApi.linkDevice(deviceId);
          setLinked(true);
        } catch (_e: unknown) {
          // Non-fatal — user can link manually from Profile > Linked devices
        }
      }

      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send credentials');
      setStep('error');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Device Setup</h2>

      {step === 'scan' && (
        <div className="text-center space-y-4">
          <p className="text-gray-600">Connect to your MyAthan device via Bluetooth to set up WiFi.</p>
          <button
            onClick={handleScan}
            className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium w-full"
          >
            Scan for Devices
          </button>
          <p className="text-xs text-gray-400">
            Make sure Bluetooth is enabled and your device is powered on.
          </p>
        </div>
      )}

      {step === 'connect' && (
        <div className="text-center py-8">
          <div className="animate-pulse text-emerald-700 text-lg">Connecting to {deviceName}...</div>
        </div>
      )}

      {step === 'wifi' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-emerald-700 font-medium">Connected to {deviceName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WiFi Network</label>
            <input
              type="text" value={ssid} onChange={e => setSsid(e.target.value)}
              placeholder="Enter WiFi SSID"
              autoComplete="off"
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter WiFi password"
              autoComplete="off"
              className="w-full border rounded-xl p-3"
            />
          </div>

          <button
            onClick={handleSendCredentials}
            className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium w-full"
          >
            Connect Device to WiFi
          </button>
        </div>
      )}

      {step === 'sending' && (
        <div className="text-center py-8">
          <div className="animate-pulse text-emerald-700 text-lg">Sending WiFi credentials...</div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-4xl">✅</div>
          <p className="text-lg font-medium text-gray-900">Device Connected!</p>
          <p className="text-gray-500">Your MyAthan device is now connected to WiFi and will sync prayer times automatically.</p>
          {linked && (
            <p className="text-sm text-emerald-700 font-medium">Device linked to your account.</p>
          )}
          {!linked && (
            <p className="text-xs text-gray-400">
              Device not yet linked — visit Profile to link it once it comes online.
            </p>
          )}
          <Link to="/" className="inline-block bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium">
            Go to Home
          </Link>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center space-y-4">
          <div className="text-4xl">❌</div>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => { setStep('scan'); setError(''); }}
            className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-medium"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
