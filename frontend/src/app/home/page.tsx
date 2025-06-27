"use client";

"use client";
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import { useRouter } from 'next/navigation';
import { FaPlus } from 'react-icons/fa';

interface Project {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  lastActive: string;
  lemmasCount: number;
}

const HomePage: React.FC = () => {
  // Get current user name from auth context
  const { fullName } = useAuth();
  const userName = fullName ?? '访客';
  const router = useRouter();
  // useEffect(() => {
  //   if (!token) router.push('/login');
  // }, [token]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // 模拟项目数据
  const [projects] = useState<Project[]>([
    {
      id: "1",
      title: "黎曼猜想的几何解析",
      description: "探索黎曼Zeta函数的几何意义及其与双曲几何的联系",
      createdAt: "2023-10-15",
      lastActive: "5小时前",
      lemmasCount: 8
    },
    {
      id: "2",
      title: "非交换几何中的规范场论",
      description: "在非交换几何框架下建立新的规范场理论模型",
      createdAt: "2023-09-22",
      lastActive: "2天前",
      lemmasCount: 12
    },
    {
      id: "3",
      title: "拓扑数据分析的高维推广",
      description: "扩展TDA方法到高维数据流形的有效算法研究",
      createdAt: "2023-08-05",
      lastActive: "1周前",
      lemmasCount: 5
    }
  ]);

  // 点击跳转到新建项目页面
  const handleCreateProject = () => {
    router.push('/new-project');
  };

  // 过滤项目函数
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">您好，{userName.split(' ')[0]}</h1>
            <p className="mt-2 text-gray-600">探索您的数学研究项目</p>
          </div>
          <button
            onClick={handleCreateProject}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md flex items-center"
          >
            <FaPlus className="mr-2" /> 新建项目
          </button>
        </div>

        {/* 项目列表 */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">您的研究项目 ({projects.length})</h2>
          
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-semibold text-gray-800 truncate max-w-[70%]">{project.title}</h3>
                      <span className="text-xs text-gray-500">{project.createdAt}</span>
                    </div>
                    <p className="text-gray-600 mb-4 h-14 line-clamp-2">{project.description}</p>
                    
                    <div className="flex justify-between text-sm text-gray-500">
                      <div>
                        <span className="font-medium">引理: </span>
                        <span className="text-blue-600 font-bold">{project.lemmasCount}</span>
                      </div>
                      <span>{project.lastActive}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                    <button className="text-blue-600 hover:text-blue-800 font-medium w-full text-left">
                      查看项目详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
