"use client";

import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { useI18n } from '@/context/LanguageContext';

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ show, onClose }) => {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      />
      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-lg z-10 w-11/12 md:w-1/2 max-h-[80vh] overflow-y-auto p-6 relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close help"
        >
          <FaTimes />
        </button>
        <h2 className="text-xl text-gray-700 font-bold mb-4">{t('help_title')}</h2>
        <div className="space-y-4 text-gray-700 text-sm">
          <p>
            {t('help_welcome')}
          </p>
          <h3 className="font-semibold">{t('help_quickstart_title')}</h3>
          <ul className="list-disc list-inside">
            <li>{t('help_quickstart_item_register_login')}</li>
            <li>{t('help_quickstart_item_create_project')}</li>
            <li>{t('help_quickstart_item_view_progress')}</li>
          </ul>
          <h3 className="font-semibold">{t('help_status_title')}</h3>
          <ul className="list-disc list-inside">
            <li><strong>Running</strong>：{t('help_status_running')}</li>
            <li><strong>Solved</strong>：{t('help_status_solved')}</li>
            <li><strong>Ended</strong>：{t('help_status_ended')}</li>
          </ul>
          <h3 className="font-semibold">{t('help_view_title')}</h3>
          <p>
            {t('help_view_text')}
          </p>
          <h3 className="font-semibold">{t('help_credits_title')}</h3>
          <p>
            {t('help_credits_text')}
          </p>
          <h3 className="font-semibold">{t('help_more_title')}</h3>
          <p>
            {t('help_more_text_prelink')}
            <a
              href="https://github.com/Carlos-Mero/AIM/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >{t('help_more_link_text')}</a>{t('help_more_text_postlink')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
