import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const NAV = [
  { path: '/', label: 'Dashboard' },
  { path: '/map', label: 'Map' },
  { path: '/devices', label: 'Devices' },
  { path: '/releases', label: 'Releases' },
  { path: '/groups', label: 'Groups' },
  { path: '/analytics', label: 'Analytics' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1a1a2e', color: '#fff', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #333', marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>MyAthan Admin</h1>
        </div>
        <nav>
          {NAV.map(item => (
            <Link key={item.path} to={item.path}
              style={{
                display: 'block', padding: '10px 20px', color: location.pathname === item.path ? '#4ade80' : '#aaa',
                textDecoration: 'none', fontWeight: location.pathname === item.path ? 600 : 400,
                background: location.pathname === item.path ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: 20, left: 0, width: 220, padding: '0 20px' }}>
          <button onClick={() => { api.logout().finally(() => { window.location.href = '/login'; }); }}
            style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f5f5f5' }}>
        {children}
      </main>
    </div>
  );
}
