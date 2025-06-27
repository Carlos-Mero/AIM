"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUser, FaLock, FaGoogle, FaGithub } from 'react-icons/fa';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const Login: React.FC = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.token) {
        login(data.token);
        router.push('/');
      } else {
        setError(data.message || '登录失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center">
          <h1 className="text-3xl font-bold text-white">AI Mathematician</h1>
          <p className="text-blue-200 mt-2">登录您的数学家助手账户</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder="yourname@university.edu"
                required
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
        <div className="mb-6 text-right">
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
            忘记密码?
          </a>
        </div>
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md"
          >
            登录
          </button>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或使用其他方式登录</span>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FaGoogle className="text-red-500 mr-2" />
                Google
              </button>
              <button
                type="button"
                className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FaGithub className="text-gray-800 mr-2" />
                GitHub
              </button>
            </div>
          </div>
          
          <p className="mt-8 text-center text-sm text-gray-600">
            还没有账户?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
