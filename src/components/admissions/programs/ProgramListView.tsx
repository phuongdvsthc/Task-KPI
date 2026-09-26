import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  History,
  Edit3,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Layers,
  Clock,
  Sparkles,
  ShieldCheck,
  Building2,
  Info,
  ChevronRight,
  HelpCircle,
  Loader2,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import {
  AdmissionGroup,
  AdmissionProgram,
  AdmissionTrainingLevel,
} from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';
import { useAuth } from '../../../context/AuthContext';
import { useSystemSettings } from '../../../context/SystemSettingsContext';
import { ProgramFormModal } from './ProgramFormModal';
import { ProgramAuditHistoryModal } from './ProgramAuditHistoryModal';

export const ProgramListView: React.FC = () => {
  const { isAdmin, systemRole, user } = useAuth();
  const { settings } = useSystemSettings();

  const [programs, setPrograms] = useState<AdmissionProgram[]>([]);
  const [groups, setGroups] = useState<AdmissionGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(isAdmin ? 'all' : 'active');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingProgram, setEditingProgram] = useState<AdmissionProgram | null>(null);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditTargetProgram, setAuditTargetProgram] = useState<AdmissionProgram | null>(null);

  // Status toggle confirmation
  const [confirmToggleProgram, setConfirmToggleProgram] = useState<AdmissionProgram | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Load Groups and Programs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Load admission groups
      const loadedGroups = await admissionFoundationService.getGroups();
      setGroups(loadedGroups);

      // 2. Load programs
      const loadedPrograms = await admissionFoundationService.getPrograms();
      setPrograms(loadedPrograms);
    } catch (err: any) {
      console.error('Error loading admission programs:', err);
      setErrorMessage(err.message || 'Không thể tải danh sách ngành/lớp tuyển sinh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast auto-dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Handle seeding sample data for STHC
  const handleSeedStandardData = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    setErrorMessage(null);
    try {
      const res = await admissionFoundationService.seedStandardPrograms();
      setSuccessToast(`Đã thiết lập thành công ${res.insertedCount} ngành/lớp chuẩn STHC!`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể nạp dữ liệu mẫu.');
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle toggle active status
  const handleConfirmToggleActive = async () => {
    if (!confirmToggleProgram || !isAdmin) return;
    setIsToggling(true);
    try {
      const newStatus = !confirmToggleProgram.is_active;
      await admissionFoundationService.toggleProgramActive(confirmToggleProgram.id, newStatus);
      setSuccessToast(
        newStatus
          ? `Đã kích hoạt lại ngành [${confirmToggleProgram.code}] ${confirmToggleProgram.name}`
          : `Đã ngừng sử dụng ngành [${confirmToggleProgram.code}] ${confirmToggleProgram.name}`
      );
      setConfirmToggleProgram(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to toggle program active status:', err);
      setErrorMessage(err.message || 'Không thể cập nhật trạng thái ngành/lớp.');
    } finally {
      setIsToggling(false);
    }
  };

  // Filtered Programs list
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      // Group filter
      if (selectedGroupId !== 'all' && p.group_id !== selectedGroupId) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'active' && !p.is_active) {
        return false;
      }
      if (selectedStatus === 'inactive' && p.is_active) {
        return false;
      }
      // Training level filter
      if (selectedLevel !== 'all' && p.training_level !== selectedLevel) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = p.code.toLowerCase().includes(q);
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = p.description ? p.description.toLowerCase().includes(q) : false;
        if (!codeMatch && !nameMatch && !descMatch) {
          return false;
        }
      }
      return true;
    });
  }, [programs, selectedGroupId, selectedStatus, selectedLevel, searchQuery]);

  // Summary Metrics calculations
  const totalCount = programs.length;
  const activeCount = programs.filter((p) => p.is_active).length;
  const inactiveCount = programs.filter((p) => !p.is_active).length;
  const tcCount = programs.filter((p) => p.group?.code === 'TRUNG_CAP' || p.training_level === 'trung_cap').length;
  const nhCount = programs.filter((p) => p.group?.code === 'NGAN_HAN' || p.training_level === 'ngan_han' || p.training_level === 'chung_chi').length;

  const getTrainingLevelBadge = (level?: AdmissionTrainingLevel) => {
    switch (level) {
      case 'trung_cap':
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/70">
            Trung cấp chính quy
          </span>
        );
      case 'ngan_han':
        return (
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200/70">
            Đào tạo ngắn hạn
          </span>
        );
      case 'chung_chi':
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/70">
            Chứng chỉ nghề
          </span>
        );
      case 'so_cap':
        return (
          <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 border border-cyan-200/70">
            Sơ cấp nghề
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
            {level || 'Chưa định nghĩa'}
          </span>
        );
    }
  };

  const getGroupBadge = (group?: AdmissionGroup) => {
    if (!group) return <span className="text-slate-400 text-xs">--</span>;
    if (group.code === 'TRUNG_CAP') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200/60">
          <BookOpen className="h-3 w-3 text-indigo-500" />
          {group.name}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
        <Layers className="h-3 w-3 text-emerald-500" />
        {group.name}
      </span>
    );
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div id="admission-program-catalog-view" className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div
          id="admission-catalog-toast-success"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-emerald-800 text-white px-5 py-3.5 shadow-xl ring-1 ring-emerald-600 transition-all animate-bounce"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <span className="text-sm font-medium">{successToast}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          id="admission-catalog-error-banner"
          className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200"
        >
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Lỗi hệ thống: </span>
            {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Danh mục ngành / lớp tuyển sinh
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý danh sách các ngành Trung cấp và khóa học Ngắn hạn phục vụ kế hoạch & kết quả tuyển sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="view-all-audit-history-btn"
            type="button"
            onClick={() => {
              setAuditTargetProgram(null);
              setIsAuditModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Lịch sử kiểm toán</span>
          </button>

          <button
            id="refresh-catalog-btn"
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {isAdmin && settings?.tenantCode === 'STHC' && (
            <>
              {programs.length === 0 && (
                <button
                  id="seed-standard-sthc-btn"
                  type="button"
                  onClick={handleSeedStandardData}
                  disabled={isSeeding || isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-violet-700 transition-colors disabled:opacity-60"
                >
                  {isSeeding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>Nạp 12 ngành chuẩn STHC</span>
                </button>
              )}

              <button
                id="create-new-program-btn"
                type="button"
                onClick={() => {
                  setEditingProgram(null);
                  setIsFormModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm ngành / lớp mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng danh mục</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-400">chương trình</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đang hoạt động</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
            <span className="text-xs text-slate-400">ngành/lớp</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ngừng sử dụng</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <PowerOff className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${inactiveCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {inactiveCount}
            </span>
            <span className="text-xs text-slate-400">tạm dừng</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Trung cấp (TC)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">{tcCount}</span>
            <span className="text-xs text-slate-400">ngành</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ngắn hạn (NH)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Layers className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600">{nhCount}</span>
            <span className="text-xs text-slate-400">khóa học</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="catalog-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã hoặc tên ngành..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9.5 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Group Filter */}
          <div>
            <select
              id="catalog-group-filter"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Tất cả nhóm tuyển sinh</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.name} ({grp.code})
                </option>
              ))}
            </select>
          </div>

          {/* Training Level Filter */}
          <div>
            <select
              id="catalog-level-filter"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Tất cả trình độ đào tạo</option>
              <option value="trung_cap">Trung cấp chính quy</option>
              <option value="ngan_han">Đào tạo ngắn hạn</option>
              <option value="chung_chi">Chứng chỉ nghề</option>
              <option value="so_cap">Sơ cấp nghề</option>
              <option value="khac">Khác / Liên kết</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="catalog-status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng sử dụng</option>
            </select>
          </div>
        </div>

        {/* Role & RLS notice banner for non-admins */}
        {!isAdmin && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-800 border border-amber-200/50">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Chế độ xem theo phân quyền vai trò ({systemRole}): Chỉ hiển thị các ngành/lớp đang hoạt động.
              Chỉ Quản trị viên (Admin) mới có quyền thêm mới, sửa đổi hoặc ngừng sử dụng danh mục.
            </span>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="text-sm font-medium text-slate-600">Đang tải danh mục ngành/lớp tuyển sinh...</span>
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Không tìm thấy ngành / lớp nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {programs.length === 0
                ? 'Hệ thống chưa có bản ghi ngành tuyển sinh nào trong cơ sở dữ liệu.'
                : 'Không có bản ghi nào phù hợp với bộ lọc tìm kiếm hiện tại.'}
            </p>
            {isAdmin && settings?.tenantCode === 'STHC' && programs.length === 0 && (
              <button
                type="button"
                onClick={handleSeedStandardData}
                disabled={isSeeding}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Nạp nhanh danh mục ngành mẫu STHC</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4">Mã ngành/lớp</th>
                  <th className="py-3 px-4">Tên ngành / lớp đào tạo</th>
                  <th className="py-3 px-4">Nhóm tuyển sinh</th>
                  <th className="py-3 px-4">Trình độ</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4 text-center">Thứ tự</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4">Cập nhật</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPrograms.map((program, index) => {
                  return (
                    <tr
                      key={program.id}
                      id={`catalog-program-row-${program.id}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* STT */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                        {index + 1}
                      </td>

                      {/* Mã ngành/lớp */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {program.code}
                        </span>
                      </td>

                      {/* Tên ngành & mô tả */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{program.name}</div>
                        {program.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {program.description}
                          </div>
                        )}
                      </td>

                      {/* Nhóm tuyển sinh */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getGroupBadge(program.group)}
                      </td>

                      {/* Trình độ đào tạo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getTrainingLevelBadge(program.training_level)}
                      </td>

                      {/* Thời gian đào tạo */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {program.duration ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {program.duration}
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>

                      {/* Thứ tự */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                        {program.sort_order}
                      </td>

                      {/* Trạng thái hoạt động */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isAdmin ? (
                          <button
                            type="button"
                            id={`toggle-active-btn-${program.id}`}
                            onClick={() => setConfirmToggleProgram(program)}
                            title={
                              program.is_active
                                ? 'Nhấn để tạm dừng / ngừng sử dụng ngành này'
                                : 'Nhấn để kích hoạt lại ngành này'
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              program.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {program.is_active ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Đang hoạt động</span>
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3 text-slate-400" />
                                <span>Ngừng sử dụng</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              program.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {program.is_active ? 'Đang hoạt động' : 'Ngừng sử dụng'}
                          </span>
                        )}
                      </td>

                      {/* Ngày cập nhật */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(program.updated_at || program.created_at)}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            id={`view-audit-history-btn-${program.id}`}
                            onClick={() => {
                              setAuditTargetProgram(program);
                              setIsAuditModalOpen(true);
                            }}
                            title="Xem nhật ký kiểm toán thay đổi"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                id={`edit-program-btn-${program.id}`}
                                onClick={() => {
                                  setEditingProgram(program);
                                  setIsFormModalOpen(true);
                                }}
                                title="Chỉnh sửa thông tin ngành"
                                className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                id={`toggle-power-btn-${program.id}`}
                                onClick={() => setConfirmToggleProgram(program)}
                                title={program.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'}
                                className={`rounded-lg p-1.5 transition-colors ${
                                  program.is_active
                                    ? 'text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {program.is_active ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
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

        {/* Table Footer / Summary */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-semibold text-slate-800">{filteredPrograms.length}</span> / {totalCount} ngành & lớp đào tạo
          </div>
        </div>
      </div>

      {/* Program Create/Edit Form Modal */}
      {isFormModalOpen && (
        <ProgramFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingProgram(null);
          }}
          onSuccess={(saved) => {
            setSuccessToast(
              editingProgram
                ? `Đã cập nhật thông tin ngành [${saved.code}] thành công!`
                : `Đã tạo mới ngành [${saved.code}] ${saved.name} thành công!`
            );
            loadData();
          }}
          initialData={editingProgram}
          groups={groups}
        />
      )}

      {/* Program Audit History Modal */}
      {isAuditModalOpen && (
        <ProgramAuditHistoryModal
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setAuditTargetProgram(null);
          }}
          program={auditTargetProgram}
        />
      )}

      {/* Status Toggle Confirmation Modal */}
      {confirmToggleProgram && (
        <div
          id="toggle-status-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div
            id="toggle-status-modal-container"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  confirmToggleProgram.is_active ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {confirmToggleProgram.is_active ? (
                  <PowerOff className="h-5 w-5" />
                ) : (
                  <Power className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {confirmToggleProgram.is_active ? 'Xác nhận ngừng sử dụng ngành' : 'Xác nhận kích hoạt lại ngành'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  [{confirmToggleProgram.code}] {confirmToggleProgram.name}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 mb-6">
              {confirmToggleProgram.is_active
                ? 'Khi chuyển sang "Ngừng sử dụng", ngành này sẽ tạm dừng chiêu sinh mới và bị ẩn khỏi danh sách của nhân viên và cán bộ khi lập kế hoạch tuyển sinh.'
                : 'Ngành này sẽ được kích hoạt lại và hiển thị đầy đủ trong danh mục tuyển sinh của các đơn vị.'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                id="cancel-toggle-status-btn"
                type="button"
                onClick={() => setConfirmToggleProgram(null)}
                disabled={isToggling}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                id="confirm-toggle-status-btn"
                type="button"
                onClick={handleConfirmToggleActive}
                disabled={isToggling}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors ${
                  confirmToggleProgram.is_active
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isToggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {confirmToggleProgram.is_active ? 'Xác nhận ngừng sử dụng' : 'Kích hoạt ngay'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
