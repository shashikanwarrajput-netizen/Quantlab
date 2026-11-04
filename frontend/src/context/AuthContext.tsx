/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import type { User, AuthState } from '../types';

interface RegisteredUserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
}

const REGISTRY_STORAGE_KEY = 'quantlab_registered_users';

function getRegisteredUsers(): RegisteredUserAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRegisteredUser(account: RegisteredUserAccount): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRegisteredUsers();
    const updated = [...existing.filter(u => u.email.toLowerCase() !== account.email.toLowerCase()), account];
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save registered user', err);
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') {
      return { user: null, isAuthenticated: false, isLoading: false, error: null };
    }
    try {
      const storedUser = localStorage.getItem('quantlab_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return {
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      }
    } catch {
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to load user',
      };
    }
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
  });

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error('Email and password are required');
      }

      const registered = getRegisteredUsers();
      const existingAccount = registered.find(u => u.email.toLowerCase() === cleanEmail);

      let user: User;
      if (existingAccount) {
        if (existingAccount.password && existingAccount.password !== password) {
          throw new Error('Invalid email or password');
        }
        user = {
          id: existingAccount.id,
          name: existingAccount.name,
          email: existingAccount.email,
          createdAt: new Date(existingAccount.createdAt),
        };
      } else {
        // Direct mock login fallback: create a dedicated persistent profile for this email
        user = {
          id: 'usr_' + Math.random().toString(36).substring(2, 10),
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          createdAt: new Date(),
        };
        saveRegisteredUser({
          id: user.id,
          name: user.name,
          email: user.email,
          password,
          createdAt: user.createdAt.toISOString(),
        });
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('quantlab_user', JSON.stringify(user));
        sessionStorage.removeItem('quantlab_ai_chat_history');
        window.dispatchEvent(new CustomEvent('quantlab-auth-changed', { detail: user }));
        window.dispatchEvent(new CustomEvent('quantlab-analytics-updated', { detail: null }));
      }

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      if (!cleanName || !cleanEmail || !password) {
        throw new Error('All fields are required');
      }
      
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const existingUsers = getRegisteredUsers();
      if (existingUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
        throw new Error('An account with this email already exists. Please log in.');
      }
      
      const user: User = {
        id: 'usr_' + Math.random().toString(36).substring(2, 10),
        name: cleanName,
        email: cleanEmail,
        createdAt: new Date(),
      };

      saveRegisteredUser({
        id: user.id,
        name: user.name,
        email: user.email,
        password,
        createdAt: user.createdAt.toISOString(),
      });
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('quantlab_user', JSON.stringify(user));
        sessionStorage.removeItem('quantlab_ai_chat_history');
        window.dispatchEvent(new CustomEvent('quantlab-auth-changed', { detail: user }));
        window.dispatchEvent(new CustomEvent('quantlab-analytics-updated', { detail: null }));
      }

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quantlab_user');
      sessionStorage.removeItem('quantlab_ai_chat_history');
      window.dispatchEvent(new CustomEvent('quantlab-auth-changed', { detail: null }));
      window.dispatchEvent(new CustomEvent('quantlab-analytics-updated', { detail: null }));
    }
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
