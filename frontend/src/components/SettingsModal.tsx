"use client";

import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose }) => {
  const { token, refresh } = useAuth();
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const handleSave = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me/invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invitation_code: invitationCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refresh();
        onClose();
      } else {
        setError(data.message || 'Failed to update');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-lg z-10 w-11/12 md:w-1/3 p-6 relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close settings"
        >
          <FaTimes />
        </button>
        <h2 className="text-xl text-gray-700 font-bold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="invitation" className="block text-sm font-medium text-gray-700">
              Invitation Code
            </label>
            <input
              id="invitation"
              type="text"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-gray-900 bg-white placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="flex justify-end space-x-2">
            <button
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
