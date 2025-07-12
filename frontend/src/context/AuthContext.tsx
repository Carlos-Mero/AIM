"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  token: string | null;
  fullName: string | null;
  role: string | null;
  credits: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  // Refresh user info (reload tokens, fullName, role, credits)
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [credits, setCredits] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) {
      setToken(t);
      // fetch user info including role & credits
      fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFullName(data.full_name ?? null);
            setRole(data.role ?? null);
            setCredits(data.credits ?? null);
          }
        });
    }
  }, []);

  const refresh = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setFullName(data.full_name ?? null);
        setRole(data.role ?? null);
        setCredits(data.credits ?? null);
      }
    } catch (err) {
      console.warn('Failed to refresh user info', err);
    }
  };
  const login = async (t: string) => {
    localStorage.setItem('token', t);
    setToken(t);
    // fetch user info
    try {
      const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${t}` } });
      const data = await res.json();
      if (data.success) {
        setFullName(data.full_name ?? null);
        setRole(data.role ?? null);
        setCredits(data.credits ?? null);
      }
    } catch (err) {
      console.warn('Failed to fetch user info after login', err);
    }
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setFullName(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, fullName, role, credits, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
