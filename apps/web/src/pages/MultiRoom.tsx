import React, { useState, useEffect } from 'react';
import { useDeviceConfig } from '../hooks/useDevice';

export function MultiRoom() {
  const { config, updateConfig } = useDeviceConfig();
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    if (config?.multiRoom?.groupId) {
      setGroupId(config.multiRoom.groupId);
    }
  }, [config]);

  if (!config) {
    return <div className="text-center py-12 text-gray-500">Loading config...</div>;
  }

  const isInGroup = config.multiRoom?.groupId && config.multiRoom.groupId.length > 0;

  async function handleJoinGroup() {
    if (!groupId.trim()) return;
    await updateConfig({ multiRoom: { groupId: groupId.trim(), syncOffsetMs: 0 } } as any);
  }

  async function handleLeaveGroup() {
    setGroupId('');
    await updateConfig({ multiRoom: { groupId: '', syncOffsetMs: 0 } } as any);
  }

  async function handleTestSync() {
    try {
      await fetch('http://myathan.local/trigger?prayer=0', { method: 'POST' });
    } catch {
      // Device unreachable
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Multi-Room</h2>
      <p className="text-sm text-gray-500">
        Link multiple MyAthan devices to play athan simultaneously across rooms.
      </p>

      {isInGroup ? (
        <>
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-sm text-emerald-700 font-medium">In Group</p>
            <p className="text-lg font-mono text-emerald-900 mt-1">{config.multiRoom?.groupId}</p>
          </div>

          <button onClick={handleTestSync}
            className="w-full bg-emerald-700 text-white py-3 rounded-xl font-medium">
            Test Sync (Play Athan)
          </button>

          <button onClick={handleLeaveGroup}
            className="w-full border border-red-300 text-red-600 py-3 rounded-xl font-medium">
            Leave Group
          </button>
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Join a Group</h3>
            <p className="text-xs text-gray-500">
              Enter the group ID shared by your other devices. All devices in the same group will play athan at the same time.
            </p>
            <input type="text" value={groupId} onChange={e => setGroupId(e.target.value)}
              placeholder="Enter group ID"
              className="w-full border rounded-xl p-3" />
            <button onClick={handleJoinGroup}
              disabled={!groupId.trim()}
              className="w-full bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50">
              Join Group
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Create a Group</h3>
            <p className="text-xs text-gray-500">
              Create a new group from the admin dashboard, then enter the group ID here on each device.
            </p>
          </div>
        </>
      )}

      {/* How it Works */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-2">
        <p className="font-medium text-gray-700">How Multi-Room Sync Works</p>
        <p>1. All devices in a group sync their clocks via NTP</p>
        <p>2. The cloud server sends a "play at exact time X" trigger to all devices</p>
        <p>3. Each device plays athan at precisely the same moment (within 50ms)</p>
        <p>4. Requires internet connection for sync coordination</p>
      </div>
    </div>
  );
}
