import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  Target,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  BookOpen,
  Clock,
  Info,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  AdmissionGroup,
  AdmissionPlanStatus,
  AdmissionCampaign,
} from '../../../types/admission';
import { admissionPlanService } from '../../../services/admissionPlanService';
import { admissionFoundationService } from '../../../services/admissionService';
import { CampaignStatusModal } from '../campaigns/CampaignStatusModal';

export const CampaignAllocationView: React.FC = () => {
  const { user, systemRole, isAdmin, primaryUnit } = useAuth();

  const isManager = systemRole === 'manager';
  const isStaff = systemRole === 'staff' || (!isAdmin && systemRole !== 'executive' && !isManager);

  // Master Data
  const [groups, setGroups] = useState<AdmissionGroup[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Scope Filters
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    isManager && primaryUnit?.id ? primaryUnit.id : 'all'
  );

  // Allocation Data state
  const [annualPlan, setAnnualPlan] = useState<any | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignPlansMap, setCampaignPlansMap] = useState<Map<string, any>>(new Map());
  const [summary, setSummary] = useState<{
    annualTarget: number;
    allocatedTarget: number;
    remaining: number;
    allocatedCampaignsCount: number;
    totalEligibleCampaigns: number;
    status: 'Chưa phân bổ' | 'Đang phân bổ' | 'Đã phân bổ đủ' | 'Vượt kế hoạch';
  }>({
    annualTarget: 0,
    allocatedTarget: 0,
    remaining: 0,
    allocatedCampaignsCount: 0,
    totalEligibleCampaigns: 0,
    status: 'Chưa phân bổ',
  });

  // Local inputs state: campaign_id -> { target_paid_count: string; notes: string }
  const [allocationInputs, setAllocationInputs] = useState<Record<string, { target_paid_count: string; notes: string }>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Status Modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetCampaign, setStatusTargetCampaign] = useState<AdmissionCampaign | null>(null);

  // Load groups & units on mount
  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [loadedGroups, loadedUnits] = await Promise.all([
          admissionFoundationService.getGroups(),
          admissionFoundationService.getOrganizationUnits(),
        ]);
        setGroups(loadedGroups);
        setUnits(loadedUnits);
        if (loadedGroups.length > 0 && !selectedGroupId) {
          // Default to TRUNG_CAP if available
          const tc = loadedGroups.find((g) => g.code === 'TRUNG_CAP');
          setSelectedGroupId(tc ? tc.id : loadedGroups[0].id);
        }
      } catch (err) {
        console.warn('Could not load master data:', err);
      }
    };
    loadMaster();
  }, [selectedGroupId]);

  // Load allocation data when scope changes
  const loadAllocationData = useCallback(async () => {
    if (!selectedGroupId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const unitParam = selectedUnitId === 'all' ? null : selectedUnitId;
      const res = await admissionPlanService.getCampaignAllocationData(
        selectedYear,
        selectedGroupId,
        unitParam
      );

      setAnnualPlan(res.annualPlan);
      setCampaigns(res.campaigns);
      setCampaignPlansMap(res.campaignPlansMap);
      setSummary(res.summary);

      // Initialize inputs map from existing campaign plans
      const initialInputs: Record<string, { target_paid_count: string; notes: string }> = {};
      for (const camp of res.campaigns) {
        const existingPlan = res.campaignPlansMap.get(camp.id);
        initialInputs[camp.id] = {
          target_paid_count: existingPlan ? String(existingPlan.target_paid_count ?? '') : '',
          notes: existingPlan?.notes || '',
        };
      }
      setAllocationInputs(initialInputs);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tải dữ liệu phân bổ theo đợt.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedGroupId, selectedUnitId]);

  useEffect(() => {
    loadAllocationData();
  }, [loadAllocationData]);

  // Toast timer
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Handle input change
  const handleInputChange = (campaignId: string, field: 'target_paid_count' | 'notes', value: string) => {
    setAllocationInputs((prev) => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || { target_paid_count: '', notes: '' }),
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Compute live summary based on local inputs
  const liveSummary = useMemo(() => {
    let allocated = 0;
    let count = 0;
    for (const campId of Object.keys(allocationInputs)) {
      const val = Number(allocationInputs[campId]?.target_paid_count) || 0;
      if (val > 0) {
        allocated += val;
        count++;
      }
    }
    const annualTarget = annualPlan ? Number(annualPlan.target_paid_count) || 0 : 0;
    const remaining = annualTarget - allocated;
    let status: 'Chưa phân bổ' | 'Đang phân bổ' | 'Đã phân bổ đủ' | 'Vượt kế hoạch' = 'Chưa phân bổ';
    if (allocated === 0) status = 'Chưa phân bổ';
    else if (allocated < annualTarget) status = 'Đang phân bổ';
    else if (allocated === annualTarget) status = 'Đã phân bổ đủ';
    else status = 'Vượt kế hoạch';

    return {
      annualTarget,
      allocatedTarget: allocated,
      remaining,
      allocatedCampaignsCount: count,
      totalEligibleCampaigns: campaigns.length,
      status,
    };
  }, [allocationInputs, annualPlan, campaigns.length]);

  // Save Draft handler
  const handleSaveDraft = async () => {
    if (!annualPlan) {
      setErrorMessage('Chưa có kế hoạch năm. Không thể lưu phân bổ.');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const allocations = campaigns.map((camp) => ({
        campaign_id: camp.id,
        target_paid_count: Number(allocationInputs[camp.id]?.target_paid_count) || 0,
        notes: allocationInputs[camp.id]?.notes || '',
      })).filter((item) => item.target_paid_count > 0);

      const unitParam = selectedUnitId === 'all' ? null : selectedUnitId;
      const res = await admissionPlanService.saveCampaignAllocations(
        {
          admission_year: selectedYear,
          group_id: selectedGroupId,
          unit_id: unitParam,
          allocations,
        },
        user?.id
      );

      setSuccessToast(res.message);
      setHasUnsavedChanges(false);
      await loadAllocationData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu phân bổ nháp.');
    } finally {
      setIsSaving(false);
    }
  };

  // Complete Allocation handler
  const handleCompleteAllocation = async () => {
    if (!annualPlan) return;
    if (liveSummary.allocatedTarget !== liveSummary.annualTarget) {
      setErrorMessage(`Tổng phân bổ (${liveSummary.allocatedTarget.toLocaleString('vi-VN')}) phải bằng đúng chỉ tiêu kế hoạch năm (${liveSummary.annualTarget.toLocaleString('vi-VN')}) để hoàn tất.`);
      return;
    }

    setIsCompleting(true);
    setErrorMessage(null);

    try {
      // First save draft to ensure DB has latest
      const allocations = campaigns.map((camp) => ({
        campaign_id: camp.id,
        target_paid_count: Number(allocationInputs[camp.id]?.target_paid_count) || 0,
        notes: allocationInputs[camp.id]?.notes || '',
      })).filter((item) => item.target_paid_count > 0);

      const unitParam = selectedUnitId === 'all' ? null : selectedUnitId;
      await admissionPlanService.saveCampaignAllocations(
        {
          admission_year: selectedYear,
          group_id: selectedGroupId,
          unit_id: unitParam,
          allocations,
        },
        user?.id
      );

      const res = await admissionPlanService.completeCampaignAllocations(
        {
          admission_year: selectedYear,
          group_id: selectedGroupId,
          unit_id: unitParam,
        },
        user?.id
      );

      setSuccessToast(res.message);
      setHasUnsavedChanges(false);
      await loadAllocationData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi hoàn tất phân bổ.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Delete / Reset allocations handler
  const handleDeleteAllocations = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu phân bổ kế hoạch theo đợt cho nhóm này không? Hành động này sẽ đặt lại tất cả chỉ tiêu phân bổ và cho phép bạn chỉnh sửa lại các đợt tuyển sinh.')) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const unitParam = selectedUnitId === 'all' ? null : selectedUnitId;
      const res = await admissionPlanService.deleteCampaignAllocations(
        selectedYear,
        selectedGroupId,
        unitParam
      );
      setSuccessToast(`Đã xóa thành công ${res.deletedCount} bản ghi phân bổ kế hoạch theo đợt.`);
      await loadAllocationData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể xóa dữ liệu phân bổ đợt.');
      setIsLoading(false);
    }
  };

  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const isTrungCapGroup = currentGroup?.code === 'TRUNG_CAP';

  return (
    <div id="campaign-allocation-view" className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">Phân bổ kế hoạch theo đợt tuyển sinh</h3>
        </div>
        <p className="text-xs text-slate-500">
          Phân bổ chỉ tiêu học viên đóng học phí từ kế hoạch năm xuống từng đợt tuyển sinh tương ứng trong năm.
        </p>
      </div>

      {/* Scope Selector Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Year Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Năm tuyển sinh</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value={2026}>Năm 2026</option>
            <option value={2027}>Năm 2027</option>
            <option value={2028}>Năm 2028</option>
            <option value={2029}>Năm 2029</option>
            <option value={2030}>Năm 2030</option>
          </select>
        </div>

        {/* Group Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Nhóm tuyển sinh</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.code})
              </option>
            ))}
          </select>
        </div>

        {/* Unit Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị phụ trách</label>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            disabled={isManager}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          >
            {isAdmin && <option value="all">Toàn trường (Tất cả đơn vị)</option>}
            <option value="none">Không gắn đơn vị cụ thể (Chung)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold">Lỗi phân bổ:</strong>
              <p className="mt-0.5 font-medium">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAllocationData}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 border border-rose-300 hover:bg-rose-50"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Warning if no annual plan */}
      {!isLoading && !annualPlan && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-2xs flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Chưa có kế hoạch năm cho nhóm này</h4>
            <p className="text-xs text-amber-800">
              Bạn cần tạo kế hoạch tuyển sinh cấp năm cho nhóm <strong>{currentGroup?.name || 'này'}</strong> năm <strong>{selectedYear}</strong> trước khi thực hiện phân bổ chỉ tiêu theo đợt.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards Grid (Section 9) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Kế hoạch năm */}
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900/70">
              Kế hoạch năm
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {liveSummary.annualTarget.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">học viên</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {annualPlan ? `Trạng thái: ${annualPlan.status}` : 'Chưa thiết lập'}
          </p>
        </div>

        {/* Card 2: Đã phân bổ */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900/70">
              Đã phân bổ
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {liveSummary.allocatedTarget.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">học viên</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {liveSummary.allocatedCampaignsCount}/{liveSummary.totalEligibleCampaigns} đợt được giao
          </p>
        </div>

        {/* Card 3: Còn lại */}
        <div className={`rounded-2xl border p-5 shadow-2xs ${liveSummary.remaining < 0 ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${liveSummary.remaining < 0 ? 'text-rose-900' : 'text-slate-700'}`}>
              Còn lại
            </span>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${liveSummary.remaining < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${liveSummary.remaining < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {liveSummary.remaining.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-slate-500">học viên</span>
          </div>
          <p className={`text-[11px] mt-2 font-medium ${liveSummary.remaining < 0 ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
            {liveSummary.remaining < 0 ? 'Vượt chỉ tiêu kế hoạch năm!' : 'Số chỉ tiêu chưa phân bổ'}
          </p>
        </div>

        {/* Card 4: Trạng thái phân bổ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
              Trạng thái
            </span>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  liveSummary.status === 'Đã phân bổ đủ'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : liveSummary.status === 'Vượt kế hoạch'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : liveSummary.status === 'Đang phân bổ'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {liveSummary.status}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {annualPlan ? `Kế hoạch năm: ${annualPlan.admission_year}` : 'Chưa có kế hoạch'}
          </p>
        </div>
      </div>

      {/* Campaign Allocation Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">Danh sách đợt và phân bổ chỉ tiêu</h4>
          </div>

          {!isStaff && annualPlan && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteAllocations}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 disabled:opacity-50 transition-colors"
                title="Xóa toàn bộ dữ liệu phân bổ để sửa lại đợt tuyển sinh"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xóa phân bổ đợt</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving || !hasUnsavedChanges}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Save className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteAllocation}
                disabled={isCompleting || liveSummary.allocatedTarget !== liveSummary.annualTarget}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                title={liveSummary.allocatedTarget !== liveSummary.annualTarget ? 'Tổng phân bổ phải bằng đúng kế hoạch năm mới có thể hoàn tất' : ''}
              >
                <Check className={`h-4 w-4 ${isCompleting ? 'animate-spin' : ''}`} />
                <span>Hoàn tất phân bổ</span>
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Đang tải danh sách đợt tuyển sinh...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Không có đợt tuyển sinh nào cho nhóm <strong>{currentGroup?.name}</strong> năm <strong>{selectedYear}</strong>.
            <div className="mt-2 text-slate-400">
              Vui lòng tạo đợt tuyển sinh tại tab <strong>Đợt tuyển sinh</strong> trước.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">STT</th>
                  <th className="py-3 px-4">Mã đợt</th>
                  <th className="py-3 px-4">Tên đợt tuyển sinh</th>
                  <th className="py-3 px-4">Thời gian / Khai giảng</th>
                  <th className="py-3 px-4">Trạng thái đợt</th>
                  <th className="py-3 px-4 text-right">Kế hoạch đợt (Học viên)</th>
                  <th className="py-3 px-4">Trạng thái kế hoạch</th>
                  <th className="py-3 px-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {campaigns.map((camp, index) => {
                  const existingPlan = campaignPlansMap.get(camp.id);
                  const inputVal = allocationInputs[camp.id]?.target_paid_count ?? '';
                  const noteVal = allocationInputs[camp.id]?.notes ?? '';
                  const planStatus = existingPlan?.status || 'draft';

                  return (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-500">#{index + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{camp.code}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{camp.name}</td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {camp.start_date ? new Date(camp.start_date).toLocaleDateString('vi-VN') : '--'}
                        {camp.end_date ? ` đến ${new Date(camp.end_date).toLocaleDateString('vi-VN')}` : ''}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              camp.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : camp.status === 'closed'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : camp.status === 'archived'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {camp.status === 'planning' ? 'Nháp' : camp.status === 'active' ? 'Đang tuyển' : camp.status === 'closed' ? 'Đã chốt' : camp.status === 'archived' ? 'Đã hủy' : camp.status}
                          </span>
                          {!isStaff && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusTargetCampaign(camp);
                                setIsStatusModalOpen(true);
                              }}
                              className="rounded-lg p-1 text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Điều chỉnh trạng thái đợt"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isStaff || !annualPlan}
                          value={inputVal}
                          onChange={(e) => handleInputChange(camp.id, 'target_paid_count', e.target.value)}
                          placeholder="0"
                          className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:opacity-75"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          disabled={isStaff || !existingPlan}
                          value={planStatus}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            if (!existingPlan?.id) {
                              setErrorMessage('Vui lòng lưu nháp phân bổ trước khi thay đổi trạng thái kế hoạch đợt.');
                              return;
                            }
                            try {
                              await admissionPlanService.updateCampaignPlanStatus(existingPlan.id, newStatus, user?.id);
                              setSuccessToast('Đã cập nhật trạng thái kế hoạch đợt thành công.');
                              await loadAllocationData();
                            } catch (err: any) {
                              setErrorMessage(err.message || 'Không thể cập nhật trạng thái kế hoạch đợt.');
                            }
                          }}
                          className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 ${
                            planStatus === 'assigned'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : planStatus === 'locked'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : planStatus === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="draft">Nháp</option>
                          <option value="assigned">Đã giao</option>
                          <option value="locked">Đã khóa</option>
                          <option value="cancelled">Đã hủy</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          disabled={isStaff || !annualPlan}
                          value={noteVal}
                          onChange={(e) => handleInputChange(camp.id, 'notes', e.target.value)}
                          placeholder="Ghi chú đợt..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>Quy tắc: Tổng phân bổ các đợt phải bằng đúng chỉ tiêu kế hoạch năm ({liveSummary.annualTarget.toLocaleString('vi-VN')} học viên).</span>
        {hasUnsavedChanges && (
          <span className="text-amber-600 font-bold">⚠️ Có thay đổi chưa được lưu. Hãy bấm "Lưu nháp".</span>
        )}
      </div>

      {/* Campaign Status Modal */}
      <CampaignStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusTargetCampaign(null);
        }}
        onSuccess={(updated) => {
          setSuccessToast(`Đã chuyển trạng thái đợt ${updated.code} thành công.`);
          loadAllocationData();
        }}
        campaign={statusTargetCampaign}
      />
    </div>
  );
};
