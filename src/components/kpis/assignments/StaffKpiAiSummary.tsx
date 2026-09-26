import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Loader2, Calendar, Filter, Layers, CheckCircle2, RotateCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { KpiAssignment } from '../../../types/kpi';
import { KPIIntelligenceResult, KPIEvidenceRef } from '../../../types/kpi-intelligence';
import { KPIAIResultPanel } from '../intelligence/KPIAIResultPanel';
import { KPIAIErrorAlert } from '../intelligence/KPIAIErrorAlert';

export interface StaffKpiAiSummaryProps {
  assignments?: KpiAssignment[];
  periodId?: string;
  assignmentId?: string;
  status?: string;
  includeLocked?: boolean;
  onDrillDownAssignment?: (assignmentId: string) => void;
  onDrillDownEvidence?: (evidence: KPIEvidenceRef) => void;
  onPeriodChange?: (periodId: string | undefined) => void;
  onAssignmentChange?: (assignmentId: string | undefined) => void;
  onStatusChange?: (status: string | undefined) => void;
  onIncludeLockedChange?: (includeLocked: boolean) => void;
}

export const StaffKpiAiSummary: React.FC<StaffKpiAiSummaryProps> = ({
  assignments = [],
  periodId: propPeriodId,
  assignmentId: propAssignmentId,
  status: propStatus,
  includeLocked: propIncludeLocked,
  onDrillDownAssignment,
  onDrillDownEvidence,
  onPeriodChange,
  onAssignmentChange,
  onStatusChange,
  onIncludeLockedChange
}) => {
  // Extract unique periods from available assignments
  const availablePeriods = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assignments.forEach(a => {
      const pid = a.periodId || a.period_id || a.period?.id;
      const pname = a.periodName || a.period?.name || a.period?.code || 'Kỳ đánh giá';
      if (pid && !map.has(pid)) {
        map.set(pid, { id: pid, name: pname });
      }
    });
    return Array.from(map.values());
  }, [assignments]);

  // Filter states
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(propPeriodId || '');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(propAssignmentId || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(propStatus || '');
  const [includeLocked, setIncludeLocked] = useState<boolean>(
    propIncludeLocked !== undefined ? propIncludeLocked : true
  );

  // Sync with props if provided
  useEffect(() => {
    if (propPeriodId !== undefined && propPeriodId !== selectedPeriodId) {
      setSelectedPeriodId(propPeriodId);
    }
  }, [propPeriodId]);

  useEffect(() => {
    if (propAssignmentId !== undefined && propAssignmentId !== selectedAssignmentId) {
      setSelectedAssignmentId(propAssignmentId);
    }
  }, [propAssignmentId]);

  useEffect(() => {
    if (propStatus !== undefined && propStatus !== selectedStatus) {
      setSelectedStatus(propStatus);
    }
  }, [propStatus]);

  useEffect(() => {
    if (propIncludeLocked !== undefined && propIncludeLocked !== includeLocked) {
      setIncludeLocked(propIncludeLocked);
    }
  }, [propIncludeLocked]);

  // Request & lifecycle state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KPIIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Stale request race protection & unmount safety
  const latestRequestId = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Invalidate stale AI result whenever any relevant filter changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Abort pending request if filter changed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    latestRequestId.current++;
    setLoading(false);
    setResult(null);
    setError(null);
    setErrorCode(null);
  }, [selectedPeriodId, selectedAssignmentId, selectedStatus, includeLocked]);

  // Trigger KPI summary generation
  const handleGenerate = async () => {
    if (loading) return; // Prevent duplicate submit

    const requestId = ++latestRequestId.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const payload: Record<string, any> = {
        feature: 'staff_kpi_summary'
      };

      if (selectedPeriodId) {
        payload.periodId = selectedPeriodId;
      }
      if (selectedAssignmentId) {
        payload.assignmentId = selectedAssignmentId;
      }
      if (selectedStatus) {
        payload.status = [selectedStatus];
      }
      if (includeLocked !== undefined) {
        payload.includeLocked = includeLocked;
      }

      const response = await fetch('/api/ai/kpi/intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      // Ignore if another request was triggered in the meantime
      if (requestId !== latestRequestId.current || !isMountedRef.current) {
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mappedCode =
          data.code ||
          (response.status === 403
            ? 'AI_CONTEXT_UNAUTHORIZED'
            : response.status === 429
            ? 'RATE_LIMITED'
            : response.status === 504
            ? 'TIMEOUT'
            : response.status === 503
            ? 'PROVIDER_UNAVAILABLE'
            : 'INTERNAL_ERROR');

        setErrorCode(mappedCode);
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (requestId === latestRequestId.current && isMountedRef.current) {
        setResult(data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (requestId !== latestRequestId.current || !isMountedRef.current) return;

      console.error('Staff KPI AI error:', err);
      setError(err.message || 'Lỗi khi gọi dịch vụ AI');
      if (err.code) setErrorCode(err.code);
    } finally {
      if (requestId === latestRequestId.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Secure drill-down with authorization check
  const handleEvidenceDrillDown = (evidence: KPIEvidenceRef) => {
    // Check if target assignment belongs to current authenticated staff
    if (!evidence.assignmentId) return;

    const isAuthorized = assignments.some(a => a.id === evidence.assignmentId);
    if (!isAuthorized) {
      console.warn('[StaffKpiAiSummary] Evidence drill-down rejected: unauthorized or unassigned ID:', evidence.assignmentId);
      return;
    }

    if (onDrillDownEvidence) {
      onDrillDownEvidence(evidence);
    } else if (onDrillDownAssignment) {
      onDrillDownAssignment(evidence.assignmentId);
    }
  };

  // Human readable period label for header display
  const currentPeriodName = useMemo(() => {
    if (!selectedPeriodId) return 'Tất cả các kỳ';
    const found = availablePeriods.find(p => p.id === selectedPeriodId);
    return found ? found.name : 'Kỳ đã chọn';
  }, [selectedPeriodId, availablePeriods]);

  return (
    <div
      id="staff-kpi-ai-summary-container"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4 mb-6"
    >
      {/* Action and Scope Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Tóm tắt KPI bằng AI</span>
            </h3>
            <p className="text-xs text-slate-500">
              Phạm vi: <strong className="text-slate-700 font-semibold">{currentPeriodName}</strong>
              {selectedStatus && <span> · Trạng thái: {selectedStatus}</span>}
              {!includeLocked && <span className="text-amber-600"> (Không gồm đã khóa)</span>}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          id="btn-staff-kpi-ai-summary"
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang phân tích...</span>
            </>
          ) : result ? (
            <>
              <RotateCw className="w-4 h-4" />
              <span>Tạo lại tóm tắt</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Tóm tắt KPI bằng AI</span>
            </>
          )}
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-medium text-slate-500 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Bộ lọc:</span>
        </div>

        {/* Period Selector */}
        {availablePeriods.length > 0 && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="kpi-ai-period-select"
              value={selectedPeriodId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPeriodId(val);
                onPeriodChange?.(val || undefined);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="">Tất cả các kỳ</option>
              {availablePeriods.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Assignment Selector */}
        {assignments.length > 1 && (
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="kpi-ai-assignment-select"
              value={selectedAssignmentId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAssignmentId(val);
                onAssignmentChange?.(val || undefined);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer max-w-[200px] truncate"
            >
              <option value="">Tất cả bản giao KPI</option>
              {assignments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.templateName || a.template?.name || `Bản giao ${a.id.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Selector */}
        <select
          id="kpi-ai-status-select"
          value={selectedStatus}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedStatus(val);
            onStatusChange?.(val || undefined);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang áp dụng</option>
          <option value="locked">Đã khóa</option>
          <option value="assigned">Đã giao</option>
          <option value="closed">Đã kết thúc</option>
        </select>

        {/* Include Locked Checkbox */}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none text-slate-700 hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            id="kpi-ai-include-locked"
            checked={includeLocked}
            onChange={(e) => {
              const checked = e.target.checked;
              setIncludeLocked(checked);
              onIncludeLockedChange?.(checked);
            }}
            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
          <span>Bao gồm đã khóa</span>
        </label>
      </div>

      {/* Error state */}
      {error && (
        <KPIAIErrorAlert
          error={error}
          errorCode={errorCode}
          onRetry={handleGenerate}
        />
      )}

      {/* AI Result Panel */}
      {result && !loading && (
        <div id="kpi-ai-result-panel-wrapper">
          <KPIAIResultPanel
            result={result}
            role="staff"
            onDrillDownEvidence={handleEvidenceDrillDown}
            onRegenerate={handleGenerate}
            isRegenerating={loading}
          />
        </div>
      )}

      {/* Empty State before first run */}
      {!result && !error && !loading && (
        <div
          id="kpi-ai-idle-prompt"
          className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1 bg-slate-50/50"
        >
          <div className="flex justify-center mb-1">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="font-semibold text-slate-700">Chưa có kết quả tóm tắt bằng AI</p>
          <p>
            Nhấn <strong className="text-indigo-600">"Tóm tắt KPI bằng AI"</strong> để AI tổng hợp tiến độ chỉ tiêu, phát hiện điểm sáng và việc cần theo dõi theo các bộ lọc đang chọn.
          </p>
        </div>
      )}
    </div>
  );
};
