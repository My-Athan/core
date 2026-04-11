import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🕌' },
  { path: '/prayers', label: 'Times', icon: '🕐' },
  { path: '/audio', label: 'Audio', icon: '🔊' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-emerald-700 text-white px-4 py-3">
        <h1 className="text-lg font-semibold">MyAthan</h1>
      </header>

      <main className="flex-1 p-4 pb-20 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center text-xs px-3 py-1 ${
              location.pathname === item.path ? 'text-emerald-700 font-semibold' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
