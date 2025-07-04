"use client";

import React, { useState } from 'react';
import TermsModal from '../../components/TermsModal';
import { useRouter } from 'next/navigation';
import { FaUser, FaEnvelope, FaLock, FaUniversity, FaKey } from 'react-icons/fa';
import Link from 'next/link';

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
        setError(data.message || '注册失败');
      }
    } catch (err) {
      console.error(err);
      setError('网络错误，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center">
          <h1 className="text-3xl font-bold text-white">AI Mathematician</h1>
          <p className="text-blue-200 mt-2">创建您的数学家助手账户</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              姓名
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
                placeholder="全名"
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              学术邮箱
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
              密码
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
                placeholder="至少8个字符"
                minLength={8}
                required
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="affiliation" className="block text-sm font-medium text-gray-700 mb-1">
              所属机构
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
                placeholder="大学或研究机构"
                required
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
              数学领域
            </label>
            <select
              id="specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              className={`block w-full py-3 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${formData.specialization ? 'text-gray-900' : 'text-gray-400'}`}
              required
            >
              <option value="" disabled>请选择您的研究领域</option>
              <option value="algebra">代数</option>
              <option value="analysis">分析</option>
              <option value="geometry">几何</option>
              <option value="topology">拓扑学</option>
              <option value="number-theory">数论</option>
              <option value="applied-math">应用数学</option>
              <option value="statistics">统计学</option>
              <option value="other">其他</option>
            </select>
          </div>
          {/* 邀请码（可选） */}
          <div className="mb-6">
            <label htmlFor="invitationCode" className="block text-sm font-medium text-gray-700 mb-1">
              邀请码 (Invitation Code, 可选)
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
                placeholder="如果有，请输入邀请码"
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
                我同意 AI Mathematician 的 
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setShowTerms(true); }}
                  className="text-blue-600 hover:underline"
                >
                  服务条款
                </a>
                {' '}和{' '}
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setShowPolicy(true); }}
                  className="text-blue-600 hover:underline"
                >
                  隐私政策
                </a>
              </label>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md"
          >
            创建账户
          </button>
          
          <p className="mt-8 text-center text-sm text-gray-600">
            已有账户?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              立即登录
            </Link>
          </p>
        </form>
        <TermsModal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
          title="服务条款"
        >
          <p>此处填写服务条款内容。</p>
        </TermsModal>
        <TermsModal
          isOpen={showPolicy}
          onClose={() => setShowPolicy(false)}
          title="隐私政策"
        >
          <p>此处填写隐私政策内容。</p>
        </TermsModal>
      </div>
    </div>
  );
};

export default Signup;
