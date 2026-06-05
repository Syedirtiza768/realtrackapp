/* ─── Auth Context ────────────────────────────────────────
 *  Global auth state: JWT, user profile, permissions from /auth/me.
 * ────────────────────────────────────────────────────────── */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { fetchWithAuth } from '../../lib/authApi';

const API = '/api';
const TOKEN_KEY = 'mk_auth_token';
const USER_KEY = 'mk_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  roleSlug: string;
  roleName: string;
  active: boolean;
  permissions: string[];
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface MeResponse {
  user: AuthUser;
  organizations: {
    organizationId: string;
    name: string;
    slug: string;
    role: string;
  }[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  permissions: string[];
  loading: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function persistUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(!!localStorage.getItem(TOKEN_KEY));

  const permissions = user?.permissions ?? [];

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  const applySession = useCallback((accessToken: string, profile: AuthUser) => {
    setToken(accessToken);
    setUser(profile);
    persistUser(profile);
  }, []);

  const refreshSession = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setInitializing(false);
      return;
    }
    try {
      const data = await fetchWithAuth<MeResponse>(`${API}/auth/me`);
      setUser(data.user);
      persistUser(data.user);
      setToken(currentToken);
    } catch {
      setUser(null);
      setToken(null);
      persistUser(null);
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `Login failed (${res.status})`);
        }
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        setToken(data.accessToken);
        await refreshSession();
      } finally {
        setLoading(false);
      }
    },
    [refreshSession],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `Registration failed (${res.status})`);
        }
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        setToken(data.accessToken);
        await refreshSession();
      } finally {
        setLoading(false);
      }
    },
    [refreshSession],
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetchWithAuth(`${API}/auth/logout`, { method: 'POST' });
      }
    } catch {
      // ignore — still clear local session
    }
    setToken(null);
    setUser(null);
    persistUser(null);
    localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const res = await fetch(`${API}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'Password reset request failed');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        loading,
        initializing,
        login,
        register,
        logout,
        requestPasswordReset,
        refreshSession,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
