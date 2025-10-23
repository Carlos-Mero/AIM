"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import { useI18n } from '@/context/LanguageContext';
import Link from 'next/link';
import { FaPlus, FaSync } from 'react-icons/fa';

interface Project {
  id: number;
  title: string;
  problem: string;
  context?: string;
  created_at: string;
  last_active: string;
  lemmas_count: number;
  status: string;
  // Optional creator name (admin view)
  creator?: string;
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
  const { fullName, role } = useAuth();
  const isAdmin = role?.toLowerCase() === 'admin';
  const { t } = useI18n();
  const userName = fullName ?? t('guest');
  // useEffect(() => {
  //   if (!token) router.push('/login');
  // }, [token]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Refresh button cooldown state
  const [refreshDisabled, setRefreshDisabled] = useState<boolean>(false);
  
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
      type RawProject = Omit<Project, 'status' | 'creator'> & { status?: string; creator?: string };
      const raw = (await res.json()) as RawProject[];
      const parsed = raw.map(p => ({
        ...p,
        status: p.status ?? 'ended',
        creator: p.creator,
      })) as Project[];
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
  // handler to refresh projects, cooldown 10 seconds
  const handleRefresh = () => {
    if (refreshDisabled) return;
    setRefreshDisabled(true);
    loadProjects(0);
    // re-enable after 10 seconds
    setTimeout(() => setRefreshDisabled(false), 10000);
  };


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
            <h1 className="text-3xl font-bold text-gray-800">{t('helloUser', { name: userName.split(' ')[0] })}</h1>
            <p className="mt-2 text-gray-600">{t('exploreProjects')}</p>
          </div>
          <Link href="/new-project">
            <button
              className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md flex items-center"
            >
              <FaPlus className="mr-2" /> {t('newProject')}
            </button>
          </Link>
        </div>

        {/* 项目列表 */}
        <div>
          {/* 标题与刷新按钮 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">{t('yourProjects', { count: projects.length })}</h2>
            <button
              onClick={handleRefresh}
              disabled={refreshDisabled}
              className={
                `flex items-center py-2 px-4 rounded-lg font-medium transition-opacity shadow-md ` +
                (refreshDisabled
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300')
              }
            >
              <FaSync className={loading ? 'mr-2 animate-spin' : 'mr-2'} /> {t('refresh')}
            </button>
          </div>
          {loading && <p className="text-gray-600">{t('loading')}</p>}
          {error && <p className="text-red-600">{error}</p>}
          
          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">{t('noMatch')}</p>
              <button 
                onClick={() => setSearchQuery("")}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('clearSearch')}
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
                    <span className="font-medium">{t('lemmas')}</span>
                    <span className="text-blue-600 font-bold">{project.lemmas_count}</span>
                  </div>
                  <span>{timeAgo(project.last_active)}</span>
                </div>
              </div>
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
            {isAdmin ? (
              <span className="text-gray-700 text-sm">{t('creator')}{project.creator || '---'}</span>
            ) : (
              <span
                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                onClick={e => { e.stopPropagation(); router.push(`/project?projectId=${project.id}`); }}
              >{t('viewDetails')}</span>
            )}
            <button
              className="text-gray-500 hover:text-gray-700 font-medium"
              onClick={async e => {
                e.stopPropagation();
                if (!window.confirm(t('confirmDelete'))) return;
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/project/${project.id}`, {
                  method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setProjects(prev => prev.filter(p => p.id !== project.id));
                else alert(t('deleteFailed'));
              }}
            >{t('delete')}</button>
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
                >{t('loadMore')}</button>
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
