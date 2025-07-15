"use client";

import React from 'react';
import Lemma from '@/interfaces/Lemma';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { FaCheck, FaHourglassHalf, FaTimes } from 'react-icons/fa';
import CopyableBlock from './CopyableBlock';

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
      const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g).filter(Boolean);
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
        } else if (t.startsWith('\\(') && t.endsWith('\\)')) {
          buf.push(<InlineMath key={`pf-inline-paren-${idx}-${i}`} math={t.slice(2, -2).trim()} />);
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

  // importance derived from reviews or if title contains 'theorem'
  const isTheorem = () => lemma.title.toLowerCase().includes('theorem');
  // 次要 (<12), 重要 (12–23), 关键 (>=24 or theorem)
  const getImportanceText = () => {
    if (isTheorem() || lemma.reviews >= 24) return '关键';
    if (lemma.reviews >= 12) return '重要';
    return '次要';
  };
  const getImportanceColor = () => {
    if (isTheorem() || lemma.reviews >= 24) return 'text-red-600 bg-red-100';
    if (lemma.reviews >= 12) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  // render comment content with KaTeX support
  const renderCommentContent = () => {
    return lemma.comment.split(/\n{2,}/).flatMap((para, pidx) => {
      const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g).filter(Boolean);
      let buffer: React.ReactNode[] = [];
      const elems: React.ReactNode[] = [];
      const flush = () => {
        if (buffer.length) {
          elems.push(
            <p key={`cmt-p-${pidx}-${elems.length}`} className="mb-2 text-gray-700">
              {buffer.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
            </p>
          ); buffer = [];
        }
      };
      tokens.forEach((tok, tidx) => {
        const t = tok.trim();
        if ((t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\[') && t.endsWith('\\]'))) {
          flush(); const expr = t.slice(t.startsWith('$$') ? 2 : 2, - (t.endsWith('$$') ? 2 : 2)).trim();
          elems.push(
            <div key={`cmt-block-${pidx}-${tidx}`} className="my-2 text-center">
              <BlockMath math={expr} />
            </div>
          );
        } else if (t.startsWith('\\(') && t.endsWith('\\)')) {
          buffer.push(<InlineMath key={`cmt-inline-paren-${pidx}-${tidx}`} math={t.slice(2, -2).trim()} />);
        } else if (t.startsWith('$') && t.endsWith('$')) {
          buffer.push(<InlineMath key={`cmt-inline-${pidx}-${tidx}`} math={t.slice(1, -1).trim()} />);
        } else {
          buffer.push(tok);
        }
      }); flush();
      return elems;
    });
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
                <span className="text-gray-600 mr-2">重要性:</span>
                <span className={`px-2 py-1 rounded-full ${getImportanceColor()}`}>{getImportanceText()}</span>
              </div>
              {/* 显示评审次数和依赖关系 */}
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">评审次数:</span>
                <span className="font-medium text-gray-600">{lemma.reviews}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">依赖：</span>
                <span className="font-medium text-gray-600">{lemma.deps.join(', ') || '无'}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* 引理陈述 - 支持行内/块级公式，避免 <div> 嵌套在 <p> */}
        <CopyableBlock text={lemma.statement}>
          <div className="bg-white rounded-lg text-gray-600 p-4 shadow-inner border border-gray-200 mt-4 prose">
            <h3 className="text-lg font-semibold mb-3 text-blue-700">引理陈述:</h3>
            {lemma.statement.split(/\n{2,}/).flatMap((para, pidx) => {
            // 支持 $$..$$, \[..\], \(..\) 块/行内和 $..$ 行内公式
            const tokens = para.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g).filter(Boolean);
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
              } else if (t.startsWith('\\(') && t.endsWith('\\)')) {
                buffer.push(<InlineMath key={`stmt-inline-paren-${pidx}-${tidx}`} math={t.slice(2, -2).trim()} />);
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
        </CopyableBlock>
      </div>
      
      {/* 引理证明内容：展示完整证明，无滚动 */}
      <CopyableBlock text={lemma.proof}>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4 text-blue-800">证明:</h3>
          <div className="prose max-w-none text-gray-700">
            {renderProofContent()}
          </div>
        </div>
      </CopyableBlock>
      {/* 评论内容（如果有） */}
      {lemma.comment && (
        <CopyableBlock text={lemma.comment}>
          <div className="p-4 bg-yellow-50 border-t border-yellow-200 text-sm text-gray-800">
            <h4 className="font-semibold mb-2 text-yellow-800">评审评论:</h4>
            <div className="prose max-w-none">
              {renderCommentContent()}
            </div>
          </div>
        </CopyableBlock>
      )}
      {/* 底部元数据 */}
      <div className="pt-4 pw-4 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
        <span>创建时间: {lemma.createdAt}</span>
        <span>最后更新: {lemma.lastUpdated}</span>
      </div>
    </div>
  );
};

export default LemmaDetail;
