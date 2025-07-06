"use client";
import React, { useState, useEffect } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { FaList } from 'react-icons/fa';
import LemmaList from '@/components/LemmaList';
import LemmaDetail from '@/components/LemmaDetail';
import { useAuth } from '@/context/AuthContext';
// Base URL for API calls, set via NEXT_PUBLIC_API_BASE_URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface Project {
  id: string;
  title: string;
  description: string;
  context?: string;
  createdAt: string;
  lastActive: string;
}

interface Lemma {
  id: string;
  title: string;
  statement: string;
  proof: string;
  status: 'pending' | 'in_progress' | 'proved' | 'invalid';
  difficulty: 'easy' | 'medium' | 'hard';
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
}

interface Props {
  projectId: string;
}

const ProjectDetailClient: React.FC<Props> = ({ projectId }) => {
  const [selectedLemma, setSelectedLemma] = useState<Lemma | null>(null);
  const [filter, setFilter] = useState<string>('');

  const { token } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/project/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setProject({
            id: data.id.toString(),
            title: data.title,
            description: data.problem,
            context: data.context || undefined,
            createdAt: data.created_at,
            lastActive: data.last_active,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, token]);

  // render markdown-like text with inline/block math
  const renderDescription = (text: string) => {
    return text.split(/\n{2,}/).flatMap((para, pidx) => {
      const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+\$)/g).filter(Boolean);
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

  const lemmas: Lemma[] = [
    {
      id: "lemma-1",
      title: "双曲空间上的Zeta函数",
      statement: "设 $M$ 是$n$维双曲空间，则其上的Zeta函数 $\\zeta_M(s)$ 在 $\\Re(s) > n/2$ 时绝对收敛",
      proof: "### 证明\n使用非交换几何分析方法，考虑双曲空间的谱几何性质。设 $\\Delta$ 为Laplace算子...\n+\n+\\[\n+\\operatorname{Tr}(e^{-t\\Delta}) \\sim (4\\pi t)^{-n/2} \\sum_{k=0}^{\\infty} a_k t^k\\quad(t \\to 0^+)\n+\\]\n+\n+由热核渐近展开可得...",
      status: "proved",
      difficulty: "hard",
      createdBy: "系统生成",
      createdAt: "2023-10-16",
      lastUpdated: "2023-10-20",
    },
    // ... other lemmas
  ];

  const handleCreateLemma = () => {
    const newLemma: Lemma = {
      id: `lemma-${lemmas.length + 1}`,
      title: "新引理",
      statement: "在此处添加引理陈述...",
      proof: "### 证明\n在此处撰写证明...",
      status: "pending",
      difficulty: "medium",
      createdBy: "用户创建",
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    setSelectedLemma(newLemma);
  };

  const filteredLemmas = lemmas.filter(l => l.title.includes(filter) || l.statement.includes(filter));

  if (!token) return <p className="text-center mt-8">请先登录</p>;
  if (loading || !project) return <p className="text-center mt-8">加载中...</p>;
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header placeholder or logo/nav */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{project!.title}</h1>
          <div className="mt-2 text-gray-600 prose">{renderDescription(project!.description)}</div>
        </div>
        <div className="flex">
          <div className="w-1/3 pr-4">
            <div className="mb-4 flex items-center">
              <FaList className="mr-2" />
              <h2 className="text-lg font-semibold">引理列表</h2>
            </div>
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="搜索引理"
              className="w-full border rounded p-2 mb-4"
            />
            <button
              onClick={handleCreateLemma}
              className="mb-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              新建引理
            </button>
            <LemmaList
              lemmas={filteredLemmas}
              selectedLemma={selectedLemma}
              onSelectLemma={setSelectedLemma}
            />
          </div>
          <div className="w-2/3 pl-4">
            {selectedLemma ? (
              <LemmaDetail lemma={selectedLemma} />
            ) : (
              <p className="text-gray-500">请选择一个引理以查看详情</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectDetailClient;
