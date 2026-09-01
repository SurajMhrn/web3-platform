import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/apiClient';

export type UserRole = 'user' | 'admin' | 'moderator';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  bio?: string;
  profile_picture?: string;
  wallet_address?: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  setUser: (user: UserProfile) => void;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Use a ref to track if we've already done the initial load — prevents re-running
  // when this component re-renders for any other reason.
  const initialised = useRef(false);

  // ── One-time session check on mount ─────────────────────────────────────────
  // The access/refresh tokens live only in httpOnly cookies, so there is nothing
  // to read from localStorage — we just ask the API who we are. A 401 here is
  // retried once via /auth/refresh by the apiClient interceptor; if that also
  // fails, the user is simply logged out (which is the correct default state).
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const loadProfile = async () => {
      try {
        const res = await apiClient.get('/auth/profile', { timeout: 5000 });
        setUserState(res.data.user);
      } catch {
        setUserState(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const setUser = (updatedUser: UserProfile) => {
    setUserState(updatedUser);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {}, { timeout: 3000 });
    } catch {
      // Always clear local state even if the server call fails.
    }
    setUserState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isModerator: user?.role === 'moderator' || user?.role === 'admin',
        setUser,
        logout,
        loading,
      }}
    >
      {loading ? (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top right, var(--bg-gradient-1), var(--bg-gradient-2))',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Loading...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
