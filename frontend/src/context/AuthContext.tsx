"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  token: string | null;
  fullName: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) {
      setToken(t);
      // fetch user info
      fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.full_name) {
            setFullName(data.full_name);
          }
        });
    }
  }, []);

  const login = async (t: string) => {
    localStorage.setItem('token', t);
    setToken(t);
    // fetch user info
    try {
      const res = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${t}` } });
      const data = await res.json();
      if (data.success && data.full_name) {
        setFullName(data.full_name);
      }
    } catch {}
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setFullName(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, fullName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}