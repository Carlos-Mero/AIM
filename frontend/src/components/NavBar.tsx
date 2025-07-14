"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FaBook, FaCog, FaSignOutAlt, FaUser, FaQuestionCircle } from 'react-icons/fa';
import SettingsModal from './SettingsModal';
import HelpModal from './HelpModal';
import { useRouter } from 'next/navigation';

export default function NavBar() {
  const router = useRouter();
  const { fullName, role, credits, logout } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                <FaUser className="text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{userName}</div>
                <div className="flex space-x-2 mt-1">
                  {role && <span className="text-xs uppercase border border-white text-white px-2 py-0.5 rounded">{role}</span>}
                  {credits && <span className="text-xs border border-white text-white px-2 py-0.5 rounded">{credits}</span>}
                </div>
              </div>
            </div>
            <button
              className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
              onClick={() => setShowSettings(true)}
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
            <button
              className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
              onClick={() => setShowHelp(true)}
            >
              <FaQuestionCircle className="mr-1" />
              <span className="hidden md:block">帮助</span>
            </button>
          </div>
          <HelpModal show={showHelp} onClose={() => setShowHelp(false)} />
          <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
        </div>
      </div>
    </nav>
  );
}
