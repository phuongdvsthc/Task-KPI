import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Coffee,
  Plane,
  Building2,
  Laptop,
  AlertTriangle,
  Plus,
  Save,
  Send,
  Loader2,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  Sparkles,
  X,
  Layers,
  Calendar,
  Copy,
} from 'lucide-react';
import {
  CanonicalWorkStatus,
  DailyReport,
  DailyReportSourceItem,
  DailyReportTaskLinkItem,
  SaveDailyReportMultiSourcePayload,
  WORK_STATUS_OPTIONS,
  getWorkStatusLabel,
  normalizeWorkStatus,
  requiresDailyReport,
} from '../../types/daily-report';
import { Task } from '../../types/task';
import { dailyReportService } from '../../services/daily-report.service';
import { metricService } from '../../services/metricService';
import { SourceCard } from './SourceCard';

interface SelectedDayReportEditorProps {
  selectedDate: string; // YYYY-MM-DD
  currentUserId: string;
  primaryOrgUnitId: string;
  primaryOrgName?: string;
  initialReport?: DailyReport | null;
  onReportSaved: (savedReport: DailyReport) => void;
}

export const SelectedDayReportEditor: React.FC<SelectedDayReportEditorProps> = ({
  selectedDate,
  currentUserId,
  primaryOrgUnitId,
  primaryOrgName,
  initialReport,
  onReportSaved,
}) => {
  // 1. Form state
  const [workStatus, setWorkStatus] = useState<CanonicalWorkStatus>('onsite');
  const [reportStatus, setReportStatus] = useState<'draft' | 'submitted'>('draft');
  const [statusNote, setStatusNote] = useState<string>('');
  const [workSummary, setWorkSummary] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [supportRequest, setSupportRequest] = useState<string>('');

  // Mode change confirmation modal state
  const [pendingWorkStatus, setPendingWorkStatus] = useState<CanonicalWorkStatus | null>(null);

  // Selected Tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState<boolean>(false);

  // Sources and metric values
  interface SelectedSourceItem {
    tempKey: string;
    id?: string;
    report_source_id: string;
    source_name_snapshot: string;
    source_code?: string;
    sort_order: number;
  }
  const [selectedSources, setSelectedSources] = useState<SelectedSourceItem[]>([]);
  const [sourceValues, setSourceValues] = useState<Record<string, Record<string, number | string>>>({});

  // Unit available sources to add
  const [unitSources, setUnitSources] = useState<any[]>([]);
  const [isLoadingUnitSources, setIsLoadingUnitSources] = useState<boolean>(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState<boolean>(false);

  // Delete source confirmation modal state
  const [sourceToDelete, setSourceToDelete] = useState<{ tempKey: string; name: string } | null>(null);

  // UI state
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Autosave and Copy states
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isLoadingCopyPrevious, setIsLoadingCopyPrevious] = useState<boolean>(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastSavedPayloadRef = useRef<string>('');
  const isInitializedRef = useRef<boolean>(false);
  const autosaveTimerRef = useRef<any>(null);

  // Load available tasks for Staff
  useEffect(() => {
    let isMounted = true;
    async function loadTasks() {
      if (!currentUserId) return;
      setIsLoadingTasks(true);
      try {
        const tasks = await dailyReportService.getMyTasks(currentUserId);
        if (isMounted) setAvailableTasks(tasks || []);
      } catch (err) {
        console.warn('[SelectedDayReportEditor] Failed to load my tasks:', err);
      } finally {
        if (isMounted) setIsLoadingTasks(false);
      }
    }
    loadTasks();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Load available report sources for staff's primary unit
  useEffect(() => {
    let isMounted = true;
    async function loadUnitSources() {
      if (!primaryOrgUnitId) return;
      setIsLoadingUnitSources(true);
      try {
        const sources = await dailyReportService.getReportSourcesForUnit(primaryOrgUnitId);
        if (isMounted) setUnitSources(sources || []);
      } catch (err) {
        console.warn('[SelectedDayReportEditor] Failed to load unit sources:', err);
      } finally {
        if (isMounted) setIsLoadingUnitSources(false);
      }
    }
    loadUnitSources();
    return () => {
      isMounted = false;
    };
  }, [primaryOrgUnitId]);

  // Initialize or reset form when selectedDate or initialReport changes
  useEffect(() => {
    let isMounted = true;
    async function populateForm() {
      setIsLoadingData(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPendingWorkStatus(null);

      try {
        if (!initialReport) {
          // Empty new form for this date
          setWorkStatus('onsite');
          setReportStatus('draft');
          setStatusNote('');
          setWorkSummary('');
          setIssues('');
          setSupportRequest('');
          setSelectedTaskIds([]);
          setSelectedSources([]);
          setSourceValues({});
        } else {
          // Populate from existing report
          const normWorkStatus = normalizeWorkStatus(initialReport.work_status);
          setWorkStatus(normWorkStatus);
          setReportStatus((initialReport.report_status as any) || 'draft');
          setStatusNote(initialReport.status_note || initialReport.off_note || '');
          setWorkSummary(initialReport.work_summary || '');
          setIssues(initialReport.issues || '');
          setSupportRequest(initialReport.support_request || '');

          // Populate task links
          const taskIds = (initialReport.daily_report_task_links || []).map((tl) => tl.task_id);
          setSelectedTaskIds(taskIds);

          // Populate sources
          const initialSources: SelectedSourceItem[] = (initialReport.daily_report_sources || []).map((src, idx) => ({
            tempKey: src.id || `src-${src.report_source_id}-${idx}`,
            id: src.id,
            report_source_id: src.report_source_id,
            source_name_snapshot: src.source_name_snapshot,
            sort_order: src.sort_order ?? idx,
          }));
          setSelectedSources(initialSources);

          // Load metric entries for this report to populate sourceValues
          if (initialReport.id && requiresDailyReport(normWorkStatus)) {
            const metricEntries = await dailyReportService.getDailyReportMetrics(initialReport.id);
            const valMap: Record<string, Record<string, number | string>> = {};

            // Map entries by daily_report_source_id or fallback
            metricEntries.forEach((entry) => {
              if (entry.source_type === 'calculated') return; // strictly skip calculated
              const matchedSrc = initialSources.find(
                (s) => s.id === entry.daily_report_source_id || s.report_source_id === (entry as any).report_source_id
              );
              const key = matchedSrc ? matchedSrc.tempKey : initialSources[0]?.tempKey || 'default';
              if (!valMap[key]) valMap[key] = {};
              valMap[key][entry.metric_definition_id] = entry.value;
            });

            setSourceValues(valMap);
          } else {
            setSourceValues({});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[SelectedDayReportEditor] Error populating form:', err);
          setErrorMessage(err.message || 'Lỗi khi tải thông tin báo cáo ngày.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
          isInitializedRef.current = true;
        }
      }
    }

    populateForm();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, initialReport]);

  // Formatted date string for Vietnamese UI (e.g. Thứ Ba, 01/09/2026)
  const formattedDateTitle = React.useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = dayNames[d.getDay()];
        return `${dayName}, ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch (e) {
      // fallback
    }
    return selectedDate;
  }, [selectedDate]);

  // Check if form currently has user-entered data
  const hasEnteredReportData = React.useMemo(() => {
    if (workSummary.trim() !== '') return true;
    if (selectedTaskIds.length > 0) return true;
    if (selectedSources.length > 0) return true;
    if (issues.trim() !== '') return true;
    if (supportRequest.trim() !== '') return true;
    for (const srcKey of Object.keys(sourceValues)) {
      const vals = sourceValues[srcKey] || {};
      for (const v of Object.values(vals)) {
        if (v !== '' && v !== null && v !== undefined) return true;
      }
    }
    return false;
  }, [workSummary, selectedTaskIds, selectedSources, issues, supportRequest, sourceValues]);

  // Copy Previous Day feature (Copies summary, tasks, sources without metric values)
  const handleCopyPreviousDay = async () => {
    if (!currentUserId || isLoadingCopyPrevious) return;
    setIsLoadingCopyPrevious(true);
    setErrorMessage(null);
    try {
      const prevReport = await dailyReportService.getLatestPreviousReport(currentUserId, selectedDate);
      if (!prevReport) {
        setErrorMessage('Không tìm thấy báo cáo ngày trước để sao chép.');
        return;
      }

      if (prevReport.work_summary) {
        setWorkSummary(prevReport.work_summary);
      }

      const taskIds = (prevReport.daily_report_task_links || []).map((tl) => tl.task_id);
      setSelectedTaskIds(taskIds);

      if (prevReport.daily_report_sources && prevReport.daily_report_sources.length > 0) {
        const copiedSources: SelectedSourceItem[] = prevReport.daily_report_sources.map((src, idx) => ({
          tempKey: `src-copy-${Date.now()}-${idx}`,
          report_source_id: src.report_source_id,
          source_name_snapshot: src.source_name_snapshot,
          sort_order: idx,
        }));
        setSelectedSources(copiedSources);
        setSourceValues({}); // Never copy numeric values
      }

      setSuccessMessage('Đã sao chép nội dung & danh mục từ ngày trước (không sao chép số liệu).');
    } catch (err: any) {
      setErrorMessage('Lỗi khi sao chép ngày trước: ' + (err.message || ''));
    } finally {
      setIsLoadingCopyPrevious(false);
    }
  };

  // Debounced Autosave Draft Effect (2.5 seconds)
  useEffect(() => {
    if (!isInitializedRef.current || isLoadingData) return;
    if (!requiresDailyReport(workStatus)) return; // Only autosave onsite/remote
    if (reportStatus === 'submitted') return; // Do not overwrite submitted report with draft
    if (!currentUserId || !primaryOrgUnitId) return;
    if (!hasEnteredReportData) return; // Don't autosave empty blank form

    const currentPayload: SaveDailyReportMultiSourcePayload = {
      id: initialReport?.id,
      report_date: selectedDate,
      user_id: currentUserId,
      organization_unit_id: primaryOrgUnitId,
      work_status: workStatus,
      report_status: 'draft',
      submitted_at: null,
      status_note: null,
      off_note: null,
      work_summary: workSummary.trim() || null,
      issues: issues.trim() || null,
      support_request: supportRequest.trim() || null,
      task_ids: selectedTaskIds,
      sources: selectedSources.map((s, idx) => {
        const vals = sourceValues[s.tempKey] || {};
        const metricsArray = Object.entries(vals)
          .filter(([_, val]) => val !== '' && val !== null && val !== undefined)
          .map(([metricId, val]) => ({
            metric_definition_id: metricId,
            value: Number(val) || 0,
          }));

        return {
          id: s.id,
          report_source_id: s.report_source_id,
          source_name_snapshot: s.source_name_snapshot,
          sort_order: idx,
          metrics: metricsArray,
        };
      }),
    };

    const payloadHash = JSON.stringify(currentPayload);
    if (payloadHash === lastSavedPayloadRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setAutosaveStatus('saving');
        const saved = await dailyReportService.saveDailyReportMultiSource(currentPayload);
        lastSavedPayloadRef.current = payloadHash;
        setAutosaveStatus('saved');
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        onReportSaved(saved);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('daily-report-updated', { detail: saved }));
        }
      } catch (err) {
        console.warn('[Autosave] Error saving draft:', err);
        setAutosaveStatus('error');
      }
    }, 2500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    workStatus,
    reportStatus,
    workSummary,
    selectedTaskIds,
    selectedSources,
    sourceValues,
    issues,
    supportRequest,
    selectedDate,
    currentUserId,
    primaryOrgUnitId,
    hasEnteredReportData,
    isLoadingData,
  ]);

  // Handle work mode selection click
  const handleWorkStatusSelect = (targetMode: CanonicalWorkStatus) => {
    if (targetMode === workStatus) return;

    const currentRequires = requiresDailyReport(workStatus);
    const targetRequires = requiresDailyReport(targetMode);

    // Switching from Reporting -> Exempt
    if (currentRequires && !targetRequires) {
      if (hasEnteredReportData) {
        setPendingWorkStatus(targetMode);
        return;
      }
      // No data entered, switch directly
      setWorkStatus(targetMode);
      setReportStatus('submitted');
      setStatusNote('');
      return;
    }

    // Switching from Exempt -> Reporting
    if (!currentRequires && targetRequires) {
      setWorkStatus(targetMode);
      setReportStatus('draft');
      setStatusNote('');
      return;
    }

    // Switching between onsite/remote or between business_trip/off
    setWorkStatus(targetMode);
  };

  // Confirm mode switch (clears data)
  const handleConfirmModeSwitch = () => {
    if (!pendingWorkStatus) return;
    setWorkSummary('');
    setSelectedTaskIds([]);
    setSelectedSources([]);
    setSourceValues({});
    setIssues('');
    setSupportRequest('');
    setStatusNote('');
    setWorkStatus(pendingWorkStatus);
    setReportStatus('submitted');
    setPendingWorkStatus(null);
  };

  // Cancel mode switch
  const handleCancelModeSwitch = () => {
    setPendingWorkStatus(null);
  };

  // Unselected sources available to add
  const availableSourcesToAdd = React.useMemo(() => {
    const selectedSourceIds = new Set(selectedSources.map((s) => s.report_source_id));
    return unitSources.filter((s) => !selectedSourceIds.has(s.id));
  }, [unitSources, selectedSources]);

  // Add Source handler
  const handleAddSource = (src: any) => {
    const tempKey = `src-temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSourceItem: SelectedSourceItem = {
      tempKey,
      report_source_id: src.id,
      source_name_snapshot: src.name,
      source_code: src.code,
      sort_order: selectedSources.length,
    };

    setSelectedSources((prev) => [...prev, newSourceItem]);
    setIsAddSourceModalOpen(false);
  };

  // Metric value change handler
  const handleMetricValueChange = (sourceKey: string, metricId: string, value: number | string) => {
    setSourceValues((prev) => ({
      ...prev,
      [sourceKey]: {
        ...(prev[sourceKey] || {}),
        [metricId]: value,
      },
    }));
  };

  // Remove Source trigger
  const handleRemoveSourceTrigger = (sourceKey: string, hasValues: boolean) => {
    const src = selectedSources.find((s) => s.tempKey === sourceKey);
    if (!src) return;

    if (hasValues) {
      setSourceToDelete({ tempKey: sourceKey, name: src.source_name_snapshot });
    } else {
      performRemoveSource(sourceKey);
    }
  };

  const performRemoveSource = (sourceKey: string) => {
    setSelectedSources((prev) => prev.filter((s) => s.tempKey !== sourceKey));
    setSourceValues((prev) => {
      const next = { ...prev };
      delete next[sourceKey];
      return next;
    });
    setSourceToDelete(null);
  };

  // Toggle task link
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Save handler: action = 'draft' | 'submitted'
  const handleSave = async (targetStatus: 'draft' | 'submitted') => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation for authenticated context
    if (!currentUserId || !primaryOrgUnitId) {
      setErrorMessage('Không xác định được đơn vị công tác chính của tài khoản.');
      return;
    }

    const isReporting = requiresDailyReport(workStatus);

    // Validation for SUBMITTED
    if (targetStatus === 'submitted' && isReporting) {
      if (!workSummary.trim()) {
        setErrorMessage('Vui lòng nhập nội dung công việc hôm nay trước khi hoàn tất báo cáo.');
        return;
      }

      // Validate required metrics across all sources
      for (const src of selectedSources) {
        try {
          const metrics = await metricService.getMetricsForReportSource(src.report_source_id);
          const vals = sourceValues[src.tempKey] || {};
          for (const m of metrics) {
            if (m.entry_mode !== 'calculated' && (m as any).assignment_is_required) {
              const v = vals[m.id];
              if (v === undefined || v === null || v === '') {
                setErrorMessage(
                  `Kênh "${src.source_name_snapshot}": Chỉ số bắt buộc "${m.name}" chưa được nhập số liệu.`
                );
                return;
              }
            }
          }
        } catch (e) {
          // ignore validation if metric loading fails
        }
      }
    }

    setIsSaving(true);

    try {
      // Build multi-source payload
      const sourcesPayload = isReporting
        ? selectedSources.map((s, idx) => {
            const vals = sourceValues[s.tempKey] || {};
            const metricsArray = Object.entries(vals)
              .filter(([_, val]) => val !== '' && val !== null && val !== undefined)
              .map(([metricId, val]) => ({
                metric_definition_id: metricId,
                value: Number(val) || 0,
              }));

            return {
              id: s.id,
              report_source_id: s.report_source_id,
              source_name_snapshot: s.source_name_snapshot,
              sort_order: idx,
              metrics: metricsArray,
            };
          })
        : [];

      const payload: SaveDailyReportMultiSourcePayload = {
        id: initialReport?.id,
        report_date: selectedDate,
        user_id: currentUserId,
        organization_unit_id: primaryOrgUnitId,
        work_status: workStatus,
        report_status: isReporting ? targetStatus : 'submitted',
        submitted_at: !isReporting || targetStatus === 'submitted' ? new Date().toISOString() : null,
        status_note: !isReporting ? statusNote : null,
        off_note: !isReporting ? statusNote : null,
        work_summary: isReporting ? workSummary : null,
        issues: isReporting ? issues : null,
        support_request: isReporting ? supportRequest : null,
        task_ids: isReporting ? selectedTaskIds : [],
        sources: sourcesPayload,
      };

      const saved = await dailyReportService.saveDailyReportMultiSource(payload);

      setSuccessMessage(
        !isReporting
          ? `Đã lưu ghi nhận ${getWorkStatusLabel(workStatus)} thành công!`
          : targetStatus === 'submitted'
          ? 'Báo cáo ngày đã được hoàn tất thành công!'
          : 'Đã lưu bản nháp báo cáo thành công.'
      );

      setReportStatus(isReporting ? targetStatus : 'submitted');
      onReportSaved(saved);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('daily-report-updated', { detail: saved }));
      }
    } catch (err: any) {
      console.error('[SelectedDayReportEditor] Save error:', err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi lưu báo cáo.');
    } finally {
      setIsSaving(false);
    }
  };

  const isCurrentModeReporting = requiresDailyReport(workStatus);

  return (
    <div ref={editorRef} className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Báo Cáo Ngày: {formattedDateTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Đơn vị công tác chính: <span className="font-semibold text-slate-700">{primaryOrgName || 'Đơn vị chính'}</span>
          </p>
        </div>

        {/* Current status badge & Autosave indicator */}
        <div className="flex items-center gap-3">
          {/* Autosave status indicator */}
          {isCurrentModeReporting && reportStatus === 'draft' && (
            <div className="text-2xs font-medium">
              {autosaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                  Đang lưu...
                </span>
              )}
              {autosaveStatus === 'saved' && lastSavedTime && (
                <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Đã lưu {lastSavedTime}
                </span>
              )}
              {autosaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  <AlertCircle className="h-3 w-3 text-rose-500" />
                  Chưa lưu được
                </span>
              )}
            </div>
          )}

          {initialReport ? (
            workStatus === 'business_trip' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-200">
                <Plane className="h-3.5 w-3.5" />
                Đi công tác
              </span>
            ) : workStatus === 'off' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                <Coffee className="h-3.5 w-3.5" />
                Off / Nghỉ
              </span>
            ) : reportStatus === 'submitted' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã nộp báo cáo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" />
                Bản nháp
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
              Chưa tạo báo cáo
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="m-4 flex items-start gap-2.5 rounded-lg bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="m-4 flex items-start gap-2.5 rounded-lg bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoadingData ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-xs">Đang tải dữ liệu báo cáo...</span>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-6">
          {/* 1. Work Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5">
              Hình thức làm việc <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {WORK_STATUS_OPTIONS.map((opt) => {
                const isSelected = workStatus === opt.value;
                let IconComponent = Building2;
                if (opt.value === 'remote') IconComponent = Laptop;
                if (opt.value === 'business_trip') IconComponent = Plane;
                if (opt.value === 'off') IconComponent = Coffee;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleWorkStatusSelect(opt.value)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-2">
                        <IconComponent
                          className={`h-4 w-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}
                        />
                        <span className="text-xs sm:text-sm font-semibold">{opt.label}</span>
                      </div>
                      <div
                        className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-2xs text-slate-500 leading-relaxed mt-0.5">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. EXEMPT VIEW (business_trip & off) */}
          {!isCurrentModeReporting && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                {workStatus === 'business_trip' ? (
                  <Plane className="h-5 w-5 text-sky-600" />
                ) : (
                  <Coffee className="h-5 w-5 text-slate-600" />
                )}
                <div>
                  <h3 className="text-sm font-bold">
                    {workStatus === 'business_trip' ? 'Ghi nhận đi công tác' : 'Ghi nhận nghỉ làm việc'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hình thức này không yêu cầu nhập chi tiết báo cáo công việc và số liệu chỉ số.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {workStatus === 'business_trip'
                    ? 'Ghi chú công tác (tùy chọn)'
                    : 'Lý do / Ghi chú nghỉ (tùy chọn)'}
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder={
                    workStatus === 'business_trip'
                      ? 'Ví dụ: Đi công tác theo Kế hoạch / Quyết định số..., công tác tại đơn vị...'
                      : 'Ví dụ: Nghỉ phép cá nhân, nghỉ ốm, nghỉ bù, nghỉ lễ...'
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* 3. REPORTING VIEW (onsite & remote) */}
          {isCurrentModeReporting && (
            <div className="space-y-6">
              {/* Work Summary Header + Copy Previous Day action */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nội dung công việc hôm nay <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    disabled={isLoadingCopyPrevious || isSaving}
                    onClick={handleCopyPreviousDay}
                    title="Sao chép nội dung công việc, danh sách nhiệm vụ và các kênh nguồn từ ngày làm việc trước (không sao chép số liệu)"
                    className="inline-flex items-center gap-1.5 text-2xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {isLoadingCopyPrevious ? (
                      <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>Sao chép ngày trước</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="Mô tả tóm tắt các công việc chính đã thực hiện trong ngày..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Related Tasks Link */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Liên kết Công việc / Nhiệm vụ
                  </label>
                  <span className="text-2xs text-slate-400">
                    {selectedTaskIds.length} nhiệm vụ được liên kết
                  </span>
                </div>

                {/* Selected Tasks Tags */}
                {selectedTaskIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTaskIds.map((tId) => {
                      const task = availableTasks.find((t) => t.id === tId);
                      return (
                        <div
                          key={tId}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs text-indigo-900"
                        >
                          <span className="font-mono text-2xs font-semibold text-indigo-600">
                            {task?.task_code || 'TASK'}
                          </span>
                          <span className="max-w-[200px] truncate">{task?.title || tId}</span>
                          <button
                            type="button"
                            onClick={() => toggleTaskSelection(tId)}
                            className="text-indigo-400 hover:text-indigo-700 ml-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Task Selector Dropdown Toggle */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={isLoadingTasks}
                    onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-500" />
                    <span>Chọn công việc liên kết</span>
                  </button>

                  {isTaskDropdownOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 px-2 mb-1">
                        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                          Nhiệm vụ của bạn
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTaskDropdownOpen(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {availableTasks.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Không có nhiệm vụ nào được giao.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {availableTasks.map((t) => {
                            const isSelected = selectedTaskIds.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleTaskSelection(t.id)}
                                className={`flex items-center justify-between w-full rounded-lg p-2 text-left text-xs transition-colors ${
                                  isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  {isSelected ? (
                                    <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300 shrink-0" />
                                  )}
                                  <div className="truncate">
                                    <span className="font-mono text-2xs font-semibold text-slate-500 mr-1.5">
                                      {t.task_code}
                                    </span>
                                    <span className="font-medium">{t.title}</span>
                                  </div>
                                </div>
                                <span className="text-2xs font-medium text-slate-400 shrink-0 capitalize">
                                  {t.status}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Source Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Kết quả theo Kênh / Nguồn
                    </h3>
                    <p className="text-xs text-slate-500">
                      Nhập số liệu phát sinh cho từng Kênh/Nguồn được phân công trong ngày
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddSourceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 text-xs font-semibold transition-colors self-start sm:self-auto shadow-2xs"
                  >
                    <Plus className="h-4 w-4 text-indigo-600" />
                    <span>Thêm Kênh / Nguồn</span>
                  </button>
                </div>

                {/* List of Source Cards */}
                {selectedSources.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                    <Layers className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">
                      Chưa thêm Kênh / Nguồn nào cho báo cáo hôm nay.
                    </p>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Bấm &quot;Thêm Kênh / Nguồn&quot; để chọn kênh làm việc của bạn (Facebook, Zalo, Trực tiếp...)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedSources.map((src, idx) => (
                      <SourceCard
                        key={src.tempKey}
                        sourceKey={src.tempKey}
                        reportSourceId={src.report_source_id}
                        sourceName={src.source_name_snapshot}
                        sourceCode={src.source_code}
                        sortOrder={idx}
                        metricValues={sourceValues[src.tempKey] || {}}
                        onChangeMetricValue={handleMetricValueChange}
                        onRemoveSource={handleRemoveSourceTrigger}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Issues & Support Requests */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Khó khăn / Vướng mắc
                  </label>
                  <textarea
                    rows={2}
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                    placeholder="Các vấn đề phát sinh cần tháo gỡ (nếu có)..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Đề xuất hỗ trợ
                  </label>
                  <textarea
                    rows={2}
                    value={supportRequest}
                    onChange={(e) => setSupportRequest(e.target.value)}
                    placeholder="Đề xuất cần đơn vị hoặc quản lý hỗ trợ (nếu có)..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-slate-200">
            {!isCurrentModeReporting ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave('submitted')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-slate-900 active:bg-slate-950 transition-colors shadow-2xs disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Lưu hình thức làm việc</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSave('draft')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Lưu nháp</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSave('submitted')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Hoàn tất báo cáo</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode Switch Confirmation Modal */}
      {pendingWorkStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Xác nhận chuyển hình thức làm việc</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Chuyển sang trạng thái này sẽ xóa nội dung báo cáo và số liệu đã nhập của ngày này. Bạn có muốn tiếp tục?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelModeSwitch}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmModeSwitch}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 shadow-2xs"
              >
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {isAddSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Chọn Kênh / Nguồn làm việc</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSourceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Danh sách Kênh/Nguồn đang hoạt động được phân công cho đơn vị của bạn:
            </p>

            {isLoadingUnitSources ? (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-xs">Đang tải danh sách nguồn...</span>
              </div>
            ) : availableSourcesToAdd.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                {unitSources.length === 0
                  ? 'Chưa có Kênh/Nguồn nào được gán cho đơn vị của bạn.'
                  : 'Tất cả Kênh/Nguồn khả dụng đã được thêm vào báo cáo này.'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-slate-50">
                {availableSourcesToAdd.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleAddSource(src)}
                    className="flex items-center justify-between w-full rounded-xl p-3 text-left hover:bg-indigo-50/60 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                          {src.name}
                        </span>
                        {src.code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs text-slate-600">
                            {src.code}
                          </span>
                        )}
                      </div>
                      {src.category && (
                        <span className="text-2xs text-slate-400 capitalize">{src.category}</span>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddSourceModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Source Confirmation Dialog */}
      {sourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa Kênh/Nguồn</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc muốn xóa Kênh/Nguồn <strong className="text-slate-800">&quot;{sourceToDelete.name}&quot;</strong> này? Các số liệu đã nhập của nguồn sẽ bị xóa.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSourceToDelete(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => performRemoveSource(sourceToDelete.tempKey)}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-2xs"
              >
                Xóa nguồn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
