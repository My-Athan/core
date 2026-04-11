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

export function AppUserEditModal({
  user,
  onClose,
  onSaved,
}: {
  user: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [language, setLanguage] = useState(user.language ?? 'en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Only send fields that changed
    const update: Record<string, string> = {};
    if (email !== user.email) update.email = email;
    if (displayName !== (user.displayName ?? '')) update.displayName = displayName;
    if (language !== user.language) update.language = language;

    if (Object.keys(update).length === 0) { onClose(); return; }

    if (update.email && !confirm(`Change email from ${user.email} to ${email}?`)) return;

    setLoading(true);
    try {
      const res = await api.updateAppUser(user.id, update);
      onSaved(res.user);
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
          background: '#fff', borderRadius: 12, padding: 24, width: 440,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#0f172a' }}>Edit user</h3>

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
            <label style={labelStyle}>Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            {email !== user.email && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f59e0b' }}>
                ⚠ Changing email requires confirmation
              </p>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Display name</label>
            <input
              type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name" style={inputStyle}
            />
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
              {loading ? 'Saving…' : 'Save changes'}
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
      </div>
    </div>
  );
}
