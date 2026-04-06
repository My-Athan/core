import React, { useState } from 'react';
import { useDeviceConfig } from '../hooks/useDevice';
import { deviceApi } from '../lib/device-api';

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export function AudioSettings() {
  const { config, updateConfig } = useDeviceConfig();
  const [previewingTrack, setPreviewingTrack] = useState<number | null>(null);

  if (!config) {
    return <div className="text-center py-12 text-gray-500">Loading config...</div>;
  }

  const globalVolume = config.audio?.volume ?? 20;

  async function handlePreview(track: number) {
    setPreviewingTrack(track);
    await deviceApi.previewTrack(track);
    setTimeout(() => setPreviewingTrack(null), 10000);
  }

  async function handleVolumeChange(value: number) {
    await deviceApi.setVolume(value);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Audio Settings</h2>

      {/* Global Volume */}
      <div className="bg-white rounded-xl p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Global Volume: {globalVolume}
        </label>
        <input
          type="range" min="0" max="30" value={globalVolume}
          onChange={e => handleVolumeChange(parseInt(e.target.value))}
          className="w-full accent-emerald-700"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Mute</span><span>Max</span>
        </div>
      </div>

      {/* Per-Prayer Settings */}
      {PRAYER_KEYS.map((key, idx) => {
        const prayer = config.audio?.prayers?.[key];
        const track = prayer?.track ?? 1;
        const prayerVol = prayer?.volume ?? 0;
        const iqamaDelay = prayer?.iqamaDelay ?? 0;

        return (
          <div key={key} className="bg-white rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{PRAYER_NAMES[idx]}</h3>
              <button
                onClick={() => handlePreview(track)}
                disabled={previewingTrack === track}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  previewingTrack === track
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {previewingTrack === track ? 'Playing...' : 'Preview'}
              </button>
            </div>

            {/* Track Selection */}
            <div>
              <label className="text-xs text-gray-500">Athan Track</label>
              <select
                value={track}
                onChange={e => updateConfig({
                  audio: { ...config.audio, prayers: { ...config.audio?.prayers, [key]: { ...prayer, track: parseInt(e.target.value) } } }
                } as any)}
                className="w-full mt-1 border rounded-lg p-2 text-sm"
              >
                {[1,2,3,4,5,6,7,8,9,10].map(t => (
                  <option key={t} value={t}>Track {t}</option>
                ))}
              </select>
            </div>

            {/* Per-Prayer Volume */}
            <div>
              <label className="text-xs text-gray-500">
                Volume Override: {prayerVol === 0 ? `Global (${globalVolume})` : prayerVol}
              </label>
              <input
                type="range" min="0" max="30" value={prayerVol}
                onChange={e => updateConfig({
                  audio: { ...config.audio, prayers: { ...config.audio?.prayers, [key]: { ...prayer, volume: parseInt(e.target.value) } } }
                } as any)}
                className="w-full accent-emerald-700"
              />
            </div>

            {/* Iqama Delay */}
            <div>
              <label className="text-xs text-gray-500">
                Iqama Timer: {iqamaDelay === 0 ? 'Disabled' : `${iqamaDelay} min`}
              </label>
              <input
                type="range" min="0" max="60" step="5" value={iqamaDelay}
                onChange={e => updateConfig({
                  audio: { ...config.audio, prayers: { ...config.audio?.prayers, [key]: { ...prayer, iqamaDelay: parseInt(e.target.value) } } }
                } as any)}
                className="w-full accent-emerald-700"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
