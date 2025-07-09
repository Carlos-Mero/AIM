"use client";

import React, { useState, useEffect } from 'react';
import { Suspense } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import NavBar from '@/components/NavBar';
import { FaSearch, FaInfoCircle } from 'react-icons/fa';
import LemmaList from '@/components/LemmaList';
import LemmaDetail from '@/components/LemmaDetail';
import Lemma from '@/interfaces/Lemma';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
// base URL of backend API (set via NEXT_PUBLIC_API_BASE_URL in .env.local)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
// Format ISO date to localized date string (e.g. "2023/10/19")
// Format ISO date to date-only (e.g. "2023/10/19")
function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}
// Format ISO date to date+time string (e.g. "2023/10/19, 14:23:05")
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
// Compute relative "time ago" for ISO timestamp
function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return iso;
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return formatDate(iso);
}
// Map project status to badge styles
function statusClass(status: string) {
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-800';
    case 'solved': return 'bg-green-100 text-green-800';
    case 'ended': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

interface Project {
  id: number;
  title: string;
  problem: string;
  context?: string;
  created_at: string;
  last_active: string;
  status: string;
  memory: Array<{
    memtype: string;
    content: string;
    proof: string;
    solved: boolean;
    created_at: string;
    updated_at: string;
    reviews: number;
    comment: string;
    deps: number[];
  }>;
}

const ProjectDetailContent: React.FC = () => {
  // read projectId from query string
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { token } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<Lemma | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [lemmas, setLemmas] = useState<Lemma[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // fetch and auto-reload project detail (initial load + interval)
  useEffect(() => {
    if (!token || !projectId) return;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/project/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
        const data: Project = await res.json();
        setProject(data);
        // map memory to lemmas
        const mapped = data.memory.map((m, idx) => ({
          id: idx,
          title: `${m.memtype}-${idx}`,
          statement: m.content,
          proof: m.proof,
          status: m.solved ? 'proved' : 'pending',
          createdAt: formatDateTime(m.created_at),
          lastUpdated: formatDateTime(m.updated_at),
          reviews: m.reviews,
          comment: m.comment,
          deps: m.deps,
        } as Lemma));
        setLemmas(mapped);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
    const timer = setInterval(loadDetail, 30000);
    return () => clearInterval(timer);
  }, [projectId, token]);
  // 渲染项目描述，支持行内/块级公式
  const renderDescription = (text: string) => {
    return text.split(/\n{2,}/).flatMap((para, pidx) => {
      const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g).filter(Boolean);
      let buf: React.ReactNode[] = [];
      const elems: React.ReactNode[] = [];
      const flush = () => {
        if (buf.length) {
          elems.push(
            <p key={`desc-p-${pidx}-${elems.length}`} className="mb-2">
              {buf.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
            </p>
          );
          buf = [];
        }
      };
      tokens.forEach((tok, tidx) => {
        const t = tok.trim();
        if ((t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\[') && t.endsWith('\\]'))) {
          flush();
          const expr = t.slice(2, -2).trim();
          elems.push(
            <div key={`desc-block-${pidx}-${tidx}`} className="my-4 text-center">
              <BlockMath math={expr} />
            </div>
          );
        } else if (t.startsWith('\\(') && t.endsWith('\\)')) {
          const expr = t.slice(2, -2).trim();
          buf.push(<InlineMath key={`desc-inline-${pidx}-${tidx}`} math={expr} />);
        } else if (t.startsWith('$') && t.endsWith('$')) {
          const expr = t.slice(1, -1).trim();
          buf.push(<InlineMath key={`desc-inline-${pidx}-${tidx}`} math={expr} />);
        } else {
          buf.push(tok);
        }
      });
      flush();
      return elems;
    });
  };


  const filteredLemmas = lemmas.filter(l => (l.title.includes(filter) || l.statement.includes(filter)) && !l.title.includes("context"));
  if (!token) return <p className="text-center mt-8">请先登录</p>;
  if (loading || !project) return <p className="text-center mt-8">加载中...</p>;
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NavBar />
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* 项目信息 */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{project.title}</h1>
          <div className="mt-2 text-gray-600 prose">
            {renderDescription(project.problem)}
          </div>
          {project.context && (
            <div className="mt-4 p-4 bg-gray-50 border-l-4 border-blue-500">
              <h3 className="font-semibold mb-2">Context</h3>
              <div className="text-gray-700 prose">
                {renderDescription(project.context)}
              </div>
            </div>
          )}
        <div className="mt-3 flex items-center space-x-4">
          <div className="text-sm text-gray-500 flex items-center">
            <FaInfoCircle className="mr-1" />
            <span>创建于 {formatDate(project.created_at)} · 最后活跃 {timeAgo(project.last_active)}</span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${statusClass(project.status)}`}>{project.status}</span>
        </div>
        </div>
          {/* 主体区域：列表 & 详情 */}
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* 左侧：列表区 */}
            <div className="flex flex-col lg:w-1/3 bg-white rounded-2xl shadow lg:sticky lg:top-4 lg:h-[calc(100vh-10rem)]">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">引理列表 ({filteredLemmas.length})</h2>
            {/* Lemma creation/edit buttons are not required; removed */}
              </div>
              <div className="px-6 py-3 border-b">
                <div className="relative">
                  <input
                    type="text"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 text-gray-900 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="搜索引理..."
                  />
                  <FaSearch className="absolute top-1/2 transform -translate-y-1/2 left-3 text-gray-400" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <LemmaList
                  lemmas={filteredLemmas}
                  selectedLemma={selectedLemma}
                  onSelectLemma={setSelectedLemma}
                />
              </div>
            </div>
            {/* 右侧：详情区 */}
            <div className="flex-1 bg-white rounded-2xl shadow flex flex-col">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">引理详情</h2>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                {selectedLemma ? (
                  <LemmaDetail lemma={selectedLemma} />
                ) : (
                    <div className="h-full flex items-center justify-center p-12 text-center">
                      <div className="max-w-md">
                        <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                          <FaInfoCircle className="text-blue-600 text-2xl" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">选择引理查看详情</h3>
                        <p className="text-gray-600">
                          请从左侧列表中选择一个引理以查看其详细表述、证明及相关信息
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </main>
      </div>
  );
};

const ProjectLoadingFallback = () => (
  <div className="flex flex-col min-h-screen bg-gray-50">
    <NavBar />
    <main className="flex-1 container mx-auto px-4 py-6">
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>加载项目数据中，请稍候...</p>
      </div>
    </main>
  </div>
);

const ProjectDetailPage = () => {
  return (
    <Suspense fallback={<ProjectLoadingFallback />}>
      <ProjectDetailContent />
    </Suspense>
  );
};

export default ProjectDetailPage;
