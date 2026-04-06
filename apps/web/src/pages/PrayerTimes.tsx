import React, { useState, useEffect } from 'react';
import { PrayerCard } from '../components/PrayerCard';
import { HijriDateDisplay } from '../components/HijriDateDisplay';
import { deviceApi } from '../lib/device-api';
import type { PrayerTimesResponse } from '@myathan/shared';

const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export function PrayerTimes() {
  const [timetable, setTimetable] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tt, st] = await Promise.all([
          fetch('http://myathan.local/timetable').then(r => r.json()),
          fetch('http://myathan.local/status').then(r => r.json()),
        ]);
        setTimetable(tt);
        setStatus(st);
      } catch {
        // Device unreachable
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading prayer times...</div>;
  }

  if (!timetable?.today) {
    return <div className="text-center py-12 text-gray-500">Could not load prayer times</div>;
  }

  const nextIdx = status?.prayer?.nextIndex ?? -1;
  const nextMinutes = status?.prayer?.nextInMinutes;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">Prayer Times</h2>

      {status?.hijri && (
        <HijriDateDisplay
          day={status.hijri.day}
          month={status.hijri.month}
          year={status.hijri.year}
          monthName={status.hijri.monthName}
          ramadan={status.hijri.ramadan}
          holiday={status.hijri.holiday}
        />
      )}

      <div className="space-y-2">
        {PRAYER_KEYS.map((key, idx) => (
          <PrayerCard
            key={key}
            name={PRAYER_NAMES[idx]}
            time={timetable.today[key] || '--:--'}
            isNext={idx === nextIdx || (key === 'sunrise' ? false : idx - (idx > 0 ? 1 : 0) === nextIdx)}
            minutesUntil={idx === nextIdx ? nextMinutes : undefined}
          />
        ))}
      </div>

      {/* Calculation Info */}
      <div className="bg-white rounded-xl p-3 text-xs text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>Method</span><span>{timetable.method}</span>
        </div>
        <div className="flex justify-between">
          <span>ASR</span><span>{timetable.asrJuristic}</span>
        </div>
        <div className="flex justify-between">
          <span>Location</span><span>{timetable.location?.lat?.toFixed(2)}°, {timetable.location?.lon?.toFixed(2)}°</span>
        </div>
      </div>
    </div>
  );
}
