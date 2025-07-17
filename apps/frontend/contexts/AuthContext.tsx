import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { User } from '../../../packages/types/src/index';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenantName: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
* AuthContext component manages user authentication state and actions
* @example
* const { user, token, loading, login, register, logout, checkAuth } = useAuthContext();
* Provides methods and state for handling authentication flow in a React app.
* @param {object} {children} - React children components to be rendered within the AuthContext provider.
* @returns {JSX.Element} A React Context Provider component that supplies authentication functions and states.
* @description
*   - The component uses React state hooks to manage authentication states like user, token, and loading.
*   - Authentication status is checked on initial component load using useEffect and checkAuth function.
*   - The login, register, and logout functions handle authentication processes such as making API calls, storing tokens, and redirecting routes.
*   - The AuthContext provider value contains all the necessary functions and states for child components to consume.
*/
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Check authentication status on app load
  useEffect(() => {
    checkAuth();
  }, []);

  /**
  * Synchronizes the user's authentication state based on the stored token.
  * @example
  * sync()
  * void
  * @param {void} None - This function does not take any arguments.
  * @returns {void} Does not return a value.
  * @description
  *   - Fetches user data using an authorization token.
  *   - Updates user and token states based on the validity of the stored token.
  *   - Handles API response errors and cleans up storage in case of invalid tokens.
  *   - Ensures loading state is set to false once the procedure completes.
  */
  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('authToken');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(storedToken);
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('authToken');
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticates user with provided email and password.
   * @example
   * sync('user@example.com', 'securepassword')
   * Navigates to dashboard on successful authentication
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   * @returns {Promise<void>} Redirects to dashboard upon successful login or throws error on failure.
   * @description
   *   - Sends a POST request to the server for authentication.
   *   - Stores the authentication token in local storage upon successful login.
   *   - Throws an error if the login attempt fails, with a descriptive message where available.
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.token && data.user) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        router.push('/dashboard');
      } else {
        throw new Error(data.error?.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  /**
  * Registers a user by sending their credentials to the authentication server.
  * @example
  * sync('user@example.com', 'password123', 'tenantName')
  * Redirects to the dashboard on successful registration.
  * @param {string} email - The user's email address for registration.
  * @param {string} password - The user's password for registration.
  * @param {string} tenantName - The name of the tenant for the user.
  * @returns {void} Throws an error if registration fails.
  * @description
  *   - The function uses the Fetch API to send registration data to the server.
  *   - Successful registration stores the auth token in local storage.
  *   - Redirects the user to the dashboard upon successful registration.
  *   - Catches and logs errors that occur during the registration process.
  */
  const register = async (email: string, password: string, tenantName: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, tenantName }),
      });

      const data = await response.json();

      if (data.success && data.token && data.user) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        router.push('/dashboard');
      } else {
        throw new Error(data.error?.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
