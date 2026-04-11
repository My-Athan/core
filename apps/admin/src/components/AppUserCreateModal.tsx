import React, { useState } from 'react';
import { api } from '../lib/api';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'tr', label: 'Turkish' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'ur', label: 'Urdu' },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  for (const b of arr) {
    if (b < 248) out += chars[b % chars.length];
  }
  return out.slice(0, 16) || 'TempPass123';
}

export function AppUserCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: any, tempPassword: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tempPassword, setTempPassword] = useState(generatePassword);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ user: any; tempPassword: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.createAppUser({ email, displayName, tempPassword, language });
      setCreated(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, padding: 24, width: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {created ? (
          /* ── Success state ── */
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>User created</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Account created for <strong>{created.user.email}</strong>. Share the temp password
              with the user out-of-band — they will be required to change it on first login.
            </p>
            <div style={{
              background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                Temp password (copy now):
              </div>
              <code style={{
                display: 'block', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2,
                color: '#0f172a', padding: '10px 12px', background: '#fff',
                borderRadius: 6, border: '1px solid #fde68a',
              }}>
                {created.tempPassword}
              </code>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(created.tempPassword);
                  onCreated(created.user, created.tempPassword);
                }}
                style={{
                  flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
                  background: '#1a7a4c', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                Copy & close
              </button>
              <button
                onClick={() => onCreated(created.user, created.tempPassword)}
                style={{
                  flex: 1, padding: '9px 0', border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13,
                }}
              >
                Close without copying
              </button>
            </div>
          </>
        ) : (
          /* ── Form ── */
          <>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#0f172a' }}>Create app user</h3>

            {error && (
              <div style={{
                background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
                borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #fecaca',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com" style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Display name *</label>
                <input
                  type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="Full name" style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Temp password *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text" required value={tempPassword} onChange={e => setTempPassword(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => setTempPassword(generatePassword())}
                    style={{
                      padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                      background: '#f8fafc', cursor: 'pointer', fontSize: 12, color: '#374151',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Generate
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                  Min 8 characters. User must change on first login.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Language</label>
                <select
                  value={language} onChange={e => setLanguage(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
                    background: loading ? '#94a3b8' : '#1a7a4c', color: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {loading ? 'Creating…' : 'Create user'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '9px 0', border: '1px solid #e2e8f0', borderRadius: 8,
                    background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
