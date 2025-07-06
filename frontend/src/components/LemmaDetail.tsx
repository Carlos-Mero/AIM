"use client";

import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { FaCheck, FaHourglassHalf, FaTimes, FaEdit } from 'react-icons/fa';

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

interface LemmaDetailProps {
  lemma: Lemma;
}

const LemmaDetail: React.FC<LemmaDetailProps> = ({ lemma }) => {
  // 将引理的证明文本转换为标题、段落，并支持行内/块级数学公式
  const renderProofContent = () => {
    return lemma.proof.split(/\n{2,}/).map((para, idx) => {
      const trimmed = para.trim();
      // Markdown 标题
      if (/^#{1,6}\s/.test(trimmed)) {
        const m = trimmed.match(/^(#{1,6})\s*(.*)/);
        if (m) {
          const level = m[1].length;
          const text = m[2];
          if (level === 1) return <h2 key={idx} className="text-2xl font-bold mb-4">{text}</h2>;
          if (level === 2) return <h3 key={idx} className="text-xl font-semibold mb-3">{text}</h3>;
          return <h4 key={idx} className="text-lg font-semibold mb-2">{text}</h4>;
        }
      }
      // 段落内容，支持 $$..$$、\[..\] 块级和 $..$ 行内公式
      const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+\$)/g).filter(Boolean);
      // construct paragraphs & blockmath without nesting divs in <p>
      const elems: React.ReactNode[] = [];
      let buf: React.ReactNode[] = [];
      const flushBuf = () => {
        if (buf.length) {
          elems.push(
            <p key={`pf-p-${idx}-${elems.length}`} className="mb-4 text-gray-700 leading-relaxed">
              {buf.map((n, j) => <React.Fragment key={j}>{n}</React.Fragment>)}
            </p>
          );
          buf = [];
        }
      };
      tokens.forEach((tok, i) => {
        const t = tok.trim();
        if ((t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\[') && t.endsWith('\\]'))) {
          flushBuf();
          const expr = t.startsWith('$$') ? t.slice(2, -2).trim() : t.slice(2, -2).trim();
          elems.push(
            <div key={`pf-block-${idx}-${i}`} className="my-4 text-center">
              <BlockMath math={expr} />
            </div>
          );
        } else if (t.startsWith('$') && t.endsWith('$')) {
          buf.push(<InlineMath key={`pf-inline-${idx}-${i}`} math={t.slice(1, -1).trim()} />);
        } else {
          buf.push(tok);
        }
      });
      flushBuf();
      return <React.Fragment key={`pf-frag-${idx}`}>{elems}</React.Fragment>;
    });
  };

  const getStatusIcon = () => {
    switch (lemma.status) {
      case 'proved': 
        return <FaCheck className="text-green-600" />;
      case 'in_progress': 
        return <FaHourglassHalf className="text-yellow-500" />;
      case 'invalid': 
        return <FaTimes className="text-red-500" />;
      default: 
        return <FaHourglassHalf className="text-gray-400" />;
    }
  };

  const getDifficultyText = () => {
    switch (lemma.difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      default: return '困难';
    }
  };

  return (
    <div className="h-full">
      {/* 引理头部信息 */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{lemma.title}</h2>
            <div className="flex items-center space-x-6 mb-4">
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">状态:</span>
                <span className="flex items-center text-gray-600 font-medium">
                  {getStatusIcon()}
                  <span className="ml-2">
                    {lemma.status === 'proved' ? '已证明' :
                     lemma.status === 'in_progress' ? '证明中' :
                     lemma.status === 'invalid' ? '无效' : '待处理'}
                  </span>
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">难度:</span>
                <span className="font-medium text-gray-600">
                  {getDifficultyText()}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">创建人:</span>
                <span className="font-medium text-gray-600">{lemma.createdBy}</span>
              </div>
            </div>
          </div>
          
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors">
            <FaEdit className="mr-2" /> 编辑
          </button>
        </div>

        {/* 引理陈述 - 支持行内/块级公式，避免 <div> 嵌套在 <p> */}
        <div className="bg-white rounded-lg text-gray-600 p-4 shadow-inner border border-gray-200 mt-4 prose">
          <h3 className="text-lg font-semibold mb-3 text-blue-700">引理陈述:</h3>
          {lemma.statement.split(/\n{2,}/).flatMap((para, pidx) => {
            const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+\$)/g).filter(Boolean);
            let buffer: React.ReactNode[] = [];
            const elems: React.ReactNode[] = [];
            const flush = () => {
              if (buffer.length) {
                elems.push(
                  <p key={`stmt-p-${pidx}-${elems.length}`} className="mb-2">
                    {buffer.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
                  </p>
                );
                buffer = [];
              }
            };
            tokens.forEach((tok, tidx) => {
              const t = tok.trim();
              if ((t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\[') && t.endsWith('\\]'))) {
                flush();
                const expr = t.startsWith('$$')
                  ? t.slice(2, -2).trim()
                  : t.slice(2, -2).trim();
                elems.push(
                  <div key={`stmt-block-${pidx}-${tidx}`} className="my-4 text-center">
                    <BlockMath math={expr} />
                  </div>
                );
              } else if (t.startsWith('$') && t.endsWith('$')) {
                const expr = t.slice(1, -1).trim();
                buffer.push(<InlineMath key={`stmt-inline-${pidx}-${tidx}`} math={expr} />);
              } else {
                buffer.push(tok);
              }
            });
            flush();
            return elems;
          })}
        </div>
      </div>
      
      {/* 引理证明内容 */}
      <div className="p-6 max-h-[calc(100vh-30rem)] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-blue-800">证明:</h3>
        <div className="prose max-w-none text-gray-700">
          {renderProofContent()}
        </div>
      </div>
      
      {/* 底部元数据 */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
        <span>创建时间: {lemma.createdAt}</span>
        <span>最后更新: {lemma.lastUpdated}</span>
      </div>
    </div>
  );
};

export default LemmaDetail;
