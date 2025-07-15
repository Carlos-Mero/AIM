"use client";

import React from 'react';
import { FaCopy } from 'react-icons/fa';

interface CopyableBlockProps {
  /** Raw text to copy to clipboard */
  text: string;
  /** Visible content (rendered markdown) */
  children: React.ReactNode;
}

import { useState } from 'react';
const CopyableBlock: React.FC<CopyableBlockProps> = ({ text, children }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };
  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className={
          `absolute top-0 right-0 m-2 flex items-center space-x-1 bg-gray-100 bg-opacity-75 hover:bg-opacity-100 text-gray-700` +
          ` p-2 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200`
        }
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {copied ? (
          <span className="text-sm font-medium">Copied!</span>
        ) : (
          <>
            <FaCopy className="text-sm" />
            <span className="text-sm font-medium">Copy</span>
          </>
        )}
      </button>
      {children}
    </div>
  );
};

export default CopyableBlock;
