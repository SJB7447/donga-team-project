
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Calendar, AlertCircle, CheckCircle2, 
  BarChart3, AlertTriangle, Download, FileText, 
  ExternalLink, Sparkles, X, RefreshCw, Trash2, 
  Settings, Lock, UserPlus, Database, ImageIcon, 
  Paperclip, Smartphone, Pencil, Calculator, Cloud,
  FileSpreadsheet, Share2, Link as LinkIcon, File
} from 'lucide-react';
import { 
  Task, Requirement, MeetingLog, TeamMember, 
  TaskStatus, ReqCategory, AIProgressResult 
} from './types';
import { calculateTaskProgress, generateProjectSummary } from './services/geminiService';
import * as db from './services/supabaseService';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'schedule' | 'workflow' | 'requirements' | 'meetings'>('schedule');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Core Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [meetings, setMeetings] = useState<MeetingLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // UI States
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isReqFormOpen, setIsReqFormOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingLog | null>(null);
  const [adminModeOpen, setAdminModeOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'task' | 'req' | 'meeting' | 'member', title: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState('');
  
  // File Preview States
  const [selectedFile, setSelectedFile] = useState<{ name: string; data: string; type: 'image' | 'file' } | null>(null);

  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
    deadline: string;
    description: string;
    result: AIProgressResult | null;
    loading: boolean;
  }>({
    isOpen: false, taskId: null, taskTitle: '', deadline: '', description: '', result: null, loading: false
  });

  // Load Initial Data from Supabase
  useEffect(() => {
    async function load() {
      try {
        const data = await db.fetchAllData();
        setTasks(data.tasks);
        setRequirements(data.requirements);
        setMeetings(data.meetings);
        setTeamMembers(data.teamMembers);
      } catch (e) {
        console.error("Supabase 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'done').length,
    issues: tasks.filter(t => t.issue).length,
    avgProgress: tasks.length ? Math.round(tasks.reduce((a, t) => a + t.progress, 0) / tasks.length) : 0
  }), [tasks]);

  const gantt = useMemo(() => {
    if (!tasks.length) return { start: new Date(), days: 30, items: [] };
    const timestamps = tasks.map(t => [t.createdAt, new Date(t.deadline).getTime()]).flat();
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const start = new Date(min); 
    start.setDate(start.getDate() - 3);
    const end = new Date(max); 
    end.setDate(end.getDate() + 7);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return { start, days, items: [...tasks].sort((a, b) => a.createdAt - b.createdAt) };
  }, [tasks]);

  // File Helpers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedFile({
        name: file.name,
        data: base64,
        type: file.type.startsWith('image/') ? 'image' : 'file'
      });
    };
    reader.readAsDataURL(file);
  };

  // Export Functions
  const handleExportExcel = () => {
    const headers = ['ID', '작업명', '담당자', '역할', '상태', '진행률', '마감일', '이슈'];
    const rows = tasks.map(t => [
      t.id, t.title, t.assignee, t.role, t.status, `${t.progress}%`, t.deadline, t.issue || '없음'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Project_Tasks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportWord = () => {
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Project Report</title></head>
      <body>
        <h1 style="text-align: center; color: #4F46E5;">프로젝트 진행 현황 보고서</h1>
        <p style="text-align: right;">출력일: ${new Date().toLocaleString()}</p>
        <hr/>
        <h2>1. 요약 통계</h2>
        <ul>
          <li>전체 작업: ${stats.total}건</li>
          <li>완료 작업: ${stats.completed}건</li>
          <li>평균 진행률: ${stats.avgProgress}%</li>
          <li>현재 이슈: ${stats.issues}건</li>
        </ul>
        <h2>2. 상세 작업 목록</h2>
        <table border="1" style="width:100%; border-collapse: collapse;">
          <tr style="background: #F3F4F6;">
            <th>작업명</th><th>담당자</th><th>상태</th><th>진행률</th><th>마감일</th>
          </tr>
          ${tasks.map(t => `
            <tr>
              <td>${t.title}</td><td>${t.assignee}</td><td>${t.status}</td><td>${t.progress}%</td><td>${t.deadline}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Project_Report_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateShortcut = () => {
    const currentUrl = window.location.href;
    const shortcutHtml = `
      <html>
      <head>
        <title>TeamFlow Pro 바로가기</title>
        <meta http-equiv="refresh" content="0;url=${currentUrl}">
        <script>window.location.href = "${currentUrl}";</script>
      </head>
      <body>앱으로 이동 중입니다...</body>
      </html>
    `;
    const blob = new Blob([shortcutHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "TeamFlow_Pro_바로가기.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handlers: Database Sync
  const wrapSync = async (fn: () => Promise<any>) => {
    setIsSyncing(true);
    try {
      await fn();
    } catch (e) {
      alert("동기화 중 오류가 발생했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const taskData: Task = {
      id: editingTask?.id || crypto.randomUUID(),
      title: formData.get('title') as string,
      assignee: formData.get('assignee') as string,
      role: formData.get('role') as string,
      deadline: formData.get('deadline') as string,
      description: formData.get('description') as string,
      status: editingTask?.status || 'todo',
      priority: editingTask?.priority || 'medium',
      progress: editingTask?.progress || 0,
      issue: editingTask?.issue || '',
      createdAt: editingTask?.createdAt || Date.now(),
      attachmentName: selectedFile?.name || editingTask?.attachmentName,
      attachmentType: selectedFile?.type || editingTask?.attachmentType,
      attachmentData: selectedFile?.data || editingTask?.attachmentData
    };

    await wrapSync(async () => {
      await db.upsertTask(taskData);
      setTasks(prev => {
        const index = prev.findIndex(t => t.id === taskData.id);
        if (index > -1) return prev.map(t => t.id === taskData.id ? taskData : t);
        return [taskData, ...prev];
      });
    });
    setIsTaskFormOpen(false);
    setEditingTask(null);
    setSelectedFile(null);
  };

  const handleSaveRequirement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reqData: Requirement = {
      id: editingReq?.id || crypto.randomUUID(),
      title: formData.get('title') as string,
      category: formData.get('category') as ReqCategory,
      content: formData.get('content') as string,
      link: formData.get('link') as string,
      createdAt: editingReq?.createdAt || Date.now(),
      attachmentName: selectedFile?.name || editingReq?.attachmentName,
      attachmentType: selectedFile?.type || editingReq?.attachmentType,
      attachmentData: selectedFile?.data || editingReq?.attachmentData
    };

    await wrapSync(async () => {
      await db.upsertRequirement(reqData);
      setRequirements(prev => {
        const index = prev.findIndex(r => r.id === reqData.id);
        if (index > -1) return prev.map(r => r.id === reqData.id ? reqData : r);
        return [reqData, ...prev];
      });
    });
    setIsReqFormOpen(false);
    setEditingReq(null);
    setSelectedFile(null);
  };

  const handleSaveMeeting = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const meetingData: MeetingLog = {
      id: editingMeeting?.id || crypto.randomUUID(),
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      attendees: formData.get('attendees') as string,
      content: formData.get('content') as string,
      createdAt: editingMeeting?.createdAt || Date.now(),
      attachmentName: selectedFile?.name || editingMeeting?.attachmentName,
      attachmentType: selectedFile?.type || editingMeeting?.attachmentType,
      attachmentData: selectedFile?.data || editingMeeting?.attachmentData
    };

    await wrapSync(async () => {
      await db.upsertMeeting(meetingData);
      setMeetings(prev => {
        const index = prev.findIndex(m => m.id === meetingData.id);
        if (index > -1) return prev.map(m => m.id === meetingData.id ? meetingData : m);
        return [meetingData, ...prev];
      });
    });
    setIsMeetingFormOpen(false);
    setEditingMeeting(null);
    setSelectedFile(null);
  };

  const handleUpdateTaskField = async (id: string, field: keyof Task, value: any) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, [field]: value };
    await wrapSync(async () => {
      await db.upsertTask(updated);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
    });
  };

  // AI Progress Logic
  const handleAiProgress = async () => {
    if (!progressModal.taskId) return;
    setProgressModal(prev => ({ ...prev, loading: true }));
    try {
      const context = requirements.map(r => r.title).join(", ");
      const result = await calculateTaskProgress(
        progressModal.taskTitle,
        progressModal.deadline,
        progressModal.description,
        context
      );
      setProgressModal(prev => ({ ...prev, result, loading: false }));
    } catch (e) {
      alert("AI 분석 실패");
      setProgressModal(prev => ({ ...prev, loading: false }));
    }
  };

  const applyAIProgress = () => {
    if (progressModal.taskId && progressModal.result) {
      handleUpdateTaskField(progressModal.taskId, 'progress', progressModal.result.percentage);
      handleUpdateTaskField(progressModal.taskId, 'description', progressModal.description);
      const newStatus: TaskStatus = progressModal.result.percentage === 100 ? 'done' : progressModal.result.percentage === 0 ? 'todo' : 'in-progress';
      handleUpdateTaskField(progressModal.taskId, 'status', newStatus);
      setProgressModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleAiSummary = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    const dataStr = JSON.stringify({ 
      tasks: tasks.map(t => ({ title: t.title, progress: t.progress, status: t.status, issue: t.issue })), 
      stats 
    });
    const summary = await generateProjectSummary(dataStr);
    setAiContent(summary);
    setAiLoading(false);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    await wrapSync(async () => {
      if (deleteTarget.type === 'task') {
        await db.deleteTask(deleteTarget.id);
        setTasks(prev => prev.filter(t => t.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'req') {
        await db.deleteRequirement(deleteTarget.id);
        setRequirements(prev => prev.filter(r => r.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'meeting') {
        await db.deleteMeeting(deleteTarget.id);
        setMeetings(prev => prev.filter(m => m.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'member') {
        await db.deleteMember(deleteTarget.id);
        setTeamMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
      }
    });
    setDeleteTarget(null);
  };

  if (loading) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
      <RefreshCw className="h-10 w-10 animate-spin text-indigo-600" />
      <p className="text-sm font-bold text-slate-500">Supabase 데이터를 안전하게 불러오고 있습니다...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-40 h-16 border-b bg-white/80 px-4 shadow-sm backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600 p-2 text-white shadow-lg shadow-indigo-200">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span className="hidden text-lg font-bold tracking-tight text-slate-800 md:block">TeamFlow Pro</span>
        </div>

        <nav className="flex rounded-xl bg-slate-100 p-1">
          {(['schedule', 'workflow', 'requirements', 'meetings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                currentTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'workflow' ? '작업' : tab === 'schedule' ? '일정' : tab === 'requirements' ? '자료' : '회의'}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
             <button onClick={handleExportExcel} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600" title="Excel로 내보내기">
               <FileSpreadsheet className="h-5 w-5" />
             </button>
             <button onClick={handleExportWord} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600" title="Word로 내보내기">
               <FileText className="h-5 w-5" />
             </button>
             <button onClick={handleCreateShortcut} className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600" title="바탕화면 바로가기 만들기">
               <Smartphone className="h-5 w-5" />
             </button>
             <div className="mx-2 h-4 w-px bg-slate-200"></div>
          </div>

          <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${isSyncing ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Cloud className={`h-3 w-3 ${isSyncing ? 'animate-pulse' : ''}`} />
            {isSyncing ? '동기화' : '보안백업'}
          </div>
          <button onClick={handleAiSummary} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" title="AI 리포트 생성">
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {currentTab === 'schedule' && (
           <div className="animate-in slide-in-from-bottom-4 duration-500 rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
             <h2 className="mb-8 text-xl font-bold flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-600"/> 프로젝트 타임라인</h2>
             <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[1000px] relative">
                  <div className="mb-4 flex h-8 border-b border-slate-100 relative">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const date = new Date(gantt.start.getTime() + (gantt.days / 5 * i) * 86400000);
                      return (
                        <div key={i} className="absolute text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{ left: `${i * 20}%` }}>
                          {date.getMonth() + 1}/{date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-6">
                    {gantt.items.map(t => {
                      const start = new Date(t.createdAt);
                      const end = new Date(t.deadline);
                      const left = ((start.getTime() - gantt.start.getTime()) / (gantt.days * 86400000)) * 100;
                      const width = Math.max(2, ((end.getTime() - start.getTime()) / (gantt.days * 86400000)) * 100);
                      return (
                        <div key={t.id} className="relative flex h-10 items-center">
                          <div className="w-1/4 pr-6 text-sm font-bold text-slate-700 truncate">{t.title}</div>
                          <div className="relative h-full flex-1 bg-slate-50/50 rounded-full">
                            <div className={`absolute h-8 top-1 rounded-full flex items-center px-4 text-[10px] font-bold text-white shadow-lg ${t.status === 'done' ? 'bg-emerald-500' : t.status === 'in-progress' ? 'bg-indigo-500' : 'bg-slate-400'}`} style={{ left: `${left}%`, width: `${width}%` }}>
                              {t.progress}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
             </div>
           </div>
        )}

        {currentTab === 'workflow' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="전체 진행률" value={`${stats.avgProgress}%`} icon={<BarChart3 className="h-4 w-4 text-indigo-500" />} progress={stats.avgProgress} />
              <StatCard label="완료 작업" value={`${stats.completed}/${stats.total}`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
              <StatCard label="활성 이슈" value={`${stats.issues}건`} icon={<AlertTriangle className={`h-4 w-4 ${stats.issues ? 'text-rose-500' : 'text-slate-300'}`} />} />
              <button
                onClick={() => { setEditingTask(null); setIsTaskFormOpen(true); setSelectedFile(null); }}
                className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white p-4 transition-all hover:border-indigo-400 hover:bg-indigo-50"
              >
                <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 group-hover:bg-indigo-200">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="mt-1 text-sm font-bold text-indigo-600">작업 추가</span>
              </button>
            </div>

            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="flex h-60 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white text-slate-400">
                  <Database className="mb-2 h-10 w-10 opacity-20" />
                  <p>데이터가 없습니다. 작업을 추가해보세요.</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className={`group relative grid grid-cols-1 gap-6 rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md md:grid-cols-12 ${task.issue ? 'border-rose-100 bg-rose-50/10' : 'border-slate-100'}`}>
                    <div className="md:col-span-4">
                      <div className="mb-2 flex items-center gap-2">
                        <StatusBadge status={task.status} />
                        <span className="flex items-center text-xs font-medium text-slate-400">
                          <Calendar className="mr-1 h-3 w-3" /> {task.deadline}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">{task.title}</h3>
                      <p className="text-sm font-medium text-slate-500">{task.assignee} · {task.role}</p>
                      {task.description && (
                        <div className="custom-scrollbar mt-3 max-h-24 overflow-y-auto rounded-lg border border-slate-50 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
                          {task.description}
                        </div>
                      )}
                      {task.attachmentData && (
                        <div className="mt-4">
                          {task.attachmentType === 'image' ? (
                            <img src={task.attachmentData} className="h-24 w-32 rounded-lg object-cover shadow-sm" alt="Task attachment" />
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2 text-[10px] font-bold text-slate-500">
                              <File className="h-4 w-4" /> {task.attachmentName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-4">
                      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>진행률</span>
                        <button 
                          onClick={() => setProgressModal({ 
                            isOpen: true, taskId: task.id, taskTitle: task.title, 
                            deadline: task.deadline, description: task.description, 
                            result: null, loading: false 
                          })}
                          className="flex items-center gap-1 text-indigo-600 hover:underline"
                        >
                          <Calculator className="h-3 w-3" /> AI 측정
                        </button>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={task.progress} 
                        onChange={e => handleUpdateTaskField(task.id, 'progress', parseInt(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-indigo-600">{task.progress}%</span>
                        <select 
                          value={task.status} 
                          onChange={e => handleUpdateTaskField(task.id, 'status', e.target.value as TaskStatus)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold focus:outline-none"
                        >
                          <option value="todo">대기</option>
                          <option value="in-progress">진행</option>
                          <option value="review">검토</option>
                          <option value="done">완료</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:col-span-4">
                      <textarea
                        placeholder="특이사항 및 이슈 입력..."
                        value={task.issue}
                        onChange={e => handleUpdateTaskField(task.id, 'issue', e.target.value)}
                        className="h-full min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs focus:border-indigo-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingTask(task); setIsTaskFormOpen(true); setSelectedFile(null); }} className="rounded-lg p-2 text-slate-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget({ id: task.id, type: 'task', title: task.title })} className="rounded-lg p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentTab === 'requirements' && (
          <div className="animate-in fade-in duration-500">
             <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">요구사항 및 참고자료</h2>
              <button 
                onClick={() => { setEditingReq(null); setIsReqFormOpen(true); setSelectedFile(null); }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" /> 자료 추가
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {requirements.map(req => (
                <div key={req.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-xl">
                  <div className="relative h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {req.attachmentData && req.attachmentType === 'image' ? (
                      <img src={req.attachmentData} alt="thumb" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        {req.attachmentData ? <FileText className="mb-2 h-10 w-10" /> : <Database className="mb-2 h-10 w-10 opacity-10" />}
                        <span className="max-w-[150px] truncate text-[10px] font-bold uppercase tracking-widest">{req.attachmentName || 'No Attachment'}</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-sm">
                      {req.category === 'requirement' ? '요구사항' : req.category === 'guideline' ? '지침서' : '참고자료'}
                    </span>
                  </div>
                  <div className="flex-1 p-5">
                    <h3 className="mb-2 font-bold text-slate-800 line-clamp-1">{req.title}</h3>
                    <p className="mb-4 text-sm leading-relaxed text-slate-500 line-clamp-3">{req.content}</p>
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex gap-3">
                        {req.link && <a href={req.link} target="_blank" className="flex items-center gap-1 text-xs font-bold text-indigo-600"><ExternalLink className="h-3 w-3" /> 링크</a>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingReq(req); setIsReqFormOpen(true); setSelectedFile(null); }} className="text-slate-300 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget({ id: req.id, type: 'req', title: req.title })} className="text-slate-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {requirements.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400">자료가 없습니다. 상단의 '자료 추가' 버튼을 눌러보세요.</div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'meetings' && (
           <div className="animate-in fade-in duration-500">
             <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">회의록 및 의사결정</h2>
              <button 
                onClick={() => { setEditingMeeting(null); setIsMeetingFormOpen(true); setSelectedFile(null); }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" /> 회의록 작성
              </button>
            </div>
            <div className="space-y-4">
              {meetings.map(m => (
                <div key={m.id} className="flex flex-col gap-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:flex-row hover:shadow-md">
                   <div className="flex h-fit w-full flex-col items-center justify-center rounded-2xl bg-slate-50 p-4 text-center sm:w-28">
                      <div className="text-2xl font-black text-indigo-600">{new Date(m.date).getDate()}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(m.date).toLocaleString('default', { month: 'short' })}</div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold text-slate-800">{m.title}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingMeeting(m); setIsMeetingFormOpen(true); setSelectedFile(null); }} className="text-slate-300 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteTarget({ id: m.id, type: 'meeting', title: m.title })} className="text-slate-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-slate-400">참석자: {m.attendees || '기록 없음'}</p>
                      <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{m.content}</div>
                      {m.attachmentData && (
                        <div className="mt-2">
                          {m.attachmentType === 'image' ? (
                            <img src={m.attachmentData} className="h-24 w-32 rounded-lg object-cover shadow-sm border border-slate-100" alt="Meeting attachment" />
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border bg-white p-2 text-[10px] font-bold text-slate-500 w-fit">
                              <FileText className="h-4 w-4 text-indigo-500" /> {m.attachmentName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                </div>
              ))}
              {meetings.length === 0 && (
                <div className="py-20 text-center text-slate-400">회의록이 없습니다. 상단의 '회의록 작성' 버튼을 눌러보세요.</div>
              )}
            </div>
           </div>
        )}
      </main>

      {/* Admin Button */}
      <button onClick={() => setAdminModeOpen(true)} className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl transition-all hover:scale-110 active:scale-95 z-40">
        <Settings className="h-6 w-6" />
      </button>

      {/* Modals Section */}
      {/* Task Form Modal */}
      {isTaskFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">{editingTask ? '작업 수정' : '새 작업'}</h3>
              <button onClick={() => setIsTaskFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSaveTask} className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400">작업 제목</label>
                <input name="title" required defaultValue={editingTask?.title} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400">담당자</label>
                <select name="assignee" required defaultValue={editingTask?.assignee} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  {teamMembers.length > 0 ? teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>) : <option value="">멤버를 먼저 등록하세요</option>}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400">역할</label>
                <input name="role" required defaultValue={editingTask?.role} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400">마감 기한</label>
                <input name="deadline" type="date" required defaultValue={editingTask?.deadline} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400">상세 설명</label>
                <textarea name="description" defaultValue={editingTask?.description} className="h-32 w-full resize-none rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              
              {/* File Upload UI */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold text-slate-400">이미지 및 문서 첨부</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-all hover:border-indigo-400 hover:bg-indigo-50">
                    <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                    <Plus className="h-6 w-6" />
                    <span className="mt-2 text-[10px] font-bold">파일 선택</span>
                  </label>
                  {(selectedFile || editingTask?.attachmentData) && (
                    <div className="relative h-32 w-32 rounded-2xl border border-slate-100 bg-white overflow-hidden group shadow-sm">
                      {(selectedFile?.type === 'image' || editingTask?.attachmentType === 'image') ? (
                        <img src={selectedFile?.data || editingTask?.attachmentData} className="h-full w-full object-cover" alt="Preview" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-500 p-2">
                          <FileText className="h-8 w-8 mb-1" />
                          <span className="text-[10px] font-bold text-center truncate w-full">{selectedFile?.name || editingTask?.attachmentName}</span>
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="absolute right-1 top-1 rounded-full bg-rose-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsTaskFormOpen(false)} className="rounded-xl border px-6 py-3 font-bold text-slate-500">취소</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100">작업 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requirement Form Modal */}
      {isReqFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">{editingReq ? '자료 수정' : '새 자료 추가'}</h3>
              <button onClick={() => setIsReqFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSaveRequirement} className="space-y-6">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">제목</label>
                <input name="title" required defaultValue={editingReq?.title} placeholder="자료 명칭 입력" className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">카테고리</label>
                <select name="category" required defaultValue={editingReq?.category || 'requirement'} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="requirement">요구사항</option>
                  <option value="guideline">지침서</option>
                  <option value="reference">참고자료</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">외부 링크 (선택)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="link" defaultValue={editingReq?.link} placeholder="https://..." className="w-full rounded-xl border pl-10 pr-4 py-3 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">내용</label>
                <textarea name="content" required defaultValue={editingReq?.content} className="h-32 w-full resize-none rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* Requirement File Upload */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-400">파일 첨부</label>
                <div className="flex gap-4">
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                    <input type="file" className="hidden" onChange={handleFileChange} />
                    <Paperclip className="h-5 w-5" />
                    <span className="mt-1 text-[9px] font-bold">첨부</span>
                  </label>
                  {(selectedFile || editingReq?.attachmentData) && (
                    <div className="relative h-24 w-24 rounded-xl border bg-white shadow-sm overflow-hidden group">
                      {(selectedFile?.type === 'image' || editingReq?.attachmentType === 'image') ? (
                        <img src={selectedFile?.data || editingReq?.attachmentData} className="h-full w-full object-cover" alt="Preview" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 p-1 text-[9px] text-slate-500 font-bold text-center">
                          <FileText className="h-6 w-6 mb-1 text-indigo-400" />
                          <span className="truncate w-full">{selectedFile?.name || editingReq?.attachmentName}</span>
                        </div>
                      )}
                      <button type="button" onClick={() => setSelectedFile(null)} className="absolute right-1 top-1 rounded-full bg-rose-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsReqFormOpen(false)} className="rounded-xl border px-6 py-3 font-bold text-slate-500">취소</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100">자료 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Form Modal */}
      {isMeetingFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">{editingMeeting ? '회의록 수정' : '새 회의록 작성'}</h3>
              <button onClick={() => setIsMeetingFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSaveMeeting} className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">회의 주제</label>
                <input name="title" required defaultValue={editingMeeting?.title} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">회의 일시</label>
                <input name="date" type="date" required defaultValue={editingMeeting?.date || new Date().toISOString().split('T')[0]} className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">참석자</label>
                <input name="attendees" defaultValue={editingMeeting?.attendees} placeholder="이름, 이름..." className="w-full rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400 uppercase tracking-widest">회의 내용 및 의사결정 사항</label>
                <textarea name="content" required defaultValue={editingMeeting?.content} className="h-48 w-full resize-none rounded-xl border px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* Meeting File Upload */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold text-slate-400">자료 및 이미지 첨부</label>
                <div className="flex flex-wrap gap-4">
                   <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                    <input type="file" className="hidden" onChange={handleFileChange} />
                    <ImageIcon className="h-5 w-5" />
                    <span className="mt-1 text-[9px] font-bold">파일 선택</span>
                  </label>
                  {(selectedFile || editingMeeting?.attachmentData) && (
                    <div className="relative h-24 w-24 rounded-xl border bg-white shadow-sm overflow-hidden group">
                      {(selectedFile?.type === 'image' || editingMeeting?.attachmentType === 'image') ? (
                        <img src={selectedFile?.data || editingMeeting?.attachmentData} className="h-full w-full object-cover" alt="Preview" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 p-1 text-[9px] text-slate-500 font-bold text-center">
                          <FileText className="h-6 w-6 mb-1 text-indigo-400" />
                          <span className="truncate w-full">{selectedFile?.name || editingMeeting?.attachmentName}</span>
                        </div>
                      )}
                      <button type="button" onClick={() => setSelectedFile(null)} className="absolute right-1 top-1 rounded-full bg-rose-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsMeetingFormOpen(false)} className="rounded-xl border px-6 py-3 font-bold text-slate-500">취소</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100">회의록 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Progress Modal */}
      {progressModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600"><Calculator className="h-6 w-6"/> Gemini AI 진행률 평가</h3>
              <button onClick={() => setProgressModal(prev => ({...prev, isOpen: false}))} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="space-y-6">
              <textarea
                value={progressModal.description}
                onChange={e => setProgressModal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="현재까지의 구체적인 진행 상황을 설명해주세요 (예: 핵심 UI 설계 완료, 서버 API 연동 진행 중...)"
                className="h-40 w-full resize-none rounded-2xl border p-4 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {progressModal.loading ? (
                <div className="flex flex-col items-center py-4 text-indigo-600"><RefreshCw className="h-8 w-8 animate-spin mb-2" /><span className="text-sm font-bold">AI가 데이터를 정밀 분석 중입니다...</span></div>
              ) : progressModal.result && (
                <div className="rounded-2xl bg-indigo-50 p-6 border border-indigo-100 animate-in slide-in-from-top-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">분석 결과</span>
                    <span className="text-3xl font-black text-indigo-600">{progressModal.result.percentage}%</span>
                  </div>
                  <p className="text-sm font-medium text-indigo-800/80 leading-relaxed italic">"{progressModal.result.reasoning}"</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={handleAiProgress} disabled={progressModal.loading} className="rounded-xl bg-indigo-100 px-6 py-3 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-200">AI 분석 시작</button>
                {progressModal.result && <button onClick={applyAIProgress} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700">데이터 실시간 반영</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600"><Sparkles /> Gemini AI 프로젝트 요약</h3>
              <button onClick={() => setAiModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {aiLoading ? (
                <div className="flex h-full flex-col items-center justify-center text-indigo-600">
                  <RefreshCw className="mb-4 h-12 w-12 animate-spin" />
                  <p className="font-bold">현재까지의 모든 데이터를 바탕으로 통계 및 리스크를 분석 중입니다...</p>
                </div>
              ) : (
                <div className="prose max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{aiContent}</div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t bg-slate-50 p-6">
              <button onClick={() => setAiModalOpen(false)} className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Trash2 className="h-8 w-8" /></div>
             <h3 className="mb-2 text-lg font-bold">삭제하시겠습니까?</h3>
             <p className="mb-8 text-sm text-slate-400">"{deleteTarget.title}" 항목이 Supabase 데이터베이스에서 영구히 삭제됩니다.</p>
             <div className="flex gap-3">
               <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border py-3 text-sm font-bold text-slate-500">취소</button>
               <button onClick={executeDelete} className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white transition-all hover:bg-rose-700">영구 삭제</button>
             </div>
          </div>
        </div>
      )}

      {/* Admin Unlock Modal */}
      {adminModeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Lock className="h-4 w-4" /> 관리자 설정</h3>
              <button onClick={() => setAdminModeOpen(false)}><X /></button>
            </div>
            <div className="p-8">
              {!isAdminUnlocked ? (
                <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val==='1234')setIsAdminUnlocked(true); else alert('틀렸습니다.'); }} className="space-y-4 text-center">
                  <p className="text-sm text-slate-500">관리자 패스코드를 입력하세요. (기본: 1234)</p>
                  <input type="password" autoFocus className="w-full rounded-xl border-2 p-4 text-center text-xl font-black tracking-widest focus:border-indigo-500 focus:outline-none" />
                  <button type="submit" className="w-full rounded-xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-black">잠금 해제</button>
                </form>
              ) : (
                <div className="space-y-6">
                   <div className="rounded-2xl bg-indigo-50 p-4 border border-indigo-100 flex items-center gap-3">
                    <Cloud className="h-5 w-5 text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-600 leading-tight">Supabase 클라우드 실시간 동기화 모드 활성화 중</p>
                   </div>
                   <div>
                    <h4 className="mb-4 text-sm font-bold text-slate-800">팀 멤버 관리</h4>
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const name = (e.currentTarget.elements[0] as HTMLInputElement).value;
                        const role = (e.currentTarget.elements[1] as HTMLInputElement).value;
                        if(name && role) {
                          const newMember = { id: crypto.randomUUID(), name, role };
                          await wrapSync(async () => {
                            await db.upsertMember(newMember);
                            setTeamMembers(prev => [...prev, newMember]);
                          });
                          (e.currentTarget.elements[0] as HTMLInputElement).value = '';
                          (e.currentTarget.elements[1] as HTMLInputElement).value = '';
                        }
                      }}
                      className="mb-4 grid grid-cols-2 gap-2"
                    >
                      <input placeholder="성함" className="rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                      <input placeholder="역할" className="rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                      <button type="submit" className="col-span-2 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-700">멤버 추가</button>
                    </form>
                    <div className="custom-scrollbar max-h-48 overflow-y-auto rounded-xl border border-slate-100">
                      {teamMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                          <span className="text-sm font-bold text-slate-700">{m.name} <span className="text-xs font-normal text-slate-400">({m.role})</span></span>
                          <button onClick={() => setDeleteTarget({ id: m.id, type: 'member', title: m.name })} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      {teamMembers.length === 0 && <p className="p-4 text-center text-xs text-slate-400">등록된 멤버가 없습니다.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, icon, progress }: { label: string, value: string, icon: React.ReactNode, progress?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{label}</span>{icon}</div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const styles = { todo: 'bg-slate-100 text-slate-500', 'in-progress': 'bg-indigo-50 text-indigo-600', review: 'bg-amber-50 text-amber-600', done: 'bg-emerald-50 text-emerald-600' };
  const labels = { todo: '대기', 'in-progress': '진행', review: '검토', done: '완료' };
  return <span className={`rounded-lg px-2 py-1 text-[10px] font-black tracking-wider ${styles[status]}`}>{labels[status]}</span>;
}
