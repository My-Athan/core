import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AppUserEditModal } from '../components/AppUserEditModal';

type Tab = 'profile' | 'devices' | 'danger';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '10px 0' }}>
      <span style={{ width: 180, fontSize: 13, color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0f172a', wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    active:  { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
    invited: { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
    blocked: { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    deleted: { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  };
  const s = map[status] ?? map.active;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AppUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [showEdit, setShowEdit] = useState(false);

  // Danger zone state
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string | null>(null);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAppUser(userId!);
      setUser(data.user);
      setDevices(data.devices);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function showMsg(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function doAction(action: string, extra?: any) {
    setActionLoading(action);
    try {
      if (action === 'block') {
        if (!blockReason.trim()) { showMsg('Block reason is required', false); return; }
        const res = await api.blockAppUser(userId!, blockReason.trim());
        setUser(res.user);
        setBlockReason('');
        showMsg('User blocked', true);
      } else if (action === 'unblock') {
        const res = await api.unblockAppUser(userId!);
        setUser(res.user);
        showMsg('User unblocked', true);
      } else if (action === 'reset-password') {
        const res = await api.resetAppUserPassword(userId!);
        setUser(res.user);
        setNewTempPassword(res.tempPassword);
        showMsg('Password reset — copy the temp password below', true);
      } else if (action === 'delete') {
        if (!confirm(`Soft-delete ${user.email}? They will have 30 days to restore before permanent erasure.`)) return;
        const res = await api.deleteAppUser(userId!);
        setUser(res.user);
        showMsg('User soft-deleted', true);
      } else if (action === 'restore') {
        const res = await api.restoreAppUser(userId!);
        setUser(res.user);
        showMsg('User restored to active', true);
      } else if (action === 'purge') {
        if (!confirm(`PERMANENTLY delete ${user.email}?\n\nThis erases all their data and cannot be undone.`)) return;
        if (!confirm('Second confirmation — are you absolutely sure?')) return;
        await api.purgeAppUser(userId!);
        navigate('/users');
      }
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
          borderRadius: 8, fontSize: 13, border: '1px solid #fecaca',
        }}>
          {error || 'User not found'}
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'devices', label: `Devices (${devices.length})` },
    { id: 'danger', label: 'Actions' },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Back + header */}
      <button
        onClick={() => navigate('/users')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
          fontSize: 13, padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ← App Users
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
          background: '#e2e8f0', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#64748b', flexShrink: 0,
        }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : (user.displayName || user.email).charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            {user.displayName || user.email}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{user.email}</span>
            {statusBadge(user.status)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid #1a7a4c' : '2px solid transparent',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? '#1a7a4c' : '#64748b',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Profile details</h2>
            <button
              onClick={() => setShowEdit(true)}
              style={{
                padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151',
              }}
            >
              Edit
            </button>
          </div>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Display name" value={user.displayName} />
          <InfoRow label="Language" value={user.language} />
          <InfoRow label="Auth providers" value={
            <span>{user.authProviders?.join(', ') || '—'}</span>
          } />
          <InfoRow label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
          <InfoRow label="Must change password" value={user.mustChangePassword ? 'Yes' : 'No'} />
          <InfoRow label="Status" value={statusBadge(user.status)} />
          {user.blockedReason && <InfoRow label="Block reason" value={user.blockedReason} />}
          {user.blockedAt && <InfoRow label="Blocked at" value={fmtDate(user.blockedAt)} />}
          {user.deletedAt && <InfoRow label="Deleted at" value={fmtDate(user.deletedAt)} />}
          {user.purgeAt && <InfoRow label="Purge at" value={fmtDate(user.purgeAt)} />}
          <InfoRow label="Last login" value={fmtDate(user.lastLoginAt)} />
          <InfoRow label="Created" value={fmtDate(user.createdAt)} />
          <InfoRow label="Updated" value={fmtDate(user.updatedAt)} />
          <InfoRow label="User ID" value={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{user.id}</span>} />
        </div>
      )}

      {/* ── Devices tab ── */}
      {activeTab === 'devices' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {devices.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              No devices linked to this user
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Device ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Firmware</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Location</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Last heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr
                    key={d.id}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onClick={() => navigate(`/devices/${d.deviceId}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>{d.deviceId}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{d.firmwareVersion || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {d.city ? `${d.city}, ${d.country}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{fmtDate(d.lastHeartbeat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Danger / Actions tab ── */}
      {activeTab === 'danger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Feedback message */}
          {actionMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: actionMsg.ok ? '#dcfce7' : '#fef2f2',
              color: actionMsg.ok ? '#166534' : '#dc2626',
              border: `1px solid ${actionMsg.ok ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {actionMsg.text}
            </div>
          )}

          {/* Temp password reveal */}
          {newTempPassword && (
            <div style={{
              background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                New temp password (copy now — shown once):
              </div>
              <code style={{
                display: 'block', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2,
                color: '#0f172a', padding: '10px 14px', background: '#fff',
                borderRadius: 6, border: '1px solid #fde68a',
              }}>
                {newTempPassword}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(newTempPassword); setNewTempPassword(null); }}
                style={{
                  marginTop: 10, padding: '6px 14px', border: '1px solid #fde68a', borderRadius: 6,
                  background: '#fff', cursor: 'pointer', fontSize: 12, color: '#92400e',
                }}
              >
                Copy & dismiss
              </button>
            </div>
          )}

          {/* Block / Unblock */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              {user.status === 'blocked' ? 'Unblock user' : 'Block user'}
            </h3>
            {user.status === 'blocked' ? (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
                  Blocked since {fmtDate(user.blockedAt)}. Reason: {user.blockedReason || '—'}
                </p>
                <button
                  onClick={() => doAction('unblock')}
                  disabled={actionLoading === 'unblock'}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: '#1a7a4c', color: '#fff', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {actionLoading === 'unblock' ? 'Unblocking…' : 'Unblock'}
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
                  User will be immediately locked out. Their existing JWT will be rejected on next request.
                </p>
                <textarea
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  placeholder="Reason for blocking…"
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                <button
                  onClick={() => doAction('block')}
                  disabled={actionLoading === 'block' || !blockReason.trim()}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: actionLoading === 'block' || !blockReason.trim() ? '#94a3b8' : '#f59e0b',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {actionLoading === 'block' ? 'Blocking…' : 'Block user'}
                </button>
              </>
            )}
          </div>

          {/* Reset password */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Reset password</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
              Generates a new temporary password. The user will be forced to change it on next login.
              Only works for email-auth accounts.
            </p>
            <button
              onClick={() => doAction('reset-password')}
              disabled={actionLoading === 'reset-password'}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600,
              }}
            >
              {actionLoading === 'reset-password' ? 'Generating…' : 'Reset password'}
            </button>
          </div>

          {/* Delete / Restore */}
          <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
              {user.status === 'deleted' ? 'Restore account' : 'Delete account'}
            </h3>
            {user.status === 'deleted' ? (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
                  Account is soft-deleted. Purge scheduled for {fmtDate(user.purgeAt)}.
                  Restore to make it active again.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => doAction('restore')}
                    disabled={actionLoading === 'restore'}
                    style={{
                      padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: '#1a7a4c', color: '#fff', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {actionLoading === 'restore' ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    onClick={() => doAction('purge')}
                    disabled={actionLoading === 'purge'}
                    style={{
                      padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {actionLoading === 'purge' ? 'Purging…' : 'Purge now (irreversible)'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
                  Soft-delete the account. The user gets a 30-day grace period before permanent erasure.
                  You can restore within that window.
                </p>
                <button
                  onClick={() => doAction('delete')}
                  disabled={actionLoading === 'delete'}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {actionLoading === 'delete' ? 'Deleting…' : 'Delete account'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <AppUserEditModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setUser(updated); setShowEdit(false); }}
        />
      )}
    </div>
  );
}
