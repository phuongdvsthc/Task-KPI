/**
 * Result Entry View
 * Screen for entering admission results by campaign supporting manual_total and detail_sum modes.
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  ShieldAlert,
  ArrowRight,
  Layers,
  FileText,
  Download,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { admissionFoundationService, AdmissionFoundationService } from '../../../services/admissionService';
import { admissionResultService, CampaignResultData } from '../../../services/admissionResultService';
import { AdmissionGroup, AdmissionCampaign, AdmissionProgram, AdmissionResultItem } from '../../../types/admission';
import { exportCampaignResultDetailToExcel } from '../../../utils/admissionExcelExport';

export const ResultEntryView: React.FC = () => {
  const { systemRole, isAdmin, primaryUnit } = useAuth();

  // Filters state
  const [years] = useState<number[]>([2026, 2027, 2028, 2029, 2030]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [groups, setGroups] = useState<AdmissionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [units, setUnits] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [campaigns, setCampaigns] = useState<AdmissionCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // Data state
  const [campaignData, setCampaignData] = useState<CampaignResultData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Entry Mode: 'detail_sum' | 'manual_total'
  const [entryMode, setEntryMode] = useState<'detail_sum' | 'manual_total'>('detail_sum');

  // Manual total inputs
  const [manualRegistered, setManualRegistered] = useState<string>('');
  const [manualPaid, setManualPaid] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Detail items inputs: list of rows
  const [detailRows, setDetailRows] = useState<
    Array<{
      program_id: string;
      registered_count: string;
      paid_count: string;
      not_converted_note: string;
    }>
  >([]);

  // Mode switch confirmation modal state
  const [showModeSwitchModal, setShowModeSwitchModal] = useState<boolean>(false);
  const [pendingMode, setPendingMode] = useState<'detail_sum' | 'manual_total' | null>(null);

  // Load groups & units on mount
  useEffect(() => {
    const initMaster = async () => {
      try {
        const [loadedGroups, loadedUnits] = await Promise.all([
          admissionFoundationService.getGroups({ is_active: true }),
          admissionFoundationService.getOrganizationUnits(),
        ]);
        setGroups(loadedGroups);
        if (loadedGroups.length > 0 && selectedGroupId === 'all') {
          setSelectedGroupId(loadedGroups[0].id);
        }
        setUnits(loadedUnits);
      } catch (err: any) {
        console.error('Failed to init master data:', err);
      }
    };
    initMaster();
  }, []);

  // Load campaigns when year, group, or unit changes
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setIsLoading(true);
        const fetched = await admissionFoundationService.getCampaigns({
          year: selectedYear,
          group_id: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          unit_id: selectedUnitId !== 'all' ? selectedUnitId : undefined,
          is_active: true,
        });
        setCampaigns(fetched);
        if (fetched.length > 0) {
          // If current selected campaign is not in fetched list, pick the first one
          if (!fetched.some((c) => c.id === selectedCampaignId)) {
            setSelectedCampaignId(fetched[0].id);
          }
        } else {
          setSelectedCampaignId('');
          setCampaignData(null);
        }
      } catch (err: any) {
        setErrorMessage(`Không thể tải danh sách đợt tuyển sinh: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadCampaigns();
  }, [selectedYear, selectedGroupId, selectedUnitId]);

  // Load selected campaign full result data
  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignData(null);
      return;
    }
    const loadResultData = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await admissionResultService.getCampaignResultData(selectedCampaignId);
        setCampaignData(data);

        // Populate local form state from fetched data
        if (data.result) {
          setEntryMode(data.result.entry_mode as 'detail_sum' | 'manual_total');
          setManualRegistered(data.result.registered_count !== null ? String(data.result.registered_count) : '');
          setManualPaid(data.result.paid_count !== null ? String(data.result.paid_count) : '');
          setManualNotes(data.result.notes || '');
        } else {
          // Default to detail_sum if active programs exist, else manual_total
          setEntryMode('detail_sum');
          setManualRegistered('');
          setManualPaid('');
          setManualNotes('');
        }

        if (data.items && data.items.length > 0) {
          setDetailRows(
            data.items.map((it: any) => ({
              program_id: it.program_id,
              registered_count: it.registered_count !== null ? String(it.registered_count) : '',
              paid_count: it.paid_count !== null ? String(it.paid_count) : '',
              not_converted_note: it.not_converted_note || '',
            }))
          );
        } else {
          // Initialize with empty rows for active programs or empty list
          setDetailRows(
            data.activePrograms.slice(0, 5).map((p) => ({
              program_id: p.id,
              registered_count: '',
              paid_count: '',
              not_converted_note: '',
            }))
          );
        }
      } catch (err: any) {
        setErrorMessage(`Lỗi tải dữ liệu kết quả đợt: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadResultData();
  }, [selectedCampaignId]);

  // Handlers for Detail Rows
  const handleAddDetailRow = () => {
    if (!campaignData) return;
    const availablePrograms = campaignData.activePrograms;
    const existingIds = new Set(detailRows.map((r) => r.program_id));
    const nextProg = availablePrograms.find((p) => !existingIds.has(p.id)) || availablePrograms[0];

    setDetailRows([
      ...detailRows,
      {
        program_id: nextProg ? nextProg.id : '',
        registered_count: '',
        paid_count: '',
        not_converted_note: '',
      },
    ]);
  };

  const handleRemoveDetailRow = (index: number) => {
    const updated = [...detailRows];
    updated.splice(index, 1);
    setDetailRows(updated);
  };

  const handleDetailRowChange = (index: number, field: string, value: string) => {
    const updated = [...detailRows];
    updated[index] = { ...updated[index], [field]: value };
    setDetailRows(updated);
  };

  // Switch mode check
  const handleRequestSwitchMode = (targetMode: 'detail_sum' | 'manual_total') => {
    if (targetMode === entryMode) return;
    if (campaignData?.result) {
      setPendingMode(targetMode);
      setShowModeSwitchModal(true);
    } else {
      setEntryMode(targetMode);
    }
  };

  const confirmSwitchMode = () => {
    if (pendingMode) {
      setEntryMode(pendingMode);
    }
    setShowModeSwitchModal(false);
    setPendingMode(null);
  };

  // Save Handlers
  const handleSaveManualTotal = async () => {
    if (!selectedCampaignId) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const reg = manualRegistered.trim() === '' ? null : parseInt(manualRegistered, 10);
      const paid = manualPaid.trim() === '' ? null : parseInt(manualPaid, 10);

      const saved = await admissionResultService.saveManualTotal(
        selectedCampaignId,
        reg,
        paid,
        manualNotes
      );

      setSuccessMessage('Đã lưu kết quả tổng của đợt thành công (trạng thái: Nháp).');
      // Reload data
      const refreshed = await admissionResultService.getCampaignResultData(selectedCampaignId);
      setCampaignData(refreshed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu kết quả tổng.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDetailItems = async () => {
    if (!selectedCampaignId) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const formattedItems = detailRows
        .filter((r) => r.program_id && (r.registered_count.trim() !== '' || r.paid_count.trim() !== '' || r.not_converted_note.trim() !== ''))
        .map((r, idx) => ({
          program_id: r.program_id,
          registered_count: r.registered_count.trim() === '' ? null : parseInt(r.registered_count, 10),
          paid_count: r.paid_count.trim() === '' ? null : parseInt(r.paid_count, 10),
          not_converted_note: r.not_converted_note.trim() || null,
          sort_order: idx,
        }));

      const { result, items } = await admissionResultService.saveDetailItems(
        selectedCampaignId,
        formattedItems,
        manualNotes
      );

      setSuccessMessage('Đã lưu chi tiết ngành/lớp và tính lại tổng đợt thành công.');
      const refreshed = await admissionResultService.getCampaignResultData(selectedCampaignId);
      setCampaignData(refreshed);
      if (refreshed.result) {
        setEntryMode(refreshed.result.entry_mode as any);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu chi tiết kết quả.');
    } finally {
      setIsSaving(false);
    }
  };

  // D2 Lifecycle & History State
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [finalizeNote, setFinalizeNote] = useState<string>('');
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const canManage = isAdmin || systemRole === 'manager';
  const isFinalized = campaignData?.result?.data_status === 'finalized';

  const handleFinalizeSubmit = async () => {
    if (!campaignData?.result) return;
    try {
      setIsActionLoading(true);
      setErrorMessage(null);
      await admissionResultService.finalizeResult(campaignData.result.id, finalizeNote);
      setSuccessMessage('Đã chốt kết quả tuyển sinh thành công.');
      setShowFinalizeModal(false);
      setFinalizeNote('');
      const refreshed = await admissionResultService.getCampaignResultData(selectedCampaignId);
      setCampaignData(refreshed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể chốt kết quả.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReopenSubmit = async () => {
    if (!campaignData?.result) return;
    if (!reopenReason || reopenReason.trim().length < 5) {
      setErrorMessage('Lý do mở lại phải có ít nhất 5 ký tự.');
      return;
    }
    try {
      setIsActionLoading(true);
      setErrorMessage(null);
      await admissionResultService.reopenResult(campaignData.result.id, reopenReason);
      setSuccessMessage('Đã mở lại kết quả để chỉnh sửa.');
      setShowReopenModal(false);
      setReopenReason('');
      const refreshed = await admissionResultService.getCampaignResultData(selectedCampaignId);
      setCampaignData(refreshed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể mở lại kết quả.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!campaignData?.result) return;
    try {
      setIsActionLoading(true);
      const logs = await admissionResultService.getChangeHistory(campaignData.result.id);
      setHistoryLogs(logs);
      setShowHistoryModal(true);
    } catch (err: any) {
      setErrorMessage('Không thể tải lịch sử thay đổi.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!campaignData || isExporting) return;
    try {
      setIsExporting(true);
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      await exportCampaignResultDetailToExcel(campaignData, {
        groupName: selectedGroup?.name,
        year: selectedYear,
      });
    } catch (err: any) {
      console.error('Failed to export campaign result to Excel:', err);
      setErrorMessage('Không thể xuất báo cáo Excel: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  // Computed summary for current view
  const currentResult = campaignData?.result;
  const currentPlan = campaignData?.plan;

  const totalRegistered = currentResult?.registered_count ?? null;
  const totalPaid = currentResult?.paid_count ?? null;
  const totalUnpaid = totalRegistered !== null && totalPaid !== null ? totalRegistered - totalPaid : null;
  const conversionRate =
    totalRegistered !== null && totalRegistered > 0 && totalPaid !== null ? totalPaid / totalRegistered : null;
  const planTarget = currentPlan ? Number(currentPlan.target_paid_count) : null;
  const completionRate = planTarget !== null && planTarget > 0 && totalPaid !== null ? totalPaid / planTarget : null;

  return (
    <div id="admission-results-entry-view" className="space-y-6">
      {/* Top Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Kết quả tuyển sinh theo đợt</h2>
            <p className="text-sm text-slate-500 mt-1">
              Nhập và cập nhật kết quả hồ sơ đăng ký và đóng học phí theo đợt (hỗ trợ nhập tổng hoặc chi tiết ngành/lớp).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Year selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Năm tuyển sinh</label>
              <select
                id="filter-admission-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Group selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nhóm tuyển sinh</label>
              <select
                id="filter-admission-group"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="all">Tất cả nhóm</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Đơn vị phụ trách</label>
              <select
                id="filter-admission-unit"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="all">Toàn trường</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign selector */}
            <div className="min-w-[240px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Đợt tuyển sinh</label>
              <select
                id="filter-admission-campaign"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-sm font-bold text-indigo-900 focus:border-indigo-500 focus:outline-hidden"
              >
                {campaigns.length === 0 && <option value="">-- Không có đợt nào active --</option>}
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name} ({c.start_date || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="text-sm font-medium">Đang tải dữ liệu kết quả đợt...</span>
          </div>
        </div>
      ) : !campaignData ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">Chưa chọn đợt tuyển sinh hợp lệ</h3>
          <p className="text-sm text-slate-500 mt-1">Vui lòng chọn bộ lọc năm, nhóm và đợt tuyển sinh ở phía trên.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lifecycle Status & Action Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isFinalized ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {isFinalized ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isFinalized ? 'Đã chốt số liệu (Finalized)' : 'Đang cập nhật (Draft)'}
              </span>
              {currentResult?.finalized_at && (
                <span className="text-xs text-slate-500">
                  Chốt lúc: {new Date(currentResult.finalized_at).toLocaleString('vi-VN')}
                </span>
              )}
              {currentResult?.reopen_reason && (
                <span className="text-xs text-indigo-600 font-medium">
                  (Lý do mở lại: {currentResult.reopen_reason})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="export-single-campaign-excel"
                onClick={handleExportExcel}
                disabled={isExporting || !campaignData}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-2xs hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
                title="Xuất kết quả đợt tuyển sinh ra tệp Excel (.xlsx)"
              >
                <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
              </button>

              {currentResult && (
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span>Lịch sử thay đổi</span>
                </button>
              )}

              {!isFinalized && canManage && currentResult && (
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Chốt số liệu</span>
                </button>
              )}

              {isFinalized && canManage && (
                <button
                  type="button"
                  onClick={() => setShowReopenModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Mở lại để chỉnh sửa</span>
                </button>
              )}
            </div>
          </div>

          {/* Read-only warning banner if finalized */}
          {isFinalized && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 flex items-center gap-3">
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-sm">
                Kết quả đợt này đã được chốt (Finalized). Các trường nhập liệu bị khóa không cho chỉnh sửa trực tiếp. Để sửa đổi, người quản lý/Admin cần thực hiện thao tác "Mở lại để chỉnh sửa".
              </p>
            </div>
          )}

          {/* Campaign Info Card & Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Registered */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500">Hồ sơ Đăng ký</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {totalRegistered !== null ? totalRegistered.toLocaleString('vi-VN') : 'Chưa có dữ liệu'}
                </span>
              </div>
              <span className="mt-2 block text-xs text-slate-400">Tổng số lượng đăng ký trong đợt</span>
            </div>

            {/* Card 2: Paid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500">Đã đóng học phí</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {totalPaid !== null ? totalPaid.toLocaleString('vi-VN') : 'Chưa có dữ liệu'}
                </span>
              </div>
              <span className="mt-2 block text-xs text-slate-400">
                Chưa đóng:{' '}
                {totalUnpaid !== null ? totalUnpaid.toLocaleString('vi-VN') : 'Chưa có dữ liệu'}
              </span>
            </div>

            {/* Card 3: Conversion Rate */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500">Tỷ lệ chuyển đổi</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-600">
                  {conversionRate !== null ? `${(conversionRate * 100).toFixed(1)}%` : 'Chưa có dữ liệu'}
                </span>
              </div>
              <span className="mt-2 block text-xs text-slate-400">Đóng học phí / Đăng ký</span>
            </div>

            {/* Card 4: Plan Completion */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500">Hoàn thành kế hoạch đợt</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">
                  {completionRate !== null ? `${(completionRate * 100).toFixed(1)}%` : 'Chưa có kế hoạch'}
                </span>
              </div>
              <span className="mt-2 block text-xs text-slate-400">
                Chỉ tiêu đợt: {planTarget !== null ? planTarget.toLocaleString('vi-VN') : 'Chưa phân bổ'}
              </span>
            </div>
          </div>

          {/* Mode Selector & Status Header */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{campaignData.campaign.name}</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                    Trạng thái: Nháp (Draft)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mã đợt: {campaignData.campaign.code} | Thời gian: {campaignData.campaign.start_date || 'N/A'} đến{' '}
                  {campaignData.campaign.end_date || 'N/A'}
                </p>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => handleRequestSwitchMode('detail_sum')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  entryMode === 'detail_sum'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập chi tiết ngành/lớp
              </button>
              <button
                type="button"
                onClick={() => handleRequestSwitchMode('manual_total')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  entryMode === 'manual_total'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập tổng của đợt
              </button>
            </div>
          </div>

          {/* Mode Content Views */}
          {entryMode === 'detail_sum' ? (
            /* DETAIL SUM MODE VIEW */
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Chi tiết kết quả tuyển sinh theo ngành/lớp</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tổng số lượng đăng ký và đóng học phí của đợt sẽ được hệ thống tự động tính từ các dòng chi tiết bên dưới.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDetailRow}
                  className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm ngành / lớp</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">STT</th>
                      <th className="px-4 py-3 min-w-[220px]">Ngành / Lớp</th>
                      <th className="px-4 py-3 w-36 text-center">Hồ sơ đăng ký</th>
                      <th className="px-4 py-3 w-36 text-center">Đóng học phí</th>
                      <th className="px-4 py-3 w-28 text-center">Chưa đóng</th>
                      <th className="px-4 py-3 w-28 text-center">Chuyển đổi</th>
                      <th className="px-4 py-3 min-w-[180px]">Ghi chú chưa chuyển đổi</th>
                      <th className="px-4 py-3 text-center w-16">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {detailRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-xs">
                          Chưa có dòng chi tiết ngành/lớp nào. Nhấn "Thêm ngành / lớp" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      detailRows.map((row, index) => {
                        const reg = row.registered_count.trim() === '' ? null : parseInt(row.registered_count, 10);
                        const paid = row.paid_count.trim() === '' ? null : parseInt(row.paid_count, 10);
                        const unpaid = reg !== null && paid !== null ? reg - paid : null;
                        const rate = reg !== null && reg > 0 && paid !== null ? (paid / reg) * 100 : null;

                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-center font-medium text-slate-400">{index + 1}</td>
                            <td className="px-4 py-3">
                              <select
                                value={row.program_id}
                                onChange={(e) => handleDetailRowChange(index, 'program_id', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                              >
                                <option value="">-- Chọn ngành / lớp --</option>
                                {campaignData.activePrograms.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    [{p.code}] {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="Trống"
                                value={row.registered_count}
                                onChange={(e) => handleDetailRowChange(index, 'registered_count', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="Trống"
                                value={row.paid_count}
                                onChange={(e) => handleDetailRowChange(index, 'paid_count', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-semibold text-emerald-700 focus:border-indigo-500 focus:outline-hidden"
                              />
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-600">
                              {unpaid !== null ? unpaid : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-indigo-600">
                              {rate !== null ? `${rate.toFixed(0)}%` : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="Ghi chú..."
                                value={row.not_converted_note}
                                onChange={(e) => handleDetailRowChange(index, 'not_converted_note', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveDetailRow(index)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notes & Save */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú chung cho đợt</label>
                  <textarea
                    rows={2}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Nhập ghi chú tổng hợp cho kết quả đợt..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveDetailItems}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                    <span>Lưu chi tiết & Tính lại tổng</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* MANUAL TOTAL MODE VIEW */
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6 max-w-2xl">
              <div>
                <h4 className="text-base font-bold text-slate-900">Nhập tổng trực tiếp cho đợt</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dùng khi mới có số tổng từ báo cáo hoặc file Excel nhưng chưa có chi tiết từng ngành/lớp.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tổng hồ sơ đăng ký</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ví dụ: 155"
                    value={manualRegistered}
                    onChange={(e) => setManualRegistered(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tổng hồ sơ đã đóng học phí</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ví dụ: 90"
                    value={manualPaid}
                    onChange={(e) => setManualPaid(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú đợt</label>
                  <textarea
                    rows={3}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Nhập ghi chú hoặc nguồn số liệu..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveManualTotal}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                    <span>Lưu kết quả tổng đợt</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode Switch Confirmation Modal */}
      {showModeSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">Xác nhận chuyển đổi chế độ nhập</h4>
            </div>
            <p className="text-sm text-slate-600">
              Đợt tuyển sinh này đã có dữ liệu kết quả trước đó. Việc chuyển đổi chế độ nhập có thể thay đổi cách báo cáo số liệu tổng và chi tiết. Bạn có chắc chắn muốn tiếp tục không?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModeSwitchModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmSwitchMode}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">Chốt số liệu kết quả tuyển sinh</h4>
            </div>
            <p className="text-sm text-slate-600">
              Sau khi chốt, số liệu của đợt tuyển sinh này sẽ được khóa (Finalized), không cho phép chỉnh sửa trực tiếp. Bạn có chắc chắn muốn chốt đợt này không?
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú chốt (tùy chọn)</label>
              <textarea
                rows={2}
                value={finalizeNote}
                onChange={(e) => setFinalizeNote(e.target.value)}
                placeholder="Nhập ghi chú khi chốt số liệu..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setShowFinalizeModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleFinalizeSubmit}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Xác nhận chốt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <RefreshCw className="h-6 w-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">Mở lại kết quả tuyển sinh để chỉnh sửa</h4>
            </div>
            <p className="text-sm text-slate-600">
              Việc mở lại sẽ chuyển trạng thái đợt về Nháp (Draft) và ghi lại lịch sử audit. Bạn <strong>bắt buộc</strong> nhập lý do mở lại (tối thiểu 5 ký tự).
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do mở lại <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Nhập chi tiết lý do cần mở lại để sửa số liệu..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-amber-500 focus:outline-hidden"
              />
              <span className={`mt-1 block text-xs ${reopenReason.trim().length < 5 ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                {reopenReason.trim().length} / tối thiểu 5 ký tự
              </span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setShowReopenModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isActionLoading || reopenReason.trim().length < 5}
                onClick={handleReopenSubmit}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isActionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Xác nhận mở lại</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h4 className="text-base font-bold">Lịch sử thay đổi & Vòng đời kết quả</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {historyLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Chưa có lịch sử thay đổi nào được ghi nhận cho bản ghi này.
                </div>
              ) : (
                historyLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold ${
                        log.action === 'FINALIZE' ? 'bg-emerald-100 text-emerald-800' :
                        log.action === 'REOPEN' ? 'bg-amber-100 text-amber-800' :
                        log.action === 'RECALCULATE' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-slate-400">
                        {new Date(log.changed_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {log.reopen_reason && (
                      <p className="text-slate-700 font-medium">
                        <strong>Lý do mở lại:</strong> {log.reopen_reason}
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-slate-600">
                        <strong>Ghi chú:</strong> {log.notes}
                      </p>
                    )}
                    <div className="text-slate-400 text-[11px] pt-1">
                      Nguồn: {log.source_type} | Người thực hiện ID: {log.changed_by || 'Hệ thống'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
