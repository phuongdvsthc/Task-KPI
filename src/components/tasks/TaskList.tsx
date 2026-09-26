import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { organizationService } from '../../services/organizationService';
import { profileService } from '../../services/profileService';
import { Task, TaskStatus, TaskPriority } from '../../types/task';
import { OrganizationUnit, Profile } from '../../types/database';
import { TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge, PublicationStatusBadge, AcknowledgementRequiredBadge } from './TaskBadges';
import { TaskCreate } from './TaskCreate';
import { TaskDetail } from './TaskDetail';
import { TaskProgressModal } from './TaskProgressModal';
import { AnnouncementPublishModal } from './AnnouncementPublishModal';
import { AnnouncementTrackingModal } from './AnnouncementTrackingModal';
import { taskIntelligenceService } from '../../services/task-intelligence.service';
import { TaskIntelligenceResult } from '../../types/task-intelligence';
import { TaskAIResultPanel } from './intelligence/TaskAIResultPanel';
import {
  Plus, 
  Search, 
  Filter, 
  RotateCcw, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight, 
  Loader2, 
  ListTodo, 
  AlertTriangle,
  Megaphone,
  Briefcase,
  CheckCheck,
  Sparkles
} from 'lucide-react';

export const TaskList: React.FC = () => {
  const { user, systemRole, allUnits } = useAuth();

  // Navigation subviews: 'list' | 'create' | 'detail'
  const [subView, setSubView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Quick progress modal state
  const [taskForProgressUpdate, setTaskForProgressUpdate] = useState<Task | null>(null);
  const [publishTaskId, setPublishTaskId] = useState<string | null>(null);
  const [trackingTaskId, setTrackingTaskId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI State
  const [aiResult, setAiResult] = useState<TaskIntelligenceResult | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAbortController, setAiAbortController] = useState<AbortController | null>(null);

  // Data states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'announcement'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'all'>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const loadFilterData = async () => {
    try {
      const [uData, pData] = await Promise.all([
        organizationService.getUnits(false),
        profileService.getAllProfiles(),
      ]);
      setUnits(uData);
      setProfiles(pData);
    } catch (err) {
      console.error('Error loading units/profiles in TaskList:', err);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const userUnitIds = allUnits.map((u) => u.id);
      const userContext = user
        ? {
            role: systemRole || ('staff' as const),
            userId: user.id,
            unitIds: userUnitIds,
          }
        : undefined;

      const data = await taskService.getTasks(
        {
          search_query: searchQuery,
          type_filter: typeFilter,
          unit_id: selectedUnit,
          status: selectedStatus,
          priority: selectedPriority,
          owner_id: selectedOwner || undefined,
          date_range: {
            from: dateFrom || undefined,
            to: dateTo || undefined,
          },
        },
        userContext
      );

      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  // Listen to hash changes for deep linking to specific task (e.g., from Notification Bell)
  useEffect(() => {
    const checkHashTaskId = () => {
      const hash = window.location.hash;
      if (hash.includes('taskId=')) {
        const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(queryPart);
        const tId = params.get('taskId');
        if (tId) {
          setSelectedTaskId(tId);
          setSubView('detail');
        }
      } else {
        const pathMatch = hash.match(/(?:#\/|#)tasks\/([0-9a-fA-F-]{36})/);
        if (pathMatch && pathMatch[1]) {
          setSelectedTaskId(pathMatch[1]);
          setSubView('detail');
        }
      }
    };

    checkHashTaskId();
    window.addEventListener('hashchange', checkHashTaskId);
    return () => window.removeEventListener('hashchange', checkHashTaskId);
  }, []);

  useEffect(() => {
    if (subView === 'list') {
      fetchTasks();
    }
    // Clear AI result on filter change to avoid stale state
    setAiResult(null);
    setAiError(null);
  }, [subView, typeFilter, searchQuery, selectedUnit, selectedStatus, selectedPriority, selectedOwner, dateFrom, dateTo]);

  const handleGenerateAiSummary = async () => {
    if (aiAbortController) {
      aiAbortController.abort();
    }

    const abortController = new AbortController();
    setAiAbortController(abortController);

    setIsGeneratingAi(true);
    setAiError(null);
    setAiResult(null);

    try {
      const feature = systemRole === 'staff' 
        ? 'staff_task_summary' 
        : (selectedUnit === 'all' ? 'manager_team_task_summary' : 'manager_unit_task_summary');
      const result = await taskIntelligenceService.getTaskIntelligence({
        feature,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        priority: selectedPriority !== 'all' ? selectedPriority : undefined,
        unitId: selectedUnit !== 'all' ? selectedUnit : undefined,
        userId: selectedOwner || undefined,
      }, abortController.signal);
      
      setAiResult(result);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setAiError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleResetFilters = () => {
    setTypeFilter('all');
    setSearchQuery('');
    setSelectedUnit('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedOwner('');
    setDateFrom('');
    setDateTo('');
  };

  // KPI summary metrics
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const reviewCount = tasks.filter((t) => t.status === 'waiting').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && t.status !== 'completed' && new Date(t.due_date).getTime() < new Date().setHours(0, 0, 0, 0)
  ).length;

  // Mapping helper
  const unitMap = new Map<string, string>();
  units.forEach((u) => unitMap.set(u.id, u.name));

  const profileMap = new Map<string, Profile>();
  profiles.forEach((p) => profileMap.set(p.id, p));

  // Check canCreateTask
  const canCreateTask = systemRole === 'admin' || systemRole === 'manager' || systemRole === 'staff';

  // Subview routing: Create Task View
  if (subView === 'create') {
    return (
      <TaskCreate
        editTaskId={selectedTaskId || undefined}
        onBack={() => {
          setSelectedTaskId(null);
          setSubView('list');
        }}
        onTaskCreated={(taskId) => {
          setSelectedTaskId(null);
          setSuccessMessage('Lưu thông báo thành công.');
          setSubView('list');
        }}
      />
    );
  }

  // Subview routing: Detail Task View
  if (subView === 'detail' && selectedTaskId) {
    return (
      <TaskDetail
        taskId={selectedTaskId}
        onBack={() => {
          setSelectedTaskId(null);
          setSubView('list');
        }}
      />
    );
  }

  return (
    <div id="task-list-page" className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-4 relative">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="absolute top-1/2 -translate-y-1/2 right-4 text-emerald-500 hover:text-emerald-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header & Quick Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ListTodo className="h-7 w-7 text-blue-600" />
            <span>Quản lý Công việc & Nhiệm vụ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi phân công, cập nhật tiến độ, minh chứng hoàn thành và kiểm soát deadline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateAiSummary}
            disabled={isGeneratingAi}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200"
          >
            {isGeneratingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>Tóm tắt bằng AI</span>
          </button>
          
          {canCreateTask && (
            <button
              id="btn-create-new-task"
              type="button"
              onClick={() => setSubView('create')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo công việc mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase">Tổng nhiệm vụ</span>
            <ListTodo className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalTasks}</p>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase">Đang thực hiện</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-700">{inProgressCount}</p>
        </div>

        {/* Review */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold uppercase">Chờ nghiệm thu</span>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-700">{reviewCount}</p>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase">Hoàn thành</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{completedCount}</p>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold uppercase">Quá hạn</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700">{overdueCount}</p>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Type Switcher Pills & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'task'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Nhiệm vụ</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('announcement')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'announcement'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span>Thông báo / Thông tri</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Xóa lọc</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="search-task-input"
                type="text"
                placeholder="Tên hoặc mã công việc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Đơn vị</label>
            <select
              id="filter-unit-select"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả đơn vị</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Trạng thái</label>
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="todo">Chưa thực hiện</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="review">Đang chờ</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Mức ưu tiên</label>
            <select
              id="filter-priority-select"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="urgent">Khẩn</option>
              <option value="high">Cao</option>
              <option value="normal">Bình thường</option>
              <option value="low">Thấp</option>
            </select>
          </div>

          {/* Owner Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Người phụ trách</label>
            <select
              id="filter-owner-select"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả cán bộ</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* AI Intelligence Area */}
      {aiError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex gap-2 items-start shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}
      
      {(aiResult || isGeneratingAi) && (
        <div className="relative">
          {isGeneratingAi && !aiResult && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-xs z-10 flex flex-col items-center justify-center rounded-xl border border-slate-200/50">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">AI đang phân tích công việc...</p>
            </div>
          )}
          {aiResult && (
            <div className={isGeneratingAi ? 'opacity-50 pointer-events-none' : ''}>
              <TaskAIResultPanel 
                result={aiResult}
                role={systemRole === 'staff' ? 'staff' : 'manager'}
                unitName={selectedUnit === 'all' ? 'Toàn phạm vi quản lý' : units.find(u => u.id === selectedUnit)?.name || 'Đơn vị'}
                onRegenerate={handleGenerateAiSummary}
                isRegenerating={isGeneratingAi}
                onDrillDownEvidence={(evidence) => {
                  if (evidence.taskId) {
                    setSelectedTaskId(evidence.taskId);
                    setSubView('detail');
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Task Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-2" />
            <p className="text-xs">Đang tải danh sách công việc...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ListTodo className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">Không tìm thấy công việc nào phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc tạo mới nhiệm vụ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Mã & Tên công việc</th>
                  <th scope="col" className="px-4 py-3.5">Đơn vị</th>
                  <th scope="col" className="px-4 py-3.5">Phụ trách</th>
                  <th scope="col" className="px-4 py-3.5">Trạng thái</th>
                  <th scope="col" className="px-4 py-3.5">Ưu tiên</th>
                  <th scope="col" className="px-4 py-3.5">Hạn chót</th>
                  <th scope="col" className="px-4 py-3.5">Tiến độ</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => {
                  const owner = profileMap.get(t.owner_id || t.created_by);
                  const isTaskOverdue =
                    t.due_date &&
                    t.status !== 'completed' &&
                    new Date(t.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setSubView('detail');
                      }}
                    >
                      {/* Task Code & Title */}
                      <td className="px-5 py-4 min-w-[280px]">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {t.task_code}
                            </span>
                            <TaskTypeBadge type={t.task_type} />
                            {t.task_type === 'announcement' && t.acknowledgement_required && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <CheckCheck className="w-2.5 h-2.5" /> Xác nhận
                              </span>
                            )}
                          </div>
                          <p className={`font-bold transition-colors line-clamp-2 ${
                            t.task_type === 'announcement' ? 'text-purple-950 group-hover:text-purple-700' : 'text-slate-900 group-hover:text-blue-600'
                          }`}>
                            {t.title}
                          </p>
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-4 min-w-[150px]">
                        <span className="font-medium text-slate-700 truncate block">
                          {unitMap.get(t.organization_unit_id) || t.organization_unit_id}
                        </span>
                      </td>

                      {/* Owner / Creator */}
                      <td className="px-4 py-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            t.task_type === 'announcement' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {owner?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{owner?.full_name || 'Cán bộ'}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {t.task_type === 'announcement' ? 'Người phát hành' : (owner?.job_title || '')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 min-w-[130px]">
                        {t.task_type === 'announcement' ? (
                          <PublicationStatusBadge status={t.publication_status} version={t.content_version} />
                        ) : (
                          <TaskStatusBadge status={t.status} />
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4 min-w-[110px]">
                        <TaskPriorityBadge priority={t.priority} />
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-4 min-w-[120px]">
                        <div className="space-y-0.5">
                          <span className={`font-semibold block ${isTaskOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                            {t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : '---'}
                          </span>
                          {isTaskOverdue && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                              Quá hạn
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Progress bar or Announcement metric */}
                      <td className="px-4 py-4 min-w-[140px]">
                        {t.task_type === 'announcement' ? (
                          <div className="text-[11px] text-purple-700 font-medium bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">
                            Theo dõi tiếp thu
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-600">{t.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  t.progress === 100
                                    ? 'bg-emerald-500'
                                    : t.progress > 50
                                    ? 'bg-blue-600'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${t.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right min-w-[130px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {t.task_type === 'announcement' ? (
                            <>
                              {t.publication_status === 'draft' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskId(t.id);
                                      setSubView('create');
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPublishTaskId(t.id);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 text-white hover:bg-purple-700"
                                  >
                                    Phát hành
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskId(t.id);
                                      setSubView('detail');
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  >
                                    Xem
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTrackingTaskId(t.id);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                  >
                                    Theo dõi
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskId(t.id);
                                      setSubView('create');
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  >
                                    Cập nhật
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {systemRole !== 'executive' && systemRole !== 'viewer' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setTaskForProgressUpdate(t); }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="Cập nhật tiến độ"
                                >
                                  <TrendingUp className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(t.id);
                                  setSubView('detail');
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                title="Xem chi tiết"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Progress update quick modal */}
      {taskForProgressUpdate && (
        <TaskProgressModal
          task={taskForProgressUpdate}
          isOpen={!!taskForProgressUpdate}
          onClose={() => setTaskForProgressUpdate(null)}
          onSuccess={fetchTasks}
        />
      )}

      {/* Publish Announcement Modal */}
      {publishTaskId && (
        <AnnouncementPublishModal
          taskId={publishTaskId}
          isOpen={!!publishTaskId}
          onClose={() => setPublishTaskId(null)}
          onSuccess={(count) => {
            setPublishTaskId(null);
            setSuccessMessage(`Đã phát hành thông báo đến ${count} nhân viên.`);
            fetchTasks();
          }}
        />
      )}

      {/* Tracking Announcement Modal */}
      {trackingTaskId && (
        <AnnouncementTrackingModal
          taskId={trackingTaskId}
          isOpen={!!trackingTaskId}
          onClose={() => setTrackingTaskId(null)}
        />
      )}
    </div>
  );
};
