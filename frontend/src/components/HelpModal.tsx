"use client";

import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ show, onClose }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      />
      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-lg z-10 w-11/12 md:w-1/2 max-h-[80vh] overflow-y-auto p-6 relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close help"
        >
          <FaTimes />
        </button>
        <h2 className="text-xl text-gray-700 font-bold mb-4">帮助</h2>
        <div className="space-y-4 text-gray-700 text-sm">
          <p>
            欢迎使用 AIM (AI Mathematician)。AIM 是一个用于前沿数学研究的智能助理，可以帮助您探索、验证并求解复杂的数学命题。
          </p>
          <h3 className="font-semibold">快速开始</h3>
          <ul className="list-disc list-inside">
            <li>注册并登录：在顶部导航栏点击“帮助”以获取使用说明。首次使用请先进行注册，并通过电子邮件/密码登录。</li>
            <li>创建项目：在主页点击“新建项目”，填写标题、问题陈述以及可选背景信息，然后提交。</li>
            <li>查看进度：项目创建后，可在主页项目列表中查看所有会话状态和概要信息。</li>
          </ul>
          <h3 className="font-semibold">项目状态说明</h3>
          <ul className="list-disc list-inside">
            <li><strong>Running</strong>：项目正在后台运行、生成和验证引理。</li>
            <li><strong>Solved</strong>：已找到最终定理，证明流程顺利结束并找到了最终答案。</li>
            <li><strong>Ended</strong>：研究会话已停止，但尚未产生完整解决方案。</li>
          </ul>
          <h3 className="font-semibold">查看详情</h3>
          <p>
            点击任一项目卡中的“查看项目详情”，进入可视化引理列表与证明细节页面。
            左侧展示已探索的引理，右侧展示选中引理的详细证明内容。
          </p>
          <h3 className="font-semibold">Credits 系统</h3>
          <p>
            系统通过积分 (Credits) 限制每日/总项目创建数量。您可在导航栏查看剩余积分及角色信息。其中NORMAL用户总共仅2次使用额度，拥有邀请码的INVITED用户每日可创建至多3个项目 (富余额度不累积到第二天)。积分限制主要是出于运营成本考量而设置，目前我们还没有额外补充使用额度的途径，敬请谅解。
          </p>
          <h3 className="font-semibold">更多帮助</h3>
          <p>
            如有疑问或建议，请在 GitHub 仓库提交 Issue，或加入讨论与我们联系。
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
