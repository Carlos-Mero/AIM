"use client";

import React, { useEffect } from 'react';
import Login from './login/page';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { token } = useAuth();
  const router = useRouter();
  // Redirect authenticated users to the home dashboard
  useEffect(() => {
    if (token) {
      router.replace('/home');
    }
  }, [token, router]);

  // If not authenticated, show login form
  if (!token) {
    return <Login />;
  }
  // while redirecting, render nothing
  return null;
}
