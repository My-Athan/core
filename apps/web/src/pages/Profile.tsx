import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/auth-api';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ur', label: 'اردو' },
  { value: 'id', label: 'Bahasa Indonesia' },
];

export function Profile() {
  const { user, refresh, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile edit state
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [language, setLanguage] = useState(user?.language ?? 'en');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Linked devices
  const [devices, setDevices] = useState<any[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) return null;

  const initials = (user.displayName || user.email)
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ── Profile save ────────────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError('');
    setSaving(true);
    try {
      await authApi.updateProfile({
        displayName: displayName || undefined,
        avatarUrl: avatarUrl || undefined,
        language,
      });
      await refresh();
      setEditMode(false);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setDisplayName(user!.displayName ?? '');
    setAvatarUrl(user!.avatarUrl ?? '');
    setLanguage(user!.language ?? 'en');
    setProfileError('');
    setEditMode(false);
  }

  // ── Devices ─────────────────────────────────────────────────
  async function loadDevices() {
    if (devices !== null) return; // already loaded
    setDevicesLoading(true);
    setDevicesError('');
    try {
      const res = await authApi.getDevices();
      setDevices(res.devices);
    } catch (err: any) {
      setDevicesError(err.message || 'Failed to load devices');
    } finally {
      setDevicesLoading(false);
    }
  }

  async function handleUnlink(deviceId: string) {
    if (!confirm(`Unlink device ${deviceId}? You can re-link it later.`)) return;
    setUnlinkingId(deviceId);
    try {
      await authApi.unlinkDevice(deviceId);
      setDevices(d => (d ?? []).filter(dev => dev.deviceId !== deviceId));
    } catch (err: any) {
      alert(err.message || 'Failed to unlink device');
    } finally {
      setUnlinkingId(null);
    }
  }

  // ── Delete account ───────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleteError('');
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      await signOut();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Avatar + name */}
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
        {avatarUrl && !editMode ? (
          <img
            src={avatarUrl}
            alt={user.displayName ?? user.email}
            className="w-20 h-20 rounded-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-700 flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
        )}
        <div className="text-center">
          <p className="font-semibold text-gray-900">{user.displayName || '—'}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="flex gap-1 justify-center mt-1">
            {user.authProviders.includes('google') && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Google</span>
            )}
            {user.authProviders.includes('email') && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Email</span>
            )}
          </div>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="text-sm text-emerald-700 font-medium"
          >
            Edit profile
          </button>
        )}
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="bg-white rounded-2xl p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Edit profile</h2>
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
              {profileError}
            </div>
          )}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Linked devices */}
      <div className="bg-white rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Linked devices</h2>
          {devices === null && (
            <button
              onClick={loadDevices}
              className="text-sm text-emerald-700 font-medium"
            >
              Load
            </button>
          )}
        </div>
        {devicesLoading && (
          <p className="text-sm text-gray-400">Loading…</p>
        )}
        {devicesError && (
          <p className="text-sm text-red-500">{devicesError}</p>
        )}
        {devices !== null && devices.length === 0 && (
          <p className="text-sm text-gray-400">No linked devices.</p>
        )}
        {devices !== null && devices.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {devices.map(dev => (
              <li key={dev.deviceId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 font-mono">{dev.deviceId}</p>
                  {dev.name && (
                    <p className="text-xs text-gray-500">{dev.name}</p>
                  )}
                </div>
                <button
                  onClick={() => handleUnlink(dev.deviceId)}
                  disabled={unlinkingId === dev.deviceId}
                  className="text-xs text-red-600 font-medium disabled:opacity-50"
                >
                  {unlinkingId === dev.deviceId ? 'Unlinking…' : 'Unlink'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl p-4">
        <button
          onClick={async () => {
            await signOut();
            navigate('/login', { replace: true });
          }}
          className="w-full text-sm font-semibold text-gray-700 py-3 rounded-xl bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl p-4 border border-red-100">
        <h2 className="font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-xs text-gray-500 mb-3">
          Deleting your account starts a 30-day grace period. You can contact support to restore it before then.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full bg-red-50 text-red-700 border border-red-200 py-3 rounded-xl font-semibold text-sm"
        >
          Delete my account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Delete account?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Type <strong>delete</strong> to confirm. Your account will be soft-deleted and permanently erased after 30 days.
            </p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
                {deleteError}
              </div>
            )}
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="delete"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'delete' || deleting}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError(''); }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
