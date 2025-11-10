"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Lang = 'en' | 'zh';

type Dict = Record<string, string>;

const en: Dict = {
  guest: 'Guest',
  settings: 'Settings',
  signOut: 'Sign Out',
  help: 'Help',
  helloUser: 'Hello, {name}',
  exploreProjects: 'Explore your math research projects',
  newProject: 'New Project',
  yourProjects: 'Your Projects ({count})',
  refresh: 'Refresh',
  loading: 'Loading...',
  noMatch: 'No matching projects found',
  clearSearch: 'Clear search',
  lemmas: 'Lemmas: ',
  viewDetails: 'View Project Details',
  creator: 'Creator: ',
  confirmDelete: 'Are you sure to delete this project? This action is irreversible.',
  deleteFailed: 'Delete failed',
  delete: 'Delete',
  loadMore: 'Load more',
  userRoleCredits: '',
  // Login
  login_subtitle: 'Sign in to your AIM account',
  email_label: 'Email',
  password_label: 'Password',
  forgot_password: 'Forgot password?',
  login_button: 'Log In',
  no_account: "Don't have an account?",
  signup_now: 'Sign up now',
  login_failed: 'Login failed',
  network_error: 'Network error, please try again later',
  // Signup
  signup_subtitle: 'Create your AIM account',
  name_label: 'Full Name',
  academic_email_label: 'Academic Email',
  password_placeholder_min8: 'At least 8 characters',
  affiliation_label: 'Affiliation',
  affiliation_placeholder: 'University or research institute',
  math_field_label: 'Mathematics Field',
  choose_field: 'Please choose your research field',
  field_algebra: 'Algebra',
  field_analysis: 'Analysis',
  field_geometry: 'Geometry',
  field_topology: 'Topology',
  field_number_theory: 'Number Theory',
  field_applied_math: 'Applied Mathematics',
  field_statistics: 'Statistics',
  field_other: 'Other',
  invitation_label: 'Invitation Code (optional)',
  invitation_placeholder: 'Enter invitation code if you have one',
  agree_prefix: "I agree to AIM's ",
  terms_of_service: 'Terms of Service',
  and: ' and ',
  privacy_policy: 'Privacy Policy',
  create_account: 'Create Account',
  have_account: 'Already have an account?',
  login_now: 'Log in now',
  signup_failed: 'Signup failed',
  terms_title: 'Terms of Service',
  terms_body: 'Terms of service content goes here.',
  privacy_title: 'Privacy Policy',
  privacy_body: 'Privacy policy content goes here.',
  // New Project
  create_project_header: 'Create New Research Project',
  mode_label: 'Mode:',
  mode_standard: 'Standard',
  mode_deer_flow: 'Deer-Flow',
  title_label: 'Title',
  title_placeholder: 'Enter the project title',
  problem_label: 'Problem',
  problem_placeholder: 'Describe the research problem. Markdown and LaTeX supported',
  context_placeholder: 'Enter all background information and symbol definitions here. Markdown and LaTeX supported',
  show_advanced: 'Show advanced config',
  hide_advanced: 'Hide advanced config',
  proof_model: 'Proof Model',
  eval_model: 'Eval Model',
  reform_model: 'Reform Model',
  reasoning_effort: 'Reasoning Effort',
  steps_label: 'Steps (1–40)',
  reviews_label: 'Reviews (1–6)',
  iterations_label: 'Iterations (1–10)',
  reformat_conjectures: 'Reformat conjectures',
  theorem_graph_mode: 'Theorem graph mode',
  create_project: 'Create Project',
  create_project_failed: 'Failed to create project: {msg}',
  // Project page
  please_login: 'Please log in first',
  project_loading: 'Loading...',
  context_label: 'Context',
  created_last_active: 'Created {date} · Last active {ago}',
  view_settings: 'View Settings',
  hide_settings: 'Hide Settings',
  project_settings: 'Project Settings',
  lemma_list: 'Lemma List ({count})',
  search_lemmas: 'Search lemmas...',
  lemma_detail: 'Lemma Detail',
  select_lemma_title: 'Select a lemma to view details',
  select_lemma_text: 'Please select a lemma from the left list to view its detailed statement, proof, and related information.',
  notes_comments: 'Notes or Comments',
  saved: 'Saved!',
  failed_to_save: 'Failed to save',
  save: 'Save',
  project_loading_wait: 'Loading project data, please wait...',
  project_error_title: 'Session Error',
  project_error_hint: 'The backend stopped this project with the following message:',
  // Lemma components
  status_label: 'Status:',
  importance_label: 'Importance:',
  reviews_count_label: 'Reviews:',
  dependencies_label: 'Dependencies:',
  none: 'None',
  lemma_statement: 'Lemma Statement:',
  proof: 'Proof:',
  review_comment: 'Review Comment:',
  created_at_label: 'Created at:',
  last_updated_label: 'Last updated:',
  status_proved: 'Proved',
  status_in_progress: 'In Progress',
  status_invalid: 'Invalid',
  status_pending: 'Pending',
  importance_key: 'Key',
  importance_important: 'Important',
  importance_minor: 'Minor',
  no_lemmas: 'This project has no lemmas yet',
  // Help modal
  help_title: 'Help',
  help_welcome: 'Welcome to AIM (AI Mathematician). AIM is an intelligent assistant for cutting-edge mathematical research that helps you explore, verify, and solve complex mathematical propositions.',
  help_quickstart_title: 'Quick Start',
  help_quickstart_item_register_login: 'Register and log in: click “Help” in the top nav for instructions. For first use, sign up and log in via email/password.',
  help_quickstart_item_create_project: 'Create a project: click “New Project” on the home page, fill in the title, problem statement, optional background info, and submit.',
  help_quickstart_item_view_progress: 'View progress: after creation, see session status and summary in the home project list.',
  help_status_title: 'Project Status',
  help_status_running: 'Running: the project is generating and verifying lemmas in the background.',
  help_status_solved: 'Solved: a final theorem has been found and the proof pipeline has completed successfully.',
  help_status_ended: 'Ended: the research session has stopped without a complete solution.',
  help_view_title: 'View Details',
  help_view_text: 'Click “View Project Details” on any project card to enter the lemma list and proof details. The left shows explored lemmas; the right shows the selected lemma’s details.',
  help_credits_title: 'Credits System',
  help_credits_text: 'The system limits daily/total project creations via credits. You can see remaining credits and role in the nav bar. INVITED users can create up to 7 projects per day (not cumulative). This limit is mainly due to operating costs.',
  help_more_title: 'More Help',
  help_more_text_prelink: 'If you have questions or suggestions, please submit an issue in the ',
  help_more_link_text: 'GitHub repository',
  help_more_text_postlink: ', or join the discussion to contact us.'
};

const zh: Dict = {
  guest: '访客',
  settings: '设置',
  signOut: '退出',
  help: '帮助',
  helloUser: '您好，{name}',
  exploreProjects: '探索您的数学研究项目',
  newProject: '新建项目',
  yourProjects: '您的研究项目 ({count})',
  refresh: '刷新',
  loading: '加载中...',
  noMatch: '没有找到匹配的项目',
  clearSearch: '清空搜索',
  lemmas: '引理: ',
  viewDetails: '查看项目详情',
  creator: '创建者：',
  confirmDelete: '确认要删除该项目吗？此操作不可撤销。',
  deleteFailed: '删除失败',
  delete: '删除',
  loadMore: '加载更多',
  userRoleCredits: '',
  // Login
  login_subtitle: '登录您的数学家助手账户',
  email_label: '邮箱地址',
  password_label: '密码',
  forgot_password: '忘记密码?',
  login_button: '登录',
  no_account: '还没有账户?',
  signup_now: '立即注册',
  login_failed: '登录失败',
  network_error: '网络错误，请稍后重试',
  // Signup
  signup_subtitle: '创建您的数学家助手账户',
  name_label: '姓名',
  academic_email_label: '学术邮箱',
  password_placeholder_min8: '至少8个字符',
  affiliation_label: '所属机构',
  affiliation_placeholder: '大学或研究机构',
  math_field_label: '数学领域',
  choose_field: '请选择您的研究领域',
  field_algebra: '代数',
  field_analysis: '分析',
  field_geometry: '几何',
  field_topology: '拓扑学',
  field_number_theory: '数论',
  field_applied_math: '应用数学',
  field_statistics: '统计学',
  field_other: '其他',
  invitation_label: '邀请码（可选）',
  invitation_placeholder: '如果有，请输入邀请码',
  agree_prefix: '我同意 AI Mathematician 的 ',
  terms_of_service: '服务条款',
  and: ' 和 ',
  privacy_policy: '隐私政策',
  create_account: '创建账户',
  have_account: '已有账户?',
  login_now: '立即登录',
  signup_failed: '注册失败',
  terms_title: '服务条款',
  terms_body: '此处填写服务条款内容。',
  privacy_title: '隐私政策',
  privacy_body: '此处填写隐私政策内容。',
  // New Project
  create_project_header: '创建新研究项目',
  mode_label: '模式:',
  mode_standard: '标准',
  mode_deer_flow: 'Deer-Flow',
  title_label: '标题 (Title)',
  title_placeholder: '请输入研究项目的标题',
  problem_label: '问题 (Problem)',
  problem_placeholder: '在此描述研究问题，支持 Markdown、LaTeX',
  context_placeholder: '在此输入所有背景信息与符号定义，支持 Markdown、LaTeX',
  show_advanced: '显示高级配置',
  hide_advanced: '隐藏高级配置',
  proof_model: 'Proof Model',
  eval_model: 'Eval Model',
  reform_model: 'Reform Model',
  reasoning_effort: 'Reasoning Effort',
  steps_label: 'Steps (1–40)',
  reviews_label: 'Reviews (1–6)',
  iterations_label: 'Iterations (1–10)',
  reformat_conjectures: 'Reformat conjectures',
  theorem_graph_mode: 'Theorem graph mode',
  create_project: '创建项目',
  create_project_failed: '创建项目失败：{msg}',
  // Project page
  please_login: '请先登录',
  project_loading: '加载中...',
  context_label: 'Context',
  created_last_active: '创建于 {date} · 最后活跃 {ago}',
  view_settings: '查看设置',
  hide_settings: '隐藏设置',
  project_settings: '项目设置',
  lemma_list: '引理列表 ({count})',
  search_lemmas: '搜索引理...',
  lemma_detail: '引理详情',
  select_lemma_title: '选择引理查看详情',
  select_lemma_text: '请从左侧列表中选择一个引理以查看其详细表述、证明及相关信息',
  notes_comments: '备注或评论',
  saved: '已保存！',
  failed_to_save: '保存失败',
  save: '保存',
  project_loading_wait: '加载项目数据中，请稍候...',
  project_error_title: '运行错误',
  project_error_hint: '后端因以下原因中止了该项目：',
  // Lemma components
  status_label: '状态:',
  importance_label: '重要性:',
  reviews_count_label: '评审次数:',
  dependencies_label: '依赖：',
  none: '无',
  lemma_statement: '引理陈述:',
  proof: '证明:',
  review_comment: '评审评论:',
  created_at_label: '创建时间:',
  last_updated_label: '最后更新:',
  status_proved: '已证明',
  status_in_progress: '证明中',
  status_invalid: '无效',
  status_pending: '待处理',
  importance_key: '关键',
  importance_important: '重要',
  importance_minor: '次要',
  no_lemmas: '此项目还没有引理',
  // Help modal
  help_title: '帮助',
  help_welcome: '欢迎使用 AIM (AI Mathematician)。AIM 是一个用于前沿数学研究的智能助理，可以帮助您探索、验证并求解复杂的数学命题。',
  help_quickstart_title: '快速开始',
  help_quickstart_item_register_login: '注册并登录：在顶部导航栏点击“帮助”以获取使用说明。首次使用请先进行注册，并通过电子邮件/密码登录。',
  help_quickstart_item_create_project: '创建项目：在主页点击“新建项目”，填写标题、问题陈述以及可选背景信息，然后提交。',
  help_quickstart_item_view_progress: '查看进度：项目创建后，可在主页项目列表中查看所有会话状态和概要信息。',
  help_status_title: '项目状态说明',
  help_status_running: 'Running：项目正在后台运行、生成和验证引理。',
  help_status_solved: 'Solved：已找到最终定理，证明流程顺利结束并找到了最终答案。',
  help_status_ended: 'Ended：研究会话已停止，但尚未产生完整解决方案。',
  help_view_title: '查看详情',
  help_view_text: '点击任一项目卡中的“查看项目详情”，进入可视化引理列表与证明细节页面。左侧展示已探索的引理，右侧展示选中引理的详细证明内容。',
  help_credits_title: 'Credits 系统',
  help_credits_text: '系统通过积分 (Credits) 限制每日/总项目创建数量。您可在导航栏查看剩余积分及角色信息。其中INVITED用户每日可创建至多7个项目（额度不累积到第二天）。积分限制主要是出于运营成本考量而设置。',
  help_more_title: '更多帮助',
  help_more_text_prelink: '如有疑问或建议，请在 ',
  help_more_link_text: 'GitHub 仓库',
  help_more_text_postlink: ' 提交 Issue，或加入讨论与我们联系。'
};

const DICTS: Record<Lang, Dict> = { en, zh };

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof en, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('lang') as Lang | null) : null;
    if (saved === 'en' || saved === 'zh') setLangState(saved);
    else setLangState('en');
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('lang', l);
  };

  const t = useMemo(() => {
    return (key: keyof typeof en, vars?: Record<string, string | number>) => {
      const str = (DICTS[lang] as Dict)[key] ?? key;
      if (!vars) return str;
      return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]!)), str);
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
