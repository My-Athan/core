import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface SSOProvider {
  provider: string;
  enabled: boolean;
  clientId?: string;
  redirectUri?: string;
  logtoEndpoint?: string;
  requireEmailVerification?: boolean;
  updatedAt?: string;
}

export function SSOConfig() {
  const [, setConfigs] = useState<Record<string, SSOProvider>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { text: string; ok: boolean }>>({});

  // Local form state
  const [googleForm, setGoogleForm] = useState({ enabled: false, clientId: '', clientSecret: '', redirectUri: '' });
  const [emailForm, setEmailForm] = useState({ enabled: true, requireEmailVerification: false });
  const [logtoForm, setLogtoForm] = useState({ enabled: false, logtoEndpoint: '' });

  useEffect(() => {
    api.getSSOConfig().then(({ configs: list }) => {
      const map: Record<string, SSOProvider> = {};
      for (const c of list) map[c.provider] = c;
      setConfigs(map);

      if (map.google) setGoogleForm({
        enabled: map.google.enabled,
        clientId: map.google.clientId || '',
        clientSecret: '',
        redirectUri: map.google.redirectUri || '',
      });
      if (map.email) setEmailForm({
        enabled: map.email.enabled ?? true,
        requireEmailVerification: map.email.requireEmailVerification ?? false,
      });
      if (map.logto) setLogtoForm({
        enabled: map.logto.enabled,
        logtoEndpoint: map.logto.logtoEndpoint || '',
      });
    }).finally(() => setLoading(false));
  }, []);

  function setMsg(provider: string, text: string, ok: boolean) {
    setMessages(m => ({ ...m, [provider]: { text, ok } }));
    setTimeout(() => setMessages(m => { const n = { ...m }; delete n[provider]; return n; }), 4000);
  }

  async function save(provider: string, data: Record<string, unknown>) {
    setSaving(s => ({ ...s, [provider]: true }));
    try {
      await api.updateSSOConfig(provider, data as any);
      setMsg(provider, 'Settings saved successfully', true);
    } catch (err: any) {
      setMsg(provider, err.message || 'Failed to save', false);
    } finally {
      setSaving(s => ({ ...s, [provider]: false }));
    }
  }

  if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>Loading SSO configuration...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>SSO Configuration</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Manage authentication providers for the MyAthan mobile app. Changes take effect immediately.
        </p>
      </div>

      {/* Logto Section */}
      <ConfigCard
        title="Logto (Recommended)"
        icon="⛨"
        badge="Open Source"
        badgeColor="#7c3aed"
        description="Self-hosted identity platform. Manages all SSO providers in one place. Run with Docker Compose."
        enabled={logtoForm.enabled}
        onToggle={v => setLogtoForm(f => ({ ...f, enabled: v }))}
        message={messages.logto}
        onSave={() => save('logto', logtoForm)}
        saving={saving.logto}
      >
        <FormField
          label="Logto Endpoint URL"
          hint="The URL where Logto is running (e.g., http://logto:3001 or https://auth.yourdomain.com)"
          value={logtoForm.logtoEndpoint}
          onChange={v => setLogtoForm(f => ({ ...f, logtoEndpoint: v }))}
          placeholder="https://auth.yourdomain.com"
        />
        <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534', border: '1px solid #bbf7d0' }}>
          <strong>Getting started:</strong> Logto is included in the Docker Compose configuration.
          Run <code style={{ fontFamily: 'monospace', background: '#dcfce7', padding: '1px 4px', borderRadius: 3 }}>docker compose up logto</code> then
          visit the admin console at <code style={{ fontFamily: 'monospace', background: '#dcfce7', padding: '1px 4px', borderRadius: 3 }}>:3002</code> to set up Google and email providers.
        </div>
      </ConfigCard>

      {/* Google OAuth Section */}
      <ConfigCard
        title="Google Sign-In"
        icon="G"
        iconBg="#4285F4"
        description="Allow users to sign in with their Google account. Requires Google Cloud OAuth credentials."
        enabled={googleForm.enabled}
        onToggle={v => setGoogleForm(f => ({ ...f, enabled: v }))}
        message={messages.google}
        onSave={() => save('google', googleForm)}
        saving={saving.google}
      >
        <FormField
          label="Google Client ID"
          hint="From Google Cloud Console → APIs & Services → Credentials"
          value={googleForm.clientId}
          onChange={v => setGoogleForm(f => ({ ...f, clientId: v }))}
          placeholder="123456789-abc.apps.googleusercontent.com"
        />
        <FormField
          label="Google Client Secret"
          hint="Leave blank to keep the existing secret"
          value={googleForm.clientSecret}
          onChange={v => setGoogleForm(f => ({ ...f, clientSecret: v }))}
          placeholder="Leave blank to keep existing"
          type="password"
        />
        <FormField
          label="Redirect URI"
          hint="Must match exactly what's configured in Google Cloud Console"
          value={googleForm.redirectUri}
          onChange={v => setGoogleForm(f => ({ ...f, redirectUri: v }))}
          placeholder="https://api.yourdomain.com/api/auth/google/callback"
        />
        <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e40af', border: '1px solid #bfdbfe' }}>
          <strong>Setup steps:</strong> Create credentials in{' '}
          <a href="#" style={{ color: '#2563eb' }}>Google Cloud Console</a> → OAuth 2.0 Client ID → Web application.
          Add your API domain to authorized redirect URIs.
        </div>
      </ConfigCard>

      {/* Email/Password Section */}
      <ConfigCard
        title="Email & Password"
        icon="✉"
        description="Allow users to register and sign in with email and password. Always available as a fallback."
        enabled={emailForm.enabled}
        onToggle={v => setEmailForm(f => ({ ...f, enabled: v }))}
        message={messages.email}
        onSave={() => save('email', emailForm)}
        saving={saving.email}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={emailForm.requireEmailVerification}
            onChange={e => setEmailForm(f => ({ ...f, requireEmailVerification: e.target.checked }))}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Require email verification</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Users must verify their email before accessing the app</div>
          </div>
        </label>
      </ConfigCard>

      {/* API Info */}
      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Mobile App Integration</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
          The mobile PWA uses these API endpoints for authentication:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['GET', '/api/auth/providers', 'Get enabled auth providers'],
            ['POST', '/api/auth/register', 'Register with email + password'],
            ['POST', '/api/auth/login', 'Login with email + password'],
            ['POST', '/api/auth/google', 'Authenticate with Google ID token'],
            ['GET', '/api/auth/me', 'Get current user'],
            ['POST', '/api/auth/logout', 'Sign out'],
          ].map(([method, path, desc]) => (
            <div key={path} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, fontSize: 10,
                background: method === 'GET' ? '#dbeafe' : '#dcfce7',
                color: method === 'GET' ? '#1e40af' : '#166534',
                flexShrink: 0,
              }}>{method}</span>
              <code style={{ fontFamily: 'monospace', color: '#374151', flexShrink: 0 }}>{path}</code>
              <span style={{ color: '#94a3b8' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ title, icon, iconBg, badge, badgeColor, description, enabled, onToggle, children, message, onSave, saving }: {
  title: string;
  icon: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
  message?: { text: string; ok: boolean };
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      marginBottom: 16, overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: iconBg || '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: iconBg ? '#fff' : '#374151', flexShrink: 0,
          }}>{icon}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{title}</span>
              {badge && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: badgeColor ? `${badgeColor}20` : '#f1f5f9',
                  color: badgeColor || '#64748b',
                }}>{badge}</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{description}</p>
          </div>
        </div>

        {/* Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: enabled ? '#166534' : '#94a3b8', fontWeight: 500 }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <div
            onClick={() => onToggle(!enabled)}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
              background: enabled ? '#1a7a4c' : '#e2e8f0', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: enabled ? 23 : 3, width: 18, height: 18,
              borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </div>
        </label>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}

        {message && (
          <div style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            background: message.ok ? '#dcfce7' : '#fef2f2',
            color: message.ok ? '#166534' : '#dc2626',
            border: `1px solid ${message.ok ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onSave} disabled={saving} style={{
            padding: '8px 20px', background: '#1a7a4c', color: '#fff', border: 'none',
            borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, value, onChange, placeholder, type = 'text' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, outline: 'none', boxSizing: 'border-box',
          fontFamily: type === 'password' ? undefined : 'monospace',
        }}
      />
    </div>
  );
}
