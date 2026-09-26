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
  CalendarDays,
  Layers,
  Clock,
  ShieldCheck,
  Building2,
  Info,
  ChevronRight,
  HelpCircle,
  Loader2,
  RotateCcw,
  Eye,
  Tag,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import {
  AdmissionGroup,
  AdmissionCampaign,
  AdmissionCampaignStatus,
} from '../../../types/admission';
import { admissionFoundationService } from '../../../services/admissionService';
import { useAuth } from '../../../context/AuthContext';
import { CampaignFormModal } from './CampaignFormModal';
import { CampaignStatusModal } from './CampaignStatusModal';
import { CampaignDetailModal } from './CampaignDetailModal';
import { CampaignAuditModal } from './CampaignAuditModal';

export const CampaignListView: React.FC = () => {
  const { isAdmin, isExecutiveOrAdmin, systemRole, user, primaryUnit } = useAuth();
  const isExecutive = systemRole === 'executive';
  const isManager = systemRole === 'manager';
  const isStaff = systemRole === 'staff';

  const [campaigns, setCampaigns] = useState<AdmissionCampaign[]>([]);
  const [groups, setGroups] = useState<AdmissionGroup[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(2026);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    isManager && primaryUnit?.id ? primaryUnit.id : 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedActive, setSelectedActive] = useState<string>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<AdmissionCampaign | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetCampaign, setStatusTargetCampaign] = useState<AdmissionCampaign | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailCampaign, setDetailCampaign] = useState<AdmissionCampaign | null>(null);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditTargetCampaign, setAuditTargetCampaign] = useState<AdmissionCampaign | null>(null);

  // Confirmation toggle active state
  const [confirmToggleCampaign, setConfirmToggleCampaign] = useState<AdmissionCampaign | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Permissions check
  const canCreate = isAdmin || isManager;
  const canEditItem = (c: AdmissionCampaign) => {
    if (isAdmin) return true;
    if (isExecutive) return false;
    if (isManager) {
      if (!c.unit_id) return true; // Common campaign or unit campaign
      return c.unit_id === primaryUnit?.id;
    }
    return false;
  };

  // Load Groups, Units & Campaigns
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Groups & Units
      const [loadedGroups, loadedUnits] = await Promise.all([
        admissionFoundationService.getGroups(),
        admissionFoundationService.getOrganizationUnits(),
      ]);
      setGroups(loadedGroups);
      setUnits(loadedUnits);

      // 2. Campaigns
      const filters: any = {};
      if (selectedYear !== 'all') filters.year = selectedYear;
      if (selectedGroupId !== 'all') filters.group_id = selectedGroupId;
      if (selectedStatus !== 'all') filters.status = selectedStatus;
      if (selectedActive !== 'all') filters.is_active = selectedActive === 'active';
      if (selectedUnitId !== 'all') filters.unit_id = selectedUnitId;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const loadedCampaigns = await admissionFoundationService.getCampaigns(filters);
      setCampaigns(loadedCampaigns);
    } catch (err: any) {
      console.error('Error loading admission campaigns:', err);
      setErrorMessage(err.message || 'Không thể tải danh sách đợt tuyển sinh.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedGroupId, selectedStatus, selectedActive, selectedUnitId, searchQuery]);

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

  // Toggle active state
  const handleToggleActive = async () => {
    if (!confirmToggleCampaign) return;
    setIsToggling(true);
    try {
      const nextActive = !confirmToggleCampaign.is_active;
      await admissionFoundationService.toggleCampaignActive(
        confirmToggleCampaign.id,
        nextActive,
        nextActive ? 'Kích hoạt lại đợt tuyển sinh' : 'Ngừng sử dụng đợt tuyển sinh'
      );
      setSuccessToast(
        nextActive
          ? `Đã kích hoạt lại đợt tuyển sinh "${confirmToggleCampaign.code}".`
          : `Đã chuyển đợt tuyển sinh "${confirmToggleCampaign.code}" sang ngừng sử dụng.`
      );
      setConfirmToggleCampaign(null);
      await loadData();
    } catch (err: any) {
      console.error('Error toggling campaign active state:', err);
      setErrorMessage(err.message || 'Không thể thay đổi trạng thái kích hoạt.');
    } finally {
      setIsToggling(false);
    }
  };

  // Filtered & Sorted in-memory
  const displayedCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (selectedYear !== 'all' && c.year !== selectedYear) return false;
      if (selectedGroupId !== 'all' && c.group_id !== selectedGroupId) return false;
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      if (selectedActive === 'active' && !c.is_active) return false;
      if (selectedActive === 'inactive' && c.is_active) return false;
      if (selectedUnitId !== 'all' && c.unit_id !== selectedUnitId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [campaigns, selectedYear, selectedGroupId, selectedStatus, selectedActive, selectedUnitId, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = campaigns.length;
    const activeRecruiting = campaigns.filter((c) => c.status === 'active' && c.is_active).length;
    const planningDraft = campaigns.filter((c) => c.status === 'planning').length;
    const closed = campaigns.filter((c) => c.status === 'closed').length;
    const inactive = campaigns.filter((c) => !c.is_active).length;
    return { total, activeRecruiting, planningDraft, closed, inactive };
  }, [campaigns]);

  // Status Badge Helper
  const renderStatusBadge = (status: AdmissionCampaignStatus) => {
    switch (status) {
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            Nháp
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Đang tuyển
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            Đã chốt
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div id="campaign-list-view" className="space-y-5">
      {/* Toast Notification */}
      {successToast && (
        <div
          id="campaign-toast-success"
          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          id="campaign-toast-error"
          className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Quản lý Đợt Tuyển sinh</h2>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    Chu kỳ tuyển sinh
                  </span>
                  {isExecutive && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Chỉ đọc (Ban giám hiệu)
                    </span>
                  )}
                  {isStaff && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Nhân viên (Chỉ đọc)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tạo và quản lý các đợt tuyển sinh theo năm, nhóm tuyển sinh và đơn vị; theo dõi trạng thái và lịch sử thay đổi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-refresh-campaigns"
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              id="btn-view-all-campaign-audit"
              type="button"
              onClick={() => {
                setAuditTargetCampaign(null);
                setIsAuditModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
              title="Xem toàn bộ lịch sử kiểm toán của phân hệ"
            >
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Lịch sử kiểm toán</span>
            </button>

            {canCreate && (
              <button
                id="btn-create-campaign"
                type="button"
                onClick={() => {
                  setEditingCampaign(null);
                  setIsFormModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo đợt mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
            <div className="text-slate-500 text-[11px] font-medium">Tổng số đợt</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">{metrics.total}</div>
          </div>
          <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-100">
            <div className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Đang tuyển
            </div>
            <div className="text-lg font-bold text-emerald-800 mt-0.5">{metrics.activeRecruiting}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
            <div className="text-slate-500 text-[11px] font-medium">Lên kế hoạch (Nháp)</div>
            <div className="text-lg font-bold text-slate-700 mt-0.5">{metrics.planningDraft}</div>
          </div>
          <div className="rounded-xl bg-blue-50/60 p-3 border border-blue-100">
            <div className="text-blue-700 text-[11px] font-medium">Đã chốt tuyển sinh</div>
            <div className="text-lg font-bold text-blue-800 mt-0.5">{metrics.closed}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
            <div className="text-slate-500 text-[11px] font-medium">Ngừng sử dụng</div>
            <div className="text-lg font-bold text-slate-600 mt-0.5">{metrics.inactive}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="search-campaigns-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã hoặc tên đợt tuyển sinh..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Year Filter */}
          <div>
            <select
              id="filter-campaign-year"
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">Tất cả các năm</option>
              <option value={2026}>Năm 2026</option>
              <option value={2027}>Năm 2027</option>
              <option value={2028}>Năm 2028</option>
              <option value={2029}>Năm 2029</option>
              <option value={2030}>Năm 2030</option>
            </select>
          </div>

          {/* Group Filter */}
          <div>
            <select
              id="filter-campaign-group"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
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
            <select
              id="filter-campaign-unit"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={isManager && !isAdmin}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
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
            <select
              id="filter-campaign-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="planning">Nháp (Lên kế hoạch)</option>
              <option value="active">Đang tuyển</option>
              <option value="closed">Đã chốt</option>
              <option value="archived">Đã hủy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table id="admission-campaigns-table" className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Mã & Nhóm</th>
                <th className="px-4 py-3.5">Tên đợt tuyển sinh</th>
                <th className="px-3 py-3.5 text-center">Năm & Đợt</th>
                <th className="px-4 py-3.5">Đơn vị phụ trách</th>
                <th className="px-4 py-3.5">Thời gian thực hiện</th>
                <th className="px-3 py-3.5 text-center">Trạng thái</th>
                <th className="px-3 py-3.5 text-center">Hoạt động</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600 mb-2" />
                    <span>Đang tải danh sách đợt tuyển sinh...</span>
                  </td>
                </tr>
              ) : displayedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <CalendarDays className="mx-auto h-9 w-9 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Không tìm thấy đợt tuyển sinh phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hãy thay đổi bộ lọc hoặc bấm nút "Tạo đợt mới" để thêm đợt tuyển sinh.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedCampaigns.map((camp) => {
                  const isPermitted = canEditItem(camp);
                  const isTrungCap = camp.code === 'NH-05.03' || camp.code?.startsWith('NH-') ? false : (camp.group?.code === 'TRUNG_CAP' || camp.group_id.includes('0001'));

                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Code & Group */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {camp.code}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 w-max rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              isTrungCap
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-teal-50 text-teal-700 border border-teal-100'
                            }`}
                          >
                            {isTrungCap ? 'Trung cấp' : 'Ngắn hạn'}
                          </span>
                        </div>
                      </td>

                      {/* Name & Description */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{camp.name}</div>
                        {camp.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {camp.description}
                          </div>
                        )}
                      </td>

                      {/* Year & Period */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-bold text-slate-800">{camp.year}</span>
                          <span className="text-[10px] text-slate-400">Đợt {camp.period_number}</span>
                        </div>
                      </td>

                      {/* Organization Unit */}
                      <td className="px-4 py-3.5 text-slate-600">
                        {camp.unit?.name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{camp.unit.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Toàn trường</span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div>
                            <span className="text-slate-400">Bắt đầu:</span> {camp.start_date || '—'}
                          </div>
                          <div>
                            <span className="text-slate-400">Kết thúc:</span> {camp.end_date || '—'}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center">
                        {renderStatusBadge(camp.status)}
                      </td>

                      {/* Is Active */}
                      <td className="px-3 py-3.5 text-center">
                        {camp.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Bật
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <XCircle className="h-3.5 w-3.5" />
                            Tắt
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setDetailCampaign(camp);
                              setIsDetailModalOpen(true);
                            }}
                            title="Xem chi tiết đợt tuyển sinh"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Status Transition */}
                          {isPermitted && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusTargetCampaign(camp);
                                setIsStatusModalOpen(true);
                              }}
                              title="Chuyển trạng thái đợt tuyển sinh"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {/* Edit */}
                          {isPermitted && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCampaign(camp);
                                setIsFormModalOpen(true);
                              }}
                              title="Chỉnh sửa đợt tuyển sinh"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Toggle Active */}
                          {isPermitted && (
                            <button
                              type="button"
                              onClick={() => setConfirmToggleCampaign(camp)}
                              title={camp.is_active ? 'Ngừng sử dụng đợt này' : 'Kích hoạt lại đợt này'}
                              className={`rounded-lg p-1.5 transition-colors ${
                                camp.is_active
                                  ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                                  : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                              }`}
                            >
                              {camp.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {/* Audit History */}
                          <button
                            type="button"
                            onClick={() => {
                              setAuditTargetCampaign(camp);
                              setIsAuditModalOpen(true);
                            }}
                            title="Xem lịch sử kiểm toán của đợt này"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          >
                            <History className="h-4 w-4" />
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

        {/* Table Footer / Counter */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 bg-slate-50/50">
          <div>
            Hiển thị <strong>{displayedCampaigns.length}</strong> / <strong>{campaigns.length}</strong> đợt tuyển sinh
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Hệ thống tuyển sinh & KPI</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CampaignFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingCampaign(null);
        }}
        onSuccess={(saved) => {
          setSuccessToast(
            editingCampaign
              ? `Đã cập nhật đợt tuyển sinh "${saved.code}" thành công.`
              : `Đã tạo mới đợt tuyển sinh "${saved.code}" thành công.`
          );
          loadData();
        }}
        initialData={editingCampaign}
        groups={groups}
        units={units}
        userUnitId={primaryUnit?.id}
        isManager={isManager}
        isAdmin={isAdmin}
      />

      <CampaignStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusTargetCampaign(null);
        }}
        onSuccess={(updated) => {
          setSuccessToast(`Đã chuyển trạng thái đợt "${updated.code}" thành công.`);
          loadData();
        }}
        campaign={statusTargetCampaign}
      />

      <CampaignDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailCampaign(null);
        }}
        campaign={detailCampaign}
        onEdit={(camp) => {
          setIsDetailModalOpen(false);
          setEditingCampaign(camp);
          setIsFormModalOpen(true);
        }}
        onChangeStatus={(camp) => {
          setIsDetailModalOpen(false);
          setStatusTargetCampaign(camp);
          setIsStatusModalOpen(true);
        }}
        onViewHistory={(camp) => {
          setIsDetailModalOpen(false);
          setAuditTargetCampaign(camp);
          setIsAuditModalOpen(true);
        }}
        canEdit={detailCampaign ? canEditItem(detailCampaign) : false}
      />

      <CampaignAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          setAuditTargetCampaign(null);
        }}
        campaign={auditTargetCampaign}
      />

      {/* Confirmation Modal for Toggle Active */}
      {confirmToggleCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-800">
                {confirmToggleCampaign.is_active
                  ? 'Xác nhận ngừng sử dụng đợt tuyển sinh'
                  : 'Xác nhận kích hoạt lại đợt tuyển sinh'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {confirmToggleCampaign.is_active ? (
                <>
                  Bạn có chắc chắn muốn ngừng sử dụng đợt tuyển sinh{' '}
                  <strong className="text-slate-800">{confirmToggleCampaign.code} ({confirmToggleCampaign.name})</strong>?
                  Đợt này sẽ bị ẩn khỏi các bộ lọc tuyển sinh mặc định.
                </>
              ) : (
                <>
                  Bạn có chắc muốn kích hoạt lại đợt tuyển sinh{' '}
                  <strong className="text-slate-800">{confirmToggleCampaign.code} ({confirmToggleCampaign.name})</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmToggleCampaign(null)}
                disabled={isToggling}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isToggling}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors ${
                  confirmToggleCampaign.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isToggling ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>{confirmToggleCampaign.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
