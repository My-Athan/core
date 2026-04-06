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
    } catch (e) {
      setError('Cannot reach device. Make sure you are on the same WiFi network.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}

export function useDeviceConfig() {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await deviceApi.getConfig();
      setConfig(data);
    } catch {
      // Device unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (partial: Partial<DeviceConfig>) => {
    await deviceApi.updateConfig(partial);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { config, loading, refresh, updateConfig };
}
