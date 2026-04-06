import React from 'react';
import { useDeviceConfig } from '../hooks/useDevice';

const SUHOOR_MODES = [
  { value: 'none', label: 'None (silent)' },
  { value: 'sound', label: 'Alert sound' },
  { value: 'led', label: 'LED only' },
  { value: 'custom', label: 'Custom track' },
];

export function RamadanSettings() {
  const { config, updateConfig } = useDeviceConfig();

  if (!config) {
    return <div className="text-center py-12 text-gray-500">Loading config...</div>;
  }

  const ramadan = config.ramadan ?? { enabled: true, suhoorAlertMinutes: 30, suhoorMode: 'sound', suhoorTrack: 0, suhoorLed: true, iftarAlertEnabled: true, iftarTrack: 0 };
  const hijri = config.hijri ?? { adjustment: 0 };

  function updateRamadan(partial: Record<string, unknown>) {
    updateConfig({ ramadan: { ...ramadan, ...partial } } as any);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Ramadan Settings</h2>

      {/* Auto-detect Toggle */}
      <div className="bg-white rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Ramadan Mode</p>
          <p className="text-xs text-gray-500">Auto-detected via Hijri calendar</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox" checked={ramadan.enabled}
            onChange={e => updateRamadan({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      {/* Suhoor Alert */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Suhoor Alert</h3>

        <div>
          <label className="text-xs text-gray-500">
            Alert before Fajr: {ramadan.suhoorAlertMinutes} minutes
          </label>
          <input
            type="range" min="10" max="60" step="5"
            value={ramadan.suhoorAlertMinutes}
            onChange={e => updateRamadan({ suhoorAlertMinutes: parseInt(e.target.value) })}
            className="w-full accent-emerald-700"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Alert Mode</label>
          <select
            value={ramadan.suhoorMode}
            onChange={e => updateRamadan({ suhoorMode: e.target.value })}
            className="w-full mt-1 border rounded-lg p-2 text-sm"
          >
            {SUHOOR_MODES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">LED indicator</span>
          <input
            type="checkbox" checked={ramadan.suhoorLed}
            onChange={e => updateRamadan({ suhoorLed: e.target.checked })}
            className="accent-emerald-700"
          />
        </div>
      </div>

      {/* Iftar Alert */}
      <div className="bg-white rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Iftar Alert</p>
          <p className="text-xs text-gray-500">Play alert at Maghrib time</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox" checked={ramadan.iftarAlertEnabled}
            onChange={e => updateRamadan({ iftarAlertEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      {/* Hijri Adjustment */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-medium text-gray-900 mb-2">Hijri Date Adjustment</h3>
        <p className="text-xs text-gray-500 mb-3">
          Adjust if the automatic Hijri date doesn't match your local observation.
        </p>
        <div className="flex items-center justify-center gap-4">
          {[-2, -1, 0, 1, 2].map(adj => (
            <button
              key={adj}
              onClick={() => updateConfig({ hijri: { adjustment: adj } } as any)}
              className={`w-10 h-10 rounded-full text-sm font-medium ${
                hijri.adjustment === adj
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {adj > 0 ? `+${adj}` : adj}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
