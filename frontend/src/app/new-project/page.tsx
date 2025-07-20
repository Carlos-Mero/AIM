"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';

export default function NewProjectPage() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [title, setTitle] = useState<string>('');
  const [problem, setProblem] = useState<string>('');
  // Mode: 'standard' requires both problem and context; 'deer-flow' sends empty context
  const [mode, setMode] = useState<'standard' | 'deer-flow'>('deer-flow');
  const [context, setContext] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  // Advanced parameters matching ResearchSessionConfig
  const [proofModel, setProofModel] = useState<string>('o4-mini');
  const [evalModel, setEvalModel] = useState<string>('o4-mini');
  const [reformModel, setReformModel] = useState<string>('o4-mini');
  const [steps, setSteps] = useState<number>(24);
  const [reviews, setReviews] = useState<number>(3);
  const [iterations, setIterations] = useState<number>(4);
  const [reformat, setReformat] = useState<boolean>(true);
  const [theoremGraph, setTheoremGraph] = useState<boolean>(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // send empty context in 'deer-flow' mode
    const contextToSend = mode === 'standard' ? context : '';
    const config = {
      title,
      problem,
      context: contextToSend,
      proofModel,
      evalModel,
      reformModel,
      steps,
      reviews,
      iterations,
      reformat,
      theoremGraph,
    };
    try {
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/project', {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // submission succeeded: refresh user info (credits/role)
      await refresh();
      // then navigate home
      router.push('/');
    } catch (err: unknown) {
      console.error('Failed to submit project:', err);
      // show a pop-up alert on failure
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`创建项目失败：${msg}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavBar />
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <header className="bg-blue-600 text-white px-6 py-2">
            <h1 className="text-lg font-medium">创建新研究项目</h1>
          </header>
          <div className="px-8 py-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mode switch: standard vs deer-flow */}
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-700">Mode:</span>
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`px-3 py-1 rounded ${
                  mode === 'standard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setMode('deer-flow')}
                className={`px-3 py-1 rounded ${
                  mode === 'deer-flow'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Deer-Flow
              </button>
            </div>
          <div>
            <label htmlFor="title" className="block text-xl font-bold text-gray-900 mb-2">
              标题 (Title)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入研究项目的标题"
            />
          </div>
          <div>
            <label htmlFor="problem" className="block text-xl font-bold text-gray-900 mb-2">
              问题 (Problem)
            </label>
            <textarea
              id="problem"
              value={problem}
              onChange={e => setProblem(e.target.value)}
              required
              rows={6}
              className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="在此输入问题的准确陈述，支持 Markdown、LaTeX"
            />
          </div>
          {/* Context input only in standard mode */}
          {mode === 'standard' && (
            <div>
              <label htmlFor="context" className="block text-xl font-bold text-gray-900 mb-2">
                背景与符号定义 (Context)
              </label>
              <textarea
                id="context"
                value={context}
                onChange={e => setContext(e.target.value)}
                required
                rows={6}
                className="w-full border border-gray-300 rounded-md p-2 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="在此输入所有背景信息与符号定义，支持 Markdown、LaTeX"
              />
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              className="text-blue-600 hover:underline"
            >
              {showAdvanced ? '隐藏高级配置' : '显示高级配置'}
            </button>
          </div>
          {showAdvanced && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700">Proof Model</label>
                  <input
                    value={proofModel}
                    onChange={e => setProofModel(e.target.value)}
                    className="w-full border rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Eval Model</label>
                  <input
                    value={evalModel}
                    onChange={e => setEvalModel(e.target.value)}
                    className="w-full border rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Reform Model</label>
                  <input
                    value={reformModel}
                    onChange={e => setReformModel(e.target.value)}
                    className="w-full border rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Steps (1–40)</label>
                  <input
                    type="number"
                    value={steps}
                    min={1} max={40}
                    onChange={e => setSteps(+e.target.value)}
                    className="w-full border rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Reviews (1–6)</label>
                  <input
                    type="number"
                    value={reviews}
                    min={1} max={6}
                    onChange={e => setReviews(+e.target.value)}
                    className="w-full border border-gray-300 rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Iterations (1–10)</label>
                  <input
                    type="number"
                    value={iterations}
                    min={1} max={10}
                    onChange={e => setIterations(+e.target.value)}
                    className="w-full border rounded p-1 bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center text-gray-700 space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={reformat} onChange={e => setReformat(e.target.checked)} />
                  <span className="text-sm">Reformat conjectures</span>
                </label>
                <label className="flex items-center text-gray-700 space-x-2">
                  <input type="checkbox" checked={theoremGraph} onChange={e => setTheoremGraph(e.target.checked)} />
                  <span className="text-sm">Theorem graph mode</span>
                </label>
              </div>
            </div>
          )}
              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-lg font-medium hover:opacity-90 transition"
                >创建项目</button>
              </div>
        </form>
          </div>
        </div>
      </main>
    </div>
  );
}
