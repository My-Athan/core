import React from 'react';
import { Link } from 'react-router-dom';
import { useDeviceStatus } from '../hooks/useDevice';
import { PrayerCard } from '../components/PrayerCard';
import { HijriDateDisplay } from '../components/HijriDateDisplay';

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export function Home() {
  const { status, loading, error } = useDeviceStatus();

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Connecting to device...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/setup" className="bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium">
          Set Up Device
        </Link>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-4">
      {/* Hijri Date */}
      {status.hijri && (
        <HijriDateDisplay
          day={status.hijri.day}
          month={status.hijri.month}
          year={status.hijri.year}
          monthName={status.hijri.monthName}
          ramadan={status.hijri.ramadan}
          holiday={status.hijri.holiday}
        />
      )}

      {/* Next Prayer Highlight */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Next Prayer</p>
        <p className="text-3xl font-bold text-emerald-700">
          {status.prayer?.next ? PRAYER_NAMES[status.prayer.nextIndex] : '—'}
        </p>
        {status.prayer?.nextInMinutes !== undefined && (
          <p className="text-gray-500">
            in {status.prayer.nextInMinutes >= 60
              ? `${Math.floor(status.prayer.nextInMinutes / 60)}h ${status.prayer.nextInMinutes % 60}m`
              : `${status.prayer.nextInMinutes} minutes`}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => fetch('http://myathan.local/trigger?prayer=' + (status.prayer?.nextIndex ?? 0), { method: 'POST' })}
          className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-medium"
        >
          Play Athan
        </button>
        <button
          onClick={() => fetch('http://myathan.local/preview?track=1', { method: 'POST' })}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium"
        >
          Preview
        </button>
      </div>

      {/* Device Info */}
      <div className="bg-white rounded-xl p-4 text-sm text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Device</span>
          <span className="font-mono">{status.deviceId}</span>
        </div>
        <div className="flex justify-between">
          <span>Firmware</span>
          <span>v{status.firmwareVersion}</span>
        </div>
        <div className="flex justify-between">
          <span>WiFi</span>
          <span>{status.wifi?.connected ? `${status.wifi.rssi} dBm` : 'Disconnected'}</span>
        </div>
        <div className="flex justify-between">
          <span>Volume</span>
          <span>{status.audio?.volume}/30</span>
        </div>
      </div>
    </div>
  );
}
