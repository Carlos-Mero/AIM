"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FaBook, FaSearch, FaCog, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

export default function NavBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { fullName, logout } = useAuth();
  const userName = fullName ?? '访客';

  const handleSignOut = async () => {
    // Notify backend (stateless logout)
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout API call failed', e);
    }
    // Clear client auth state
    logout();
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push('/')}>  
            <FaBook className="text-2xl" />
            <span className="text-xl font-bold">AI Mathematician</span>
          </div>
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="搜索..."
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                <FaUser />
              </div>
              <span className="hidden sm:block">{userName}</span>
            </div>
            <button
              className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
              onClick={() => console.log('Settings')}
            >
              <FaCog className="mr-1" />
              <span className="hidden md:block">设置</span>
            </button>
            <button
              className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
              onClick={handleSignOut}
            >
              <FaSignOutAlt className="mr-1" />
              <span className="hidden md:block">退出</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}