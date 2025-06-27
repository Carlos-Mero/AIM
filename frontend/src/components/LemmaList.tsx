import React, { Dispatch, SetStateAction } from 'react';
import { FaCircle } from 'react-icons/fa';

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

interface LemmaListProps {
  lemmas: Lemma[];
  selectedLemma: Lemma | null;
  onSelectLemma: Dispatch<SetStateAction<Lemma | null>>;
}

const LemmaList: React.FC<LemmaListProps> = ({ 
  lemmas, 
  selectedLemma, 
  onSelectLemma 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proved': return 'text-green-500';
      case 'in_progress': return 'text-yellow-500';
      case 'invalid': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
      {lemmas.map((lemma) => (
        <div 
          key={lemma.id}
          className={`border-b border-gray-100 transition-colors cursor-pointer ${
            selectedLemma?.id === lemma.id 
              ? 'bg-blue-50 border-l-4 border-l-blue-500' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => onSelectLemma(lemma)}
        >
          <div className="p-5">
            <div className="flex justify-between">
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                {lemma.title}
              </h3>
              <div className="flex items-center">
                <FaCircle 
                  className={`text-xs mr-2 ${getStatusColor(lemma.status)}`} 
                />
                <span className="text-xs font-medium">
                  {lemma.status === 'proved' ? '已证明' :
                   lemma.status === 'in_progress' ? '证明中' :
                   lemma.status === 'invalid' ? '无效' : '待处理'}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {lemma.statement}
            </p>
            
            <div className="flex justify-between items-center">
              <span 
                className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(lemma.difficulty)}`}
              >
                {lemma.difficulty === 'easy' ? '简单' :
                 lemma.difficulty === 'medium' ? '中等' : '困难'}
              </span>
              <span className="text-xs text-gray-500">
                {lemma.createdAt}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {lemmas.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-gray-500">此项目还没有引理</p>
        </div>
      )}
    </div>
  );
};

export default LemmaList;
