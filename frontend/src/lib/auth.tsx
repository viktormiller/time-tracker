import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_URL = '/api';

// Auth context type definition
interface AuthContextType {
  user: { userId: number; role: string } | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configure axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 error and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token (uses HttpOnly cookie)
        const response = await axios.post(`${API_URL}/auth/refresh`);
        const { accessToken } = response.data;

        // Update token in memory
        if (window.authState) {
          window.authState.setAccessToken(accessToken);
        }

        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        if (window.authState) {
          window.authState.handleLogout();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Global auth state reference for interceptor
declare global {
  interface Window {
    authState?: {
      setAccessToken: (token: string) => void;
      handleLogout: () => void;
    };
  }
}

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ userId: number; role: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const isAuthenticated = !!accessToken && !!user;

  // Login function
  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      });

      const { accessToken: token, expiresIn } = response.data;

      // Decode JWT payload to get user info (simple base64 decode)
      const payload = JSON.parse(atob(token.split('.')[1]));

      setAccessToken(token);
      setUser({
        userId: payload.userId,
        role: payload.role,
      });

      // Set default authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint if authenticated
      if (accessToken) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      // Clear local state
      setAccessToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Handle logout from interceptor
  const handleLogout = () => {
    setAccessToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Setup global auth state reference for interceptor
  useEffect(() => {
    window.authState = {
      setAccessToken,
      handleLogout,
    };

    return () => {
      delete window.authState;
    };
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
