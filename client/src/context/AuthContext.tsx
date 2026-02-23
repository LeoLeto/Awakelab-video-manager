import { createContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { setUnauthorizedHandler } from '../services/apiService';

export interface UserPermissions {
  directoryAccess    : 'all' | 'specific';
  allowedDirectories : string[];
  canUpload          : boolean;
  canDelete          : boolean;
  canMove            : boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  directoryAccess   : 'all',
  allowedDirectories: [],
  canUpload         : false,
  canDelete         : false,
  canMove           : false,
};

interface AuthContextType {
  isAuthenticated: boolean;
  username       : string | null;
  token          : string | null;
  isAdmin        : boolean;
  permissions    : UserPermissions;
  login          : (username: string, password: string) => Promise<void>;
  logout         : () => void;
  loading        : boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username,        setUsername]         = useState<string | null>(null);
  const [token,           setToken]            = useState<string | null>(null);
  const [isAdmin,         setIsAdmin]          = useState(false);
  const [permissions,     setPermissions]      = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading,         setLoading]          = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    const storedToken    = localStorage.getItem('auth_token');
    const storedUsername = localStorage.getItem('auth_username');

    const verifyToken = async () => {
      if (storedToken && storedUsername) {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${storedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setToken(storedToken);
            setUsername(storedUsername);
            setIsAuthenticated(true);
            setIsAdmin(!!data.isAdmin);
            setPermissions(data.permissions ?? DEFAULT_PERMISSIONS);
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_username');
          }
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_username');
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [API_BASE_URL]);

  const login = async (usernameInput: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ username: usernameInput, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    setToken(data.token);
    setUsername(data.username);
    setIsAuthenticated(true);
    setIsAdmin(!!data.isAdmin);
    setPermissions(data.permissions ?? DEFAULT_PERMISSIONS);

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_username', data.username);
  };

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setPermissions(DEFAULT_PERMISSIONS);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
  }, []);

  // Register logout as the global 401 handler so deleted-user sessions
  // are cleared immediately on their next API call
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      username,
      token,
      isAdmin,
      permissions,
      login,
      logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

