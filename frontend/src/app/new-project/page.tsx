"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

export default function NewProjectPage() {
  const router = useRouter();
  const [problem, setProblem] = useState<string>('');
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
  const [streaming, setStreaming] = useState<boolean>(true);
  const [theoremGraph, setTheoremGraph] = useState<boolean>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, just log the config and navigate back
    const config = {
      problem,
      context,
      proofModel,
      evalModel,
      reformModel,
      steps,
      reviews,
      iterations,
      reformat,
      streaming,
      theoremGraph,
    };
    console.log('New project config:', config);
    // TODO: send to server or initialize project directory
    router.push('/');
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
              <div>
                <label htmlFor="problem" className="block text-xl font-bold text-gray-900 mb-2">
                  问题 (Problem)
                </label>
                <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              required
              rows={6}
                  id="problem"
                  className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="在此输入问题的准确陈述，支持 Markdown、LaTeX"
            />
              </div>
          <div>
            <label htmlFor="context" className="block text-xl font-bold text-gray-900 mb-2">
              背景与符号定义 (Context)
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              required
              rows={6}
              className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="在此输入所有背景信息与符号定义，支持 Markdown、LaTeX"
            />
          </div>
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
                  <label className="block text-sm">Proof Model</label>
                  <input
                    value={proofModel}
                    onChange={e => setProofModel(e.target.value)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="block text-sm">Eval Model</label>
                  <input
                    value={evalModel}
                    onChange={e => setEvalModel(e.target.value)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="block text-sm">Reform Model</label>
                  <input
                    value={reformModel}
                    onChange={e => setReformModel(e.target.value)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="block text-sm">Steps (1–40)</label>
                  <input
                    type="number"
                    value={steps}
                    min={1} max={40}
                    onChange={e => setSteps(+e.target.value)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reviews (1–6)</label>
                  <input
                    type="number"
                    value={reviews}
                    min={1} max={6}
                    onChange={e => setReviews(+e.target.value)}
                    className="w-full border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm">Iterations (1–10)</label>
                  <input
                    type="number"
                    value={iterations}
                    min={1} max={10}
                    onChange={e => setIterations(+e.target.value)}
                    className="w-full border rounded p-1"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={reformat} onChange={e => setReformat(e.target.checked)} />
                  <span className="text-sm">Reformat conjectures</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={streaming} onChange={e => setStreaming(e.target.checked)} />
                  <span className="text-sm">Streaming output</span>
                </label>
                <label className="flex items-center space-x-2">
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
