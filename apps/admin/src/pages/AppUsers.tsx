import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AppUserCreateModal } from '../components/AppUserCreateModal';

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

function ProviderBadge({ provider }: { provider: string }) {
  const isGoogle = provider === 'google';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: isGoogle ? '#fef3c7' : '#dbeafe',
      color: isGoogle ? '#92400e' : '#1e40af',
      marginRight: 4,
    }}>
      {isGoogle ? 'G' : '✉'} {isGoogle ? 'Google' : 'Email'}
    </span>
  );
}

function RowMenu({ user, onAction }: { user: any; onAction: (action: string, user: any) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { label: 'View details', action: 'view' },
    user.status === 'blocked'
      ? { label: 'Unblock', action: 'unblock' }
      : { label: 'Block', action: 'block', danger: false },
    { label: 'Reset password', action: 'reset-password' },
    user.status === 'deleted'
      ? { label: 'Restore', action: 'restore' }
      : { label: 'Delete', action: 'delete', danger: true },
    ...(user.status === 'deleted' ? [{ label: 'Purge now', action: 'purge', danger: true }] : []),
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
          padding: '3px 8px', cursor: 'pointer', fontSize: 14, color: '#64748b',
        }}
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 160, overflow: 'hidden',
        }}>
          {items.map(item => (
            <button
              key={item.action}
              onClick={e => { e.stopPropagation(); setOpen(false); onAction(item.action, user); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13,
                color: item.danger ? '#dc2626' : '#374151',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [blockTarget, setBlockTarget] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const LIMIT = 50;

  useEffect(() => { load(); }, [page, statusFilter, providerFilter]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAppUsers({
        page, limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        authProvider: providerFilter || undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleAction(action: string, user: any) {
    if (action === 'view') {
      navigate(`/users/${user.id}`);
    } else if (action === 'block') {
      setBlockTarget(user);
      setBlockReason('');
    } else if (action === 'unblock') {
      if (!confirm(`Unblock ${user.email}?`)) return;
      try {
        await api.unblockAppUser(user.id);
        load();
      } catch (e: any) { alert(e.message); }
    } else if (action === 'reset-password') {
      if (!confirm(`Reset password for ${user.email}? A new temp password will be generated.`)) return;
      try {
        const res = await api.resetAppUserPassword(user.id);
        alert(`New temp password for ${user.email}:\n\n${res.tempPassword}\n\nCopy it now — it won't be shown again.`);
      } catch (e: any) { alert(e.message); }
    } else if (action === 'delete') {
      if (!confirm(`Soft-delete ${user.email}? They will have 30 days to restore.`)) return;
      try {
        await api.deleteAppUser(user.id);
        load();
      } catch (e: any) { alert(e.message); }
    } else if (action === 'restore') {
      if (!confirm(`Restore ${user.email}?`)) return;
      try {
        await api.restoreAppUser(user.id);
        load();
      } catch (e: any) { alert(e.message); }
    } else if (action === 'purge') {
      if (!confirm(`PERMANENTLY delete ${user.email}? This cannot be undone.`)) return;
      if (!confirm(`Are you absolutely sure? All data for ${user.email} will be erased.`)) return;
      try {
        await api.purgeAppUser(user.id);
        load();
      } catch (e: any) { alert(e.message); }
    }
  }

  async function submitBlock() {
    if (!blockTarget || !blockReason.trim()) return;
    setBlockLoading(true);
    try {
      await api.blockAppUser(blockTarget.id, blockReason.trim());
      setBlockTarget(null);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBlockLoading(false);
    }
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>App Users</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {total} user{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: '#1a7a4c', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          + Create user
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email or name…"
            style={{
              width: 260, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none',
            }}
          />
          <button type="submit" style={{
            background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151',
          }}>
            Search
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="blocked">Blocked</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          value={providerFilter}
          onChange={e => { setProviderFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
          }}
        >
          <option value="">All providers</option>
          <option value="google">Google</option>
          <option value="email">Email</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
          borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No users found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>User</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Providers</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Last login</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b' }}>Joined</th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr
                  key={user.id}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onClick={() => navigate(`/users/${user.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                        background: '#e2e8f0', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 600, color: '#64748b',
                      }}>
                        {user.avatarUrl
                          ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : (user.displayName || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {user.displayName || <span style={{ color: '#94a3b8' }}>—</span>}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {user.authProviders?.map((p: string) => <ProviderBadge key={p} provider={p} />)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{statusBadge(user.status)}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{fmtDate(user.lastLoginAt)}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{fmtDate(user.createdAt)}</td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <RowMenu user={user} onAction={handleAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, justifyContent: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
              color: page === 1 ? '#94a3b8' : '#374151', fontSize: 13,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Page {page} of {Math.ceil(total / LIMIT)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / LIMIT)}
            style={{
              padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', cursor: page >= Math.ceil(total / LIMIT) ? 'not-allowed' : 'pointer',
              color: page >= Math.ceil(total / LIMIT) ? '#94a3b8' : '#374151', fontSize: 13,
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Block modal */}
      {blockTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setBlockTarget(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 420,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>
              Block {blockTarget.email}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              This user will be immediately locked out. Provide a reason.
            </p>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Reason for blocking…"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBlockTarget(null)}
                style={{
                  padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitBlock}
                disabled={blockLoading || !blockReason.trim()}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: blockLoading || !blockReason.trim() ? '#94a3b8' : '#dc2626',
                  color: '#fff', cursor: blockLoading || !blockReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {blockLoading ? 'Blocking…' : 'Block user'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <AppUserCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
