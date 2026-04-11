import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const NAV = [
  { path: '/', label: 'Dashboard', icon: '⊞', exact: true },
  { path: '/devices', label: 'Devices', icon: '⬡' },
  { path: '/releases', label: 'Releases', icon: '↑' },
  { path: '/groups', label: 'Groups', icon: '⬡⬡' },
  { path: '/analytics', label: 'Analytics', icon: '▤' },
  { path: '/users', label: 'App Users', icon: '👥' },
  { path: '/sso', label: 'SSO Config', icon: '⛨' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await api.logout().catch(() => {});
    window.location.href = '/login';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 224, background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed',
        top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1a7a4c, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(26,122,76,0.4)',
            }}>M</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>MyAthan</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Admin Console</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', overflow: 'auto' }}>
          {NAV.map(item => {
            const active = isActive(item);
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 8, marginBottom: 2, color: active ? '#4ade80' : '#94a3b8',
                textDecoration: 'none', fontWeight: active ? 600 : 400, fontSize: 13,
                background: active ? 'rgba(74,222,128,0.08)' : 'transparent',
                transition: 'all 0.15s',
                border: active ? '1px solid rgba(74,222,128,0.15)' : '1px solid transparent',
              }}>
                <span style={{ fontSize: 14, opacity: 0.9 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13,
            }}
          >
            <span>⎋</span> {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 224, background: '#f8fafc', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
