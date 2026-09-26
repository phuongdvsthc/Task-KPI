import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  Plus,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
  History,
  Edit2,
  XCircle,
  Search,
  BookOpen,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarDays,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useSystemSettings } from '../../../context/SystemSettingsContext';
import {
  AdmissionAnnualPlan,
  AdmissionGroup,
  AdmissionPlanStatus,
  AdmissionPlanFilters,
  AdmissionAnnualPlanSummary,
} from '../../../types/admission';
import { admissionPlanService } from '../../../services/admissionPlanService';
import { admissionFoundationService } from '../../../services/admissionService';
import { AnnualPlanFormModal } from './AnnualPlanFormModal';
import { AnnualPlanStatusModal, PlanStatusActionType } from './AnnualPlanStatusModal';
import { AnnualPlanAuditModal } from './AnnualPlanAuditModal';
import { CampaignAllocationView } from './CampaignAllocationView';

export const AnnualPlanListView: React.FC = () => {
  const { user, systemRole, isAdmin, primaryUnit } = useAuth();
  const { settings } = useSystemSettings();

  const isExecutive = systemRole === 'executive';
  const isManager = systemRole === 'manager';
  const isStaff = systemRole === 'staff' || (!isAdmin && !isExecutive && !isManager);

  // Subtab navigation within Plans
  const [activePlanTab, setActivePlanTab] = useState<'annual' | 'campaign'>('annual');

  // Master Data
  const [plans, setPlans] = useState<AdmissionAnnualPlan[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<AdmissionAnnualPlanSummary>({
    totalTarget: 0,
    trungCapTarget: 0,
    nganHanTarget: 0,
    draftCount: 0,
    assignedCount: 0,
    lockedCount: 0,
    cancelledCount: 0,
    totalPlansCount: 0,
  });
  const [groups, setGroups] = useState<AdmissionGroup[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(2026);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    isManager && primaryUnit?.id ? primaryUnit.id : 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<AdmissionAnnualPlan | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetPlan, setStatusTargetPlan] = useState<AdmissionAnnualPlan | null>(null);
  const [statusActionType, setStatusActionType] = useState<PlanStatusActionType>('assign');

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditTargetPlan, setAuditTargetPlan] = useState<AdmissionAnnualPlan | null>(null);

  // Load Groups & Units
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [loadedGroups, loadedUnits] = await Promise.all([
          admissionFoundationService.getGroups(),
          admissionFoundationService.getOrganizationUnits(),
        ]);
        setGroups(loadedGroups);
        setUnits(loadedUnits);
      } catch (err) {
        console.warn('Could not load groups/units master data:', err);
      }
    };
    loadMasterData();
  }, []);

  // Fetch Annual Plans
  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const filters: AdmissionPlanFilters = {};
      if (selectedYear !== 'all') filters.admission_year = selectedYear;
      if (selectedGroupId !== 'all') filters.group_id = selectedGroupId;
      if (selectedUnitId !== 'all') filters.unit_id = selectedUnitId;
      if (selectedStatus !== 'all') filters.status = selectedStatus as AdmissionPlanStatus;

      const result = await admissionPlanService.getAnnualPlans(filters, { page, pageSize });
      setPlans(result.plans);
      setTotalCount(result.totalCount);
      setSummary(result.summary);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tải danh sách kế hoạch tuyển sinh.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedGroupId, selectedUnitId, selectedStatus, page, pageSize]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Seed 2026 data handler
  const handleSeed2026Data = async () => {
    setIsSeeding(true);
    try {
      const res = await admissionPlanService.seedOfficial2026Plans(user?.id);
      setSuccessToast(res.message);
      await loadPlans();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi khởi tạo kế hoạch mẫu 2026.');
    } finally {
      setIsSeeding(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedYear(2026);
    setSelectedGroupId('all');
    setSelectedUnitId(isManager && primaryUnit?.id ? primaryUnit.id : 'all');
    setSelectedStatus('all');
    setSearchQuery('');
    setPage(1);
  };

  // Permission Checks
  const canCreate = isAdmin || (isManager && Boolean(primaryUnit?.id));

  const canEditPlan = (plan: AdmissionAnnualPlan) => {
    if (isAdmin) return true;
    if (isExecutive || isStaff) return false;
    if (isManager) {
      // Manager can edit unlocked plans in own unit
      if (plan.status === 'locked') return false;
      return plan.unit_id === primaryUnit?.id;
    }
    return false;
  };

  const canAssignPlan = (plan: AdmissionAnnualPlan) => {
    if (plan.status !== 'draft') return false;
    if (isAdmin) return true;
    if (isManager && plan.unit_id === primaryUnit?.id) return true;
    return false;
  };

  const canLockPlan = (plan: AdmissionAnnualPlan) => {
    if (plan.status === 'locked' || plan.status === 'cancelled') return false;
    // Only Admin can lock
    return isAdmin;
  };

  const canUnlockPlan = (plan: AdmissionAnnualPlan) => {
    if (plan.status !== 'locked') return false;
    // Only Admin can unlock
    return isAdmin;
  };

  const canCancelPlan = (plan: AdmissionAnnualPlan) => {
    if (plan.status === 'cancelled') return false;
    if (isAdmin) return true;
    if (isManager && plan.status !== 'locked' && plan.unit_id === primaryUnit?.id) return true;
    return false;
  };

  // Status Badge Helper
  const renderStatusBadge = (status: AdmissionPlanStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Nháp
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
            Đã giao
          </span>
        );
      case 'locked':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            <Lock className="h-3.5 w-3.5 text-purple-600" />
            Đã khóa
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5 text-rose-500" />
            Đã hủy
          </span>
        );
    }
  };

  // Group Badge Helper
  const renderGroupBadge = (group?: AdmissionGroup) => {
    if (!group) return <span className="text-slate-400 text-xs">--</span>;
    const isTrungCap = group.code === 'TRUNG_CAP';
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
          isTrungCap
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}
      >
        {isTrungCap ? <BookOpen className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        <span>{group.name}</span>
      </span>
    );
  };

  // Client-side search filter on top of loaded page or result
  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return plans;
    const q = searchQuery.toLowerCase().trim();
    return plans.filter((p) => {
      const gName = p.group?.name?.toLowerCase() || '';
      const uName = p.unit?.name?.toLowerCase() || '';
      const uCode = p.unit?.code?.toLowerCase() || '';
      const notes = p.notes?.toLowerCase() || '';
      const year = String(p.admission_year);
      return (
        gName.includes(q) ||
        uName.includes(q) ||
        uCode.includes(q) ||
        notes.includes(q) ||
        year.includes(q)
      );
    });
  }, [plans, searchQuery]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div id="annual-plan-module-container" className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div
          id="annual-plan-success-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-fade-in"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Subtabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Kế hoạch tuyển sinh</h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              Năm 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý và giao chỉ tiêu tuyển sinh cấp năm theo nhóm đào tạo và đơn vị phụ trách
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-refresh-annual-plans"
            type="button"
            onClick={loadPlans}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {/* Seed 2026 data button if plans table is currently empty */}
          {totalCount === 0 && !isLoading && (isAdmin || isManager) && settings?.tenantCode === 'STHC' && (
            <button
              id="btn-seed-2026-official-plans"
              type="button"
              onClick={handleSeed2026Data}
              disabled={isSeeding}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100 transition-colors"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Đang tạo...' : 'Khởi tạo kế hoạch 2026 (1.320)'}</span>
            </button>
          )}

          {canCreate && (
            <button
              id="btn-open-create-annual-plan-modal"
              type="button"
              onClick={() => {
                setEditingPlan(null);
                setIsFormModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm kế hoạch năm</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtab Toggle (Annual Plan vs Campaign Allocation) */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          id="tab-btn-annual-plan"
          type="button"
          onClick={() => setActivePlanTab('annual')}
          className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${
            activePlanTab === 'annual'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Kế hoạch năm</span>
        </button>

        <button
          id="tab-btn-campaign-allocation"
          type="button"
          onClick={() => setActivePlanTab('campaign')}
          className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${
            activePlanTab === 'campaign'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span>Phân bổ theo đợt</span>
        </button>
      </div>

      {activePlanTab === 'campaign' ? (
        <CampaignAllocationView />
      ) : (
        <>
          {/* Error Alert */}
          {errorMessage && (
        <div
          id="annual-plan-error-banner"
          className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold">Đã xảy ra lỗi:</strong>
              <p className="mt-0.5 font-medium">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadPlans}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 border border-rose-300 hover:bg-rose-50"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Summary Cards Grid (Section 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng chỉ tiêu toàn trường */}
        <div
          id="summary-card-total-target"
          className="rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50/50 via-white to-indigo-50/20 p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900/70">
              Tổng chỉ tiêu năm
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {summary.totalTarget.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">học viên</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Chỉ tiêu học viên đóng học phí thực tế (tính tự động từ các nhóm, không gồm kế hoạch đã hủy)
          </p>
        </div>

        {/* Card 2: Trung cấp */}
        <div
          id="summary-card-trung-cap-target"
          className="rounded-2xl border border-blue-100 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900/70">
              Kế hoạch Trung cấp
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-950 font-mono tracking-tight">
              {summary.trungCapTarget.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">chỉ tiêu</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Mục tiêu năm 2026: <strong>570</strong> học viên đã chốt
          </p>
        </div>

        {/* Card 3: Đào tạo ngắn hạn */}
        <div
          id="summary-card-ngan-han-target"
          className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900/70">
              Kế hoạch Ngắn hạn
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-950 font-mono tracking-tight">
              {summary.nganHanTarget.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">chỉ tiêu</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Mục tiêu năm 2026: <strong>750</strong> học viên đã chốt
          </p>
        </div>

        {/* Card 4: Tiến độ giao chỉ tiêu */}
        <div
          id="summary-card-status-progress"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Tiến độ phê duyệt
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Đã giao</span>
              <strong className="text-blue-700 text-base font-mono">{summary.assignedCount}</strong>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Đã khóa</span>
              <strong className="text-purple-700 text-base font-mono">{summary.lockedCount}</strong>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Nháp</span>
              <strong className="text-slate-700 text-base font-mono">{summary.draftCount}</strong>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Tổng số bản ghi: <strong>{summary.totalPlansCount}</strong> (Đã hủy: {summary.cancelledCount})
          </p>
        </div>
      </div>

      {/* Filter Bar (Section 7) */}
      <div
        id="annual-plan-filters-bar"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Năm tuyển sinh</label>
            <select
              id="filter-annual-plan-year"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              <option value="2026">Năm 2026</option>
              <option value="2027">Năm 2027</option>
              <option value="2028">Năm 2028</option>
              <option value="2029">Năm 2029</option>
              <option value="2030">Năm 2030</option>
              <option value="all">Tất cả các năm</option>
            </select>
          </div>

          {/* Group Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Nhóm tuyển sinh</label>
            <select
              id="filter-annual-plan-group"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Tất cả nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Đơn vị phụ trách</label>
            <select
              id="filter-annual-plan-unit"
              value={selectedUnitId}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                setPage(1);
              }}
              disabled={isManager && Boolean(primaryUnit?.id)}
              className={`w-full rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none ${
                isManager && primaryUnit?.id ? 'bg-slate-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="all">Tất cả đơn vị</option>
              <option value="none">Chung toàn trường (Chưa gán)</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Trạng thái</label>
            <select
              id="filter-annual-plan-status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="assigned">Đã giao</option>
              <option value="locked">Đã khóa</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              id="btn-reset-annual-plan-filters"
              type="button"
              onClick={handleResetFilters}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>

        {/* Keyword Search Row */}
        <div className="relative pt-1">
          <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            id="search-annual-plans-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh theo tên nhóm, mã/tên đơn vị hoặc ghi chú..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table Card (Section 9) */}
      <div
        id="annual-plan-table-card"
        className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Năm</th>
                <th className="py-3 px-4">Nhóm tuyển sinh</th>
                <th className="py-3 px-4">Đơn vị phụ trách</th>
                <th className="py-3 px-4 text-right">Kế hoạch số học viên đóng học phí</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4">Người duyệt / Giao</th>
                <th className="py-3 px-4">Cập nhật lúc</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 w-12 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 w-28 rounded-lg bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 w-16 ml-auto rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-6 w-20 mx-auto rounded-full bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-7 w-20 mx-auto rounded bg-slate-200" />
                    </td>
                  </tr>
                ))
              ) : filteredPlans.length === 0 ? (
                // Empty / No Results State
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                      <Target className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {searchQuery
                        ? 'Không tìm thấy kế hoạch phù hợp với từ khóa'
                        : 'Chưa có kế hoạch tuyển sinh nào'}
                    </h4>
                    <p className="mx-auto max-w-sm text-xs text-slate-500 mt-1">
                      {searchQuery
                        ? 'Vui lòng kiểm tra lại bộ lọc hoặc thử từ khóa tìm kiếm khác.'
                        : 'Chưa có chỉ tiêu cấp năm nào được thiết lập. Hãy bấm "+ Thêm kế hoạch năm" hoặc khởi tạo dữ liệu chuẩn 2026.'}
                    </p>
                    {canCreate && !searchQuery && (
                      <div className="mt-4 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlan(null);
                            setIsFormModalOpen(true);
                          }}
                          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
                        >
                          + Thêm kế hoạch năm mới
                        </button>
                        {settings?.tenantCode === 'STHC' && (
                          <button
                            type="button"
                            onClick={handleSeed2026Data}
                            disabled={isSeeding}
                            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            Khởi tạo kế hoạch 2026 (1.320)
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                // Data Rows
                filteredPlans.map((plan) => {
                  const isPlanCancelled = plan.status === 'cancelled';
                  return (
                    <tr
                      key={plan.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isPlanCancelled ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      {/* Year */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {plan.admission_year}
                      </td>

                      {/* Group */}
                      <td className="py-3.5 px-4">{renderGroupBadge(plan.group)}</td>

                      {/* Unit */}
                      <td className="py-3.5 px-4">
                        {plan.unit ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{plan.unit.name}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                              {plan.unit.code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Chung toàn trường
                          </span>
                        )}
                      </td>

                      {/* Target Paid Count */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-extrabold text-sm text-slate-900">
                          {plan.target_paid_count.toLocaleString('vi-VN')}
                        </div>
                        <span className="text-[10px] text-slate-400">học viên đóng học phí</span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {!isStaff && !isExecutive && (plan.status !== 'locked' || isAdmin) ? (
                          <select
                            value={plan.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as AdmissionPlanStatus;
                              if (newStatus === plan.status) return;
                              try {
                                if (!user?.id) {
                                  setErrorMessage('Không xác định được người dùng.');
                                  return;
                                }
                                if (newStatus === 'cancelled') {
                                  const reason = prompt('Nhập lý do hủy kế hoạch năm:');
                                  if (!reason || !reason.trim()) return;
                                  await admissionPlanService.cancelPlan(plan.id, reason.trim(), user.id);
                                } else {
                                  const reason = (newStatus === 'draft' || newStatus === 'assigned') ? prompt('Nhập lý do thay đổi trạng thái (tùy chọn):') || undefined : undefined;
                                  await admissionPlanService.transitionPlanStatus(plan.id, newStatus, user.id, reason);
                                }
                                setSuccessToast('Đã cập nhật trạng thái kế hoạch năm thành công.');
                                loadPlans();
                              } catch (err: any) {
                                setErrorMessage(err.message || 'Không thể cập nhật trạng thái kế hoạch.');
                              }
                            }}
                            className={`rounded-xl border px-2.5 py-1 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                              plan.status === 'assigned'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : plan.status === 'locked'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : plan.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Bấm để điều chỉnh trạng thái kế hoạch"
                          >
                            <option value="draft">Nháp</option>
                            <option value="assigned">Đã giao</option>
                            <option value="locked">Đã khóa</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>
                        ) : (
                          renderStatusBadge(plan.status)
                        )}
                      </td>

                      {/* Approver */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {plan.approved_by ? (
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {plan.approver?.full_name || 'Quản trị viên'}
                            </span>
                            {plan.approved_at && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(plan.approved_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Chưa duyệt</span>
                        )}
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                        {new Date(plan.updated_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Button */}
                          {canEditPlan(plan) && (
                            <button
                              id={`btn-edit-plan-${plan.id.slice(0, 8)}`}
                              type="button"
                              onClick={() => {
                                setEditingPlan(plan);
                                setIsFormModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                              title="Chỉnh sửa chỉ tiêu và ghi chú"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Assign Button (draft -> assigned) */}
                          {canAssignPlan(plan) && (
                            <button
                              id={`btn-assign-plan-${plan.id.slice(0, 8)}`}
                              type="button"
                              onClick={() => {
                                setStatusTargetPlan(plan);
                                setStatusActionType('assign');
                                setIsStatusModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Giao chỉ tiêu chính thức"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Lock Button (assigned -> locked) */}
                          {canLockPlan(plan) && (
                            <button
                              id={`btn-lock-plan-${plan.id.slice(0, 8)}`}
                              type="button"
                              onClick={() => {
                                setStatusTargetPlan(plan);
                                setStatusActionType('lock');
                                setIsStatusModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 transition-colors"
                              title="Khóa kế hoạch"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Unlock Button (locked -> assigned/draft) */}
                          {canUnlockPlan(plan) && (
                            <button
                              id={`btn-unlock-plan-${plan.id.slice(0, 8)}`}
                              type="button"
                              onClick={() => {
                                setStatusTargetPlan(plan);
                                setStatusActionType('unlock');
                                setIsStatusModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Mở khóa kế hoạch"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Cancel Button */}
                          {canCancelPlan(plan) && (
                            <button
                              id={`btn-cancel-plan-${plan.id.slice(0, 8)}`}
                              type="button"
                              onClick={() => {
                                setStatusTargetPlan(plan);
                                setStatusActionType('cancel');
                                setIsStatusModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hủy kế hoạch"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Audit History Button */}
                          <button
                            id={`btn-audit-plan-${plan.id.slice(0, 8)}`}
                            type="button"
                            onClick={() => {
                              setAuditTargetPlan(plan);
                              setIsAuditModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                            title="Xem lịch sử thay đổi"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-slate-50/50">
          <div className="text-xs text-slate-500 font-medium">
            Hiển thị <strong>{filteredPlans.length}</strong> / <strong>{totalCount}</strong> kế hoạch
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value={5}>5 bản ghi/trang</option>
              <option value={10}>10 bản ghi/trang</option>
              <option value={20}>20 bản ghi/trang</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Form Modal (Add / Edit) */}
      <AnnualPlanFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingPlan(null);
        }}
        onSuccess={(savedPlan) => {
          setSuccessToast(
            editingPlan
              ? 'Đã cập nhật kế hoạch tuyển sinh thành công.'
              : 'Đã tạo kế hoạch tuyển sinh thành công.'
          );
          loadPlans();
        }}
        planToEdit={editingPlan}
        groups={groups}
        units={units}
        currentUserId={user?.id}
        userRole={systemRole || undefined}
        userUnitId={primaryUnit?.id}
        isAdmin={isAdmin}
      />

      {/* Status Transition Modal */}
      <AnnualPlanStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusTargetPlan(null);
        }}
        onSuccess={(updated) => {
          setSuccessToast('Đã cập nhật trạng thái kế hoạch thành công.');
          loadPlans();
        }}
        plan={statusTargetPlan}
        actionType={statusActionType}
        currentUserId={user?.id}
        isAdmin={isAdmin}
      />

      {/* Audit History Modal */}
      <AnnualPlanAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          setAuditTargetPlan(null);
        }}
        plan={auditTargetPlan}
      />
    </div>
  );
};
