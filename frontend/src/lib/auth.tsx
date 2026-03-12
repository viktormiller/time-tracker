import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import axios from 'axios';
import { toast } from '../hooks/useToast';

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

// Token refresh state: promise-based queue so parallel 401s share one refresh
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Configure axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Extract the URL path from the request (handle both relative and absolute URLs)
    const requestPath = originalRequest.url || '';
    const isRefreshEndpoint = requestPath.includes('/auth/refresh');
    const isLoginEndpoint = requestPath.includes('/auth/login');
    const isLogoutEndpoint = requestPath.includes('/auth/logout');

    // Don't retry if:
    // 1. Not a 401 error
    // 2. Already retried this request
    // 3. The failing request was the refresh endpoint itself (prevents infinite loop)
    // 4. The failing request was login or logout
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isRefreshEndpoint ||
      isLoginEndpoint ||
      isLogoutEndpoint
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If a refresh is already in progress, wait for it and retry with the new token
    if (isRefreshing && refreshPromise) {
      const newToken = await refreshPromise;
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return axios(originalRequest);
    }

    isRefreshing = true;
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`)
      .then((response) => {
        const { accessToken } = response.data;

        // Update token in memory
        if (window.authState) {
          window.authState.setAccessToken(accessToken);
        }

        return accessToken as string;
      })
      .catch((refreshError) => {
        // Refresh failed - logout user
        if (window.authState) {
          window.authState.handleLogout();
        }
        throw refreshError;
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });

    try {
      const newToken = await refreshPromise;
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return axios(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
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

      const { accessToken: token } = response.data;

      // Decode JWT payload to get user info (simple base64 decode)
      const payload = JSON.parse(atob(token.split('.')[1]));

      setAccessToken(token);
      setUser({
        userId: payload.userId,
        role: payload.role,
      });

      // Set default authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Store login timestamp for session expiry tracking
      localStorage.setItem('sessionStart', Date.now().toString());
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
      localStorage.removeItem('sessionStart');
    }
  };

  // Handle logout from interceptor
  const handleLogout = () => {
    setAccessToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('sessionStart');
  };

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Try to refresh token (uses HttpOnly cookie)
        const response = await axios.post(`${API_URL}/auth/refresh`);
        const { accessToken: token } = response.data;

        // Decode JWT payload to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));

        setAccessToken(token);
        setUser({
          userId: payload.userId,
          role: payload.role,
        });

        // Set default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        // No valid session - stay logged out
        console.log('No existing session found');
      }
    };

    restoreSession();
  }, []);

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

  // Session expiry warning (check every hour)
  const sessionWarningShown = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      sessionWarningShown.current = false;
      return;
    }

    const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const WARNING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day before expiry

    const checkSessionExpiry = () => {
      const sessionStart = localStorage.getItem('sessionStart');
      if (!sessionStart) return;

      const elapsed = Date.now() - parseInt(sessionStart, 10);
      const remaining = SESSION_MAX_MS - elapsed;

      if (remaining <= 0) {
        toast.warning('Sitzung abgelaufen. Bitte erneut anmelden.');
        handleLogout();
      } else if (remaining <= WARNING_THRESHOLD_MS && !sessionWarningShown.current) {
        sessionWarningShown.current = true;
        const hoursLeft = Math.round(remaining / (60 * 60 * 1000));
        toast.warning(`Sitzung läuft in ${hoursLeft}h ab. Bitte erneut anmelden.`);
      }
    };

    checkSessionExpiry();
    const interval = setInterval(checkSessionExpiry, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
