import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUsername = localStorage.getItem('auth_username');

    const verifyToken = async () => {
      if (storedToken && storedUsername) {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
          
          if (res.ok) {
            setToken(storedToken);
            setUsername(storedUsername);
            setIsAuthenticated(true);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_username');
          }
        } catch {
          // Error verifying, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_username');
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [API_BASE_URL]);

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    
    setToken(data.token);
    setUsername(data.username);
    setIsAuthenticated(true);
    
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_username', data.username);
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        token,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Export context for useAuth hook
export { AuthContext };
