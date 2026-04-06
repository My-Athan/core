import React from 'react';
import { useDeviceConfig } from '../hooks/useDevice';
import type { CalcMethod, AsrJuristic, HighLatitudeRule } from '@myathan/shared';

const CALC_METHODS: { value: CalcMethod; label: string }[] = [
  { value: 'ISNA', label: 'ISNA (North America)' },
  { value: 'MWL', label: 'Muslim World League' },
  { value: 'EGYPT', label: 'Egyptian Authority' },
  { value: 'MAKKAH', label: 'Umm al-Qura (Makkah)' },
  { value: 'KARACHI', label: 'Karachi' },
  { value: 'TEHRAN', label: 'Tehran' },
  { value: 'JAFARI', label: 'Jafari (Shia)' },
];

const HIGH_LAT_METHODS: { value: HighLatitudeRule; label: string }[] = [
  { value: 'angle_based', label: 'Angle-based (Recommended)' },
  { value: 'midnight', label: 'Middle of Night' },
  { value: 'one_seventh', label: 'One-Seventh of Night' },
  { value: 'none', label: 'None' },
];

const HOLIDAY_KEYS = [
  { key: 'eidFitr', name: 'Eid al-Fitr' },
  { key: 'eidAdha', name: 'Eid al-Adha' },
  { key: 'mawlid', name: 'Mawlid al-Nabi' },
  { key: 'israMiraj', name: "Isra' & Mi'raj" },
  { key: 'muharram', name: 'Islamic New Year' },
  { key: 'ashura', name: 'Ashura' },
  { key: 'laylatAlQadr', name: 'Laylat al-Qadr' },
];

export function DeviceSettings() {
  const { config, updateConfig } = useDeviceConfig();

  if (!config) {
    return <div className="text-center py-12 text-gray-500">Loading config...</div>;
  }

  const location = config.location ?? { lat: 0, lon: 0, city: '', country: '', timezone: 'UTC', method: 'ISNA', asrJuristic: 'standard', highLatitudeRule: 'angle_based' };
  const schedule = config.schedule ?? { fridayJumuah: true, jumuahTrack: 1 };
  const holidays = config.holidays ?? {};

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Device Settings</h2>

      {/* Location */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Location</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Latitude</label>
            <input type="number" step="0.0001" value={location.lat}
              onChange={e => updateConfig({ location: { ...location, lat: parseFloat(e.target.value) } } as any)}
              className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Longitude</label>
            <input type="number" step="0.0001" value={location.lon}
              onChange={e => updateConfig({ location: { ...location, lon: parseFloat(e.target.value) } } as any)}
              className="w-full border rounded-lg p-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">City</label>
          <input type="text" value={location.city}
            onChange={e => updateConfig({ location: { ...location, city: e.target.value } } as any)}
            className="w-full border rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Timezone</label>
          <input type="text" value={location.timezone} placeholder="e.g., EST5EDT"
            onChange={e => updateConfig({ location: { ...location, timezone: e.target.value } } as any)}
            className="w-full border rounded-lg p-2 text-sm" />
        </div>
      </div>

      {/* Calculation Method */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Prayer Calculation</h3>
        <div>
          <label className="text-xs text-gray-500">Method</label>
          <select value={location.method}
            onChange={e => updateConfig({ location: { ...location, method: e.target.value } } as any)}
            className="w-full border rounded-lg p-2 text-sm mt-1">
            {CALC_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">ASR Calculation</label>
          <div className="flex gap-2 mt-1">
            {(['standard', 'hanafi'] as AsrJuristic[]).map(j => (
              <button key={j} onClick={() => updateConfig({ location: { ...location, asrJuristic: j } } as any)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  location.asrJuristic === j ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                {j === 'standard' ? 'Standard' : 'Hanafi'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">High Latitude Rule</label>
          <select value={location.highLatitudeRule}
            onChange={e => updateConfig({ location: { ...location, highLatitudeRule: e.target.value } } as any)}
            className="w-full border rounded-lg p-2 text-sm mt-1">
            {HIGH_LAT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Friday / Jumuah */}
      <div className="bg-white rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Friday Jumuah</p>
          <p className="text-xs text-gray-500">Use special athan for Dhuhr on Fridays</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={schedule.fridayJumuah}
            onChange={e => updateConfig({ schedule: { ...schedule, fridayJumuah: e.target.checked } } as any)}
            className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      {/* Islamic Holidays */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Islamic Holidays</h3>
        <p className="text-xs text-gray-500">Enable special athan/doaa for holidays</p>
        {HOLIDAY_KEYS.map(h => (
          <div key={h.key} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">{h.name}</span>
            <input type="checkbox"
              checked={(holidays as any)[h.key]?.enabled ?? true}
              onChange={e => updateConfig({
                holidays: { ...holidays, [h.key]: { ...(holidays as any)[h.key], enabled: e.target.checked } }
              } as any)}
              className="accent-emerald-700" />
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-red-600">Danger Zone</h3>
        <button
          onClick={() => { if (confirm('Reset WiFi? Device will restart in setup mode.')) fetch('http://myathan.local/trigger?prayer=0', { method: 'POST' }); }}
          className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm">
          Reset WiFi
        </button>
      </div>
    </div>
  );
}
