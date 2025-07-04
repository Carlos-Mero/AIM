"use client";
import React from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-full overflow-y-auto p-6 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 text-gray-800">
          {children}
        </div>
      </div>
    </div>
  );
};

export default TermsModal;