import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppUser } from '@myathan/shared';
import { authApi } from '../lib/auth-api';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signIn: (token: string, user: AppUser) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = useCallback((token: string, newUser: AppUser) => {
    authApi.saveToken(token);
    setUser(newUser);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {});
    authApi.clearToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      authApi.clearToken();
      setUser(null);
    }
  }, []);

  // On mount: try to restore session from stored token / cookie
  useEffect(() => {
    authApi.me()
      .then(({ user: me }) => setUser(me))
      .catch(() => { authApi.clearToken(); setUser(null); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount only

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
