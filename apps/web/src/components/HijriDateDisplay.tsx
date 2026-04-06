import React from 'react';

interface HijriDateDisplayProps {
  day: number;
  month: number;
  year: number;
  monthName: string;
  ramadan?: boolean;
  holiday?: string;
}

export function HijriDateDisplay({ day, month, year, monthName, ramadan, holiday }: HijriDateDisplayProps) {
  return (
    <div className="text-center py-2">
      <p className="text-gray-600 text-sm">
        {day} {monthName} {year} AH
      </p>
      {ramadan && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
          Ramadan
        </span>
      )}
      {holiday && (
        <span className="inline-block mt-1 ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">
          {holiday}
        </span>
      )}
    </div>
  );
}
