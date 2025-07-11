"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { FaPlus } from 'react-icons/fa';

interface Project {
  id: number;
  title: string;
  problem: string;
  context?: string;
  created_at: string;
  last_active: string;
  lemmas_count: number;
  status: string;
}

// Format ISO date to localized date string (e.g. "2023/10/19")
function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
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
const HomePage: React.FC = () => {
  // Get current user name from auth context
  const { fullName } = useAuth();
  const userName = fullName ?? '访客';
  // useEffect(() => {
  //   if (!token) router.push('/login');
  // }, [token]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state and data loader
  const PAGE_SIZE = 48;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Load a page of projects
  const loadProjects = async (start: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects?limit=${PAGE_SIZE}&offset=${start}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      type RawProject = Omit<Project, 'status'> & { status?: string };
      const raw = (await res.json()) as RawProject[];
      const parsed = raw.map(p => ({ ...p, status: p.status ?? 'ended' })) as Project[];
      if (start === 0) {
        setProjects(parsed);
      } else {
        setProjects(prev => [...prev, ...parsed]);
      }
      setOffset(start + parsed.length);
      setHasMore(parsed.length === PAGE_SIZE);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError(String(err) || 'Error loading projects');
    } finally {
      setLoading(false);
    }
  };
  // initial load
  useEffect(() => { loadProjects(0); }, []);


  // 过滤项目函数
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.problem.toLowerCase().includes(searchQuery.toLowerCase())
  );
  // Map status to badge styles
  const statusClass = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'solved': return 'bg-green-100 text-green-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">您好，{userName.split(' ')[0]}</h1>
            <p className="mt-2 text-gray-600">探索您的数学研究项目</p>
          </div>
          <Link href="/new-project">
            <button
              className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md flex items-center"
            >
              <FaPlus className="mr-2" /> 新建项目
            </button>
          </Link>
        </div>

        {/* 项目列表 */}
        <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">您的研究项目 ({projects.length})</h2>
        {loading && <p className="text-gray-600">加载中...</p>}
        {error && <p className="text-red-600">{error}</p>}
          
          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">没有找到匹配的项目</p>
              <button 
                onClick={() => setSearchQuery("")}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                清空搜索
              </button>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="block bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/project?projectId=${project.id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-semibold text-gray-800 truncate max-w-[60%]">{project.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${statusClass(project.status)}`}>{project.status}</span>
                    <span className="text-xs text-gray-500">{formatDate(project.created_at)}</span>
                  </div>
                </div>
                <p className="text-gray-600 mb-4 h-14 line-clamp-2">{project.problem}</p>
                <div className="flex justify-between text-sm text-gray-500">
                  <div>
                    <span className="font-medium">引理: </span>
                    <span className="text-blue-600 font-bold">{project.lemmas_count}</span>
                  </div>
                  <span>{timeAgo(project.last_active)}</span>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
                <span
                  className="text-blue-600 hover:text-blue-800 font-medium"
                  onClick={e => { e.stopPropagation(); router.push(`/project?projectId=${project.id}`); }}
                >
                  查看项目详情
                </span>
                <button
                  className="text-gray-500 hover:text-gray-700 font-medium"
                  onClick={async e => {
                    e.stopPropagation();
                    if (!window.confirm('确认要删除该项目吗？此操作不可撤销。')) return;
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/project/${project.id}`, {
                      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) setProjects(prev => prev.filter(p => p.id !== project.id));
                    else alert('删除失败');
                  }}
                >删除</button>
              </div>
            </div>
          ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => loadProjects(offset)}
                  disabled={loading}
                >加载更多</button>
              </div>
            )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
