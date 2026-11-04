'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, clearSession, getStoredUser, getToken, saveSession, saveUser } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!getToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const response = await auth.me();
        if (!active) return;
        saveUser(response.user);
        setUser(response.user);
      } catch {
        if (!active) return;
        clearSession();
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setUser(null);
      router.replace('/login');
    };
    window.addEventListener('kcrm:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kcrm:unauthorized', handleUnauthorized);
  }, [router]);

  const login = useCallback(async ({ username, password, role }) => {
    const response = await auth.login({ username, password, role });
    saveSession({ token: response.token, user: response.user });
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      refresh: async () => {
        const response = await auth.me();
        saveUser(response.user);
        setUser(response.user);
        return response.user;
      },
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
