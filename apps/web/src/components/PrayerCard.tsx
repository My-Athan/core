import React from 'react';

interface PrayerCardProps {
  name: string;
  time: string;
  isNext: boolean;
  minutesUntil?: number;
}

export function PrayerCard({ name, time, isNext, minutesUntil }: PrayerCardProps) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl ${
        isNext ? 'bg-emerald-700 text-white shadow-lg' : 'bg-white'
      }`}
    >
      <div>
        <p className={`text-lg font-semibold ${isNext ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </p>
        {isNext && minutesUntil !== undefined && (
          <p className="text-emerald-200 text-sm">
            in {minutesUntil >= 60
              ? `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
              : `${minutesUntil}m`}
          </p>
        )}
      </div>
      <p className={`text-2xl font-mono ${isNext ? 'text-white' : 'text-gray-700'}`}>
        {time}
      </p>
    </div>
  );
}
