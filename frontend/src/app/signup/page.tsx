"use client";

import React, { useState } from 'react';
import TermsModal from '../../components/TermsModal';
import { useRouter } from 'next/navigation';
import { FaUser, FaEnvelope, FaLock, FaUniversity, FaKey } from 'react-icons/fa';
import Link from 'next/link';
import { useI18n } from '@/context/LanguageContext';

const Signup: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    affiliation: '',
    specialization: '',
    invitationCode: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const resp = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        // after signup, redirect to login
        router.push('/login');
      } else {
        setError(data.message || t('signup_failed'));
      }
    } catch (err) {
      console.error(err);
      setError(t('network_error'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center">
          <h1 className="text-3xl font-bold text-white">AI Mathematician</h1>
          <p className="text-blue-200 mt-2">{t('signup_subtitle')}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('name_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="text-gray-400" />
              </div>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder={t('name_label')}
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('academic_email_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className="text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder="yourname@university.edu"
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('password_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder={t('password_placeholder_min8')}
                minLength={8}
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="affiliation" className="block text-sm font-medium text-gray-700 mb-1">
              {t('affiliation_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUniversity className="text-gray-400" />
              </div>
              <input
                id="affiliation"
                name="affiliation"
                type="text"
                value={formData.affiliation}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder={t('affiliation_placeholder')}
                required
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
              {t('math_field_label')}
            </label>
            <select
              id="specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              className={`block w-full py-3 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${formData.specialization ? 'text-gray-900' : 'text-gray-400'}`}
              required
            >
              <option value="" disabled>{t('choose_field')}</option>
              <option value="algebra">{t('field_algebra')}</option>
              <option value="analysis">{t('field_analysis')}</option>
              <option value="geometry">{t('field_geometry')}</option>
              <option value="topology">{t('field_topology')}</option>
              <option value="number-theory">{t('field_number_theory')}</option>
              <option value="applied-math">{t('field_applied_math')}</option>
              <option value="statistics">{t('field_statistics')}</option>
              <option value="other">{t('field_other')}</option>
            </select>
          </div>
          {/* 邀请码（可选） */}
          <div className="mb-6">
            <label htmlFor="invitationCode" className="block text-sm font-medium text-gray-700 mb-1">
              {t('invitation_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaKey className="text-gray-400" />
              </div>
              <input
                id="invitationCode"
                name="invitationCode"
                type="text"
                value={formData.invitationCode}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder={t('invitation_placeholder')}
              />
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center">
              <input
                id="terms"
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                required
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                {t('agree_prefix')}
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setShowTerms(true); }}
                  className="text-blue-600 hover:underline"
                >
                  {t('terms_of_service')}
                </a>
                {t('and')}
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setShowPolicy(true); }}
                  className="text-blue-600 hover:underline"
                >
                  {t('privacy_policy')}
                </a>
              </label>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md"
          >
            {t('create_account')}
          </button>
          
          <p className="mt-8 text-center text-sm text-gray-600">
            {t('have_account')}{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              {t('login_now')}
            </Link>
          </p>
        </form>
        <TermsModal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
          title={t('terms_title')}
        >
          <p>{t('terms_body')}</p>
        </TermsModal>
        <TermsModal
          isOpen={showPolicy}
          onClose={() => setShowPolicy(false)}
          title={t('privacy_title')}
        >
          <p>{t('privacy_body')}</p>
        </TermsModal>
      </div>
    </div>
  );
};

export default Signup;
