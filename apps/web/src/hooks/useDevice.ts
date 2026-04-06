import { useState, useEffect, useCallback } from 'react';
import type { DeviceStatus, DeviceConfig } from '@myathan/shared';
import { deviceApi } from '../lib/device-api';

export function useDeviceStatus() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deviceApi.getStatus();
      setStatus(data);
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Device not responding (timeout)'
        : 'Cannot reach device. Make sure you are on the same WiFi network.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}

export function useDeviceConfig() {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deviceApi.getConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'Device timeout' : 'Device unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (partial: Partial<DeviceConfig>) => {
    try {
      setSaving(true);
      setError(null);
      await deviceApi.updateConfig(partial);
      await refresh();
    } catch (e: any) {
      setError('Failed to save config');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { config, loading, error, saving, refresh, updateConfig };
}
