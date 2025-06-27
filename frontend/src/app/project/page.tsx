"use client";

import React, { useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { FaList, FaPlus, FaSearch, FaInfoCircle } from 'react-icons/fa';
import LemmaList from '@/components/LemmaList';
import LemmaDetail from '@/components/LemmaDetail';
import { useParams } from 'next/navigation';

interface Project {
  id: string;
  title: string;
  description: string;
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

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams();

  // 当前选择的引理
  const [selectedLemma, setSelectedLemma] = useState<Lemma | null>(null);
  // 搜索关键词
  const [filter, setFilter] = useState<string>('');

  // 模拟项目数据（包含数学公式）
  const project: Project = {
    id: projectId as string,
    title: "黎曼猜想的几何解析",
    description: `探索黎曼Zeta函数 $\\zeta(s)$ 的几何意义及其与双曲几何的联系。

例如，当 $M$ 是 n 维双曲空间时，研究 $$\\zeta_M(s) = \\sum_{\gamma} e^{-s \\ell(\\gamma)}$$ 在 $\\Re(s) > n/2$ 上的性质。`,
    createdAt: "2023-10-15",
    lastActive: "5小时前"
  };
  // 渲染项目描述，支持行内/块级公式
  const renderDescription = () => {
    return project.description.split(/\n{2,}/).flatMap((para, pidx) => {
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

  // 模拟引理数据
  const lemmas: Lemma[] = [
    {
      id: "lemma-1",
      title: "双曲空间上的Zeta函数",
      statement: "设 $M$ 是$n$维双曲空间，则其上的Zeta函数 $\\zeta_M(s)$ 在 $\\Re(s) > n/2$ 时绝对收敛",
      proof: "### 证明\n使用非交换几何分析方法，考虑双曲空间的谱几何性质。设 $\\Delta$ 为Laplace算子...\n\n\\[\n\\operatorname{Tr}(e^{-t\\Delta}) \\sim (4\\pi t)^{-n/2} \\sum_{k=0}^{\\infty} a_k t^k\\quad(t \\to 0^+)\n\\]\n\n由热核渐近展开可得...",
      status: "proved",
      difficulty: "hard",
      createdBy: "系统生成",
      createdAt: "2023-10-16",
      lastUpdated: "2023-10-20"
    },
    {
      id: "lemma-2",
      title: "奇点解的解析延拓",
      statement: "若 $f(z)$ 在 $|z|<R$ 内亚纯，且在 $z=0$ 有极点，则可将 $\\zeta(s) = \\sum f(n)n^{-s}$ 解析延拓至整个复平面",
      proof: "### 证明\n考虑Mellin变换：\n\n\\[\n\\zeta(s) = \\frac{1}{\\Gamma(s)} \\int_0^\\infty x^{s-1}\\sum_{n=1}^\\infty f(n)e^{-nx} dx\n\\]\n\n利用 $f(n)$ 的亚纯性质，可证明...",
      status: "in_progress",
      difficulty: "medium",
      createdBy: "系统生成",
      createdAt: "2023-10-18",
      lastUpdated: "2023-10-22"
    },
    {
      id: "lemma-3",
      title: "谱对称性的充分条件",
      statement: "若流形的谱具有对称性 $\\lambda_i + \\lambda_j = \\lambda_k$ 对某些特定指标成立，则其几何结构必须对称",
      proof: "### 证明\n假设 $M$ 是紧致连通黎曼流形，$\\Delta f_i = \\lambda_i f_i$。考虑关联图 \n\n\\[\nG = \\{(i,j,k) : \\lambda_i + \\lambda_j = \\lambda_k\\}\n\\]\n\n由热核估计可证当$|G| > N$时...",
      status: "pending",
      difficulty: "medium",
      createdBy: "系统生成",
      createdAt: "2023-10-20",
      lastUpdated: "2023-10-20"
    },
    {
      id: "lemma-4",
      title: "Selberg迹公式的几何阐释",
      statement: "对于有限体积双曲曲面，Selberg迹公式可解释为几何上的闭测地线计数",
      proof: "### 证明\n设 $\\Gamma \\backslash \\mathbb{H}$ 为亏格$g$的紧双曲曲面。Selberg迹公式表述为：\n\n\\[\n\\sum_{n=0}^{\\infty} h(r_n) = \\frac{\\mu(F)}{4\\pi} \\int_{-\\infty}^{\\infty} r h(r) \\tanh(\\pi r) dr + \\sum_{\\{T\\}} \\frac{\\log N(T_0)}{N(T)^{1/2} - N(T)^{-1/2}} g(\\log N(T))\n\\]\n\n左边是Laplace算子谱的贡献...",
      status: "proved",
      difficulty: "hard",
      createdBy: "系统生成",
      createdAt: "2023-10-22",
      lastUpdated: "2023-10-25"
    },
  ];

  // 创建新引理（模拟）
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
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setSelectedLemma(newLemma);
  };

  const filteredLemmas = lemmas.filter(l =>
    l.title.includes(filter) || l.statement.includes(filter)
  );
  return (
    <>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* 顶部导航栏 */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center">
                  <FaList />
                </div>
                <span className="text-xl font-bold">AI Mathematician</span>
              </div>

              <div className="flex-1 max-w-xl mx-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="搜索引理..."
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  帮助
                </button>
                <button className="text-blue-200 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  退出
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6">
          {/* 项目信息 */}
          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{project.title}</h1>
          <div className="mt-2 text-gray-600 prose">
            {renderDescription()}
          </div>
            <div className="mt-3 text-sm text-gray-500 flex items-center">
              <FaInfoCircle className="mr-1" />
              <span>创建于 {project.createdAt} · 最后活跃 {project.lastActive}</span>
            </div>
          </div>
          {/* 主体区域：列表 & 详情 */}
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* 左侧：列表区 */}
            <div className="flex flex-col lg:w-1/3 bg-white rounded-2xl shadow">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">引理列表 ({filteredLemmas.length})</h2>
                <button
                  onClick={handleCreateLemma}
                  className="text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <FaPlus className="mr-1" /> 新建
                </button>
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
    </>
  );
};

export default ProjectDetailPage;
