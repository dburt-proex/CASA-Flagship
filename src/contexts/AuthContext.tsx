import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (role?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Shape of the JWT payload we decode client-side for expiry checks only.
// The server always re-validates the token on every request.
interface JwtPayloadBasic {
  exp?: number;
}

function decodeJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as JwtPayloadBasic;
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = decodeJwtExpiry(token);
  if (exp === null) return true; // treat undecodable tokens as expired
  return exp * 1000 < Date.now();
}

function parseStoredUser(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'email' in parsed &&
      'role' in parsed &&
      typeof (parsed as Record<string, unknown>).email === 'string' &&
      typeof (parsed as Record<string, unknown>).role === 'string'
    ) {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('casa_token');
    const storedUser = localStorage.getItem('casa_user');
    
    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        localStorage.removeItem('casa_token');
        localStorage.removeItem('casa_user');
      } else {
        const parsedUser = parseStoredUser(storedUser);
        if (parsedUser) {
          setToken(storedToken);
          setUser(parsedUser);
        } else {
          localStorage.removeItem('casa_token');
          localStorage.removeItem('casa_user');
        }
      }
    }
  }, []);

  const login = async (role: string = 'operator') => {
    // Dev login is only permitted in non-production environments.
    // The server-side endpoint also enforces this, but we gate early.
    if (process.env.NODE_ENV === 'production') {
      console.error('[Auth] Dev login is disabled in production.');
      return;
    }
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email: `dev-${role}@casa.local` })
      });
      
      if (!res.ok) throw new Error('Login failed');
      
      const data = await res.json() as { token: string; user: User };
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('casa_token', data.token);
      localStorage.setItem('casa_user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('casa_token');
    localStorage.removeItem('casa_user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      isAuthenticated: !!token,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
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
