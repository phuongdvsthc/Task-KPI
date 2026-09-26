import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Loader2, CheckCircle2, RotateCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { KPIIntelligenceResult, KPIEvidenceRef } from '../../../types/kpi-intelligence';
import { KPIAIResultPanel } from '../intelligence/KPIAIResultPanel';
import { KPIAIErrorAlert } from '../intelligence/KPIAIErrorAlert';
import { KpiDashboardFilters } from '../../../types/kpi';

export interface ManagerKpiAiSummaryProps {
  filters: KpiDashboardFilters;
  unitName?: string;
  onDrillDownEvidence?: (evidence: KPIEvidenceRef) => void;
}

export const ManagerKpiAiSummary: React.FC<ManagerKpiAiSummaryProps> = ({
  filters,
  unitName,
  onDrillDownEvidence
}) => {
  // Request & lifecycle state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KPIIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Stale request race protection & unmount safety
  const latestRequestId = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Derive feature based on unit selection
  const isTeamMode = !filters.unitId || filters.unitId === 'all' || filters.unitId === '';
  const currentFeature = isTeamMode ? 'manager_team_kpi_summary' : 'manager_unit_kpi_summary';
  const scopeLabelText = isTeamMode ? 'Toàn phạm vi quản lý' : `Đơn vị: ${unitName || filters.unitId}`;

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
  }, [
    filters.periodId,
    filters.unitId,
    filters.assignmentStatus,
    filters.resultMode,
    filters.assigneeType,
    filters.reviewStatus,
    filters.completionStatus
  ]);

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
        feature: currentFeature
      };

      if (filters.periodId) {
        payload.periodId = filters.periodId;
      }
      if (!isTeamMode && filters.unitId) {
        payload.unitId = filters.unitId;
      }
      if (filters.assignmentStatus && filters.assignmentStatus !== 'all') {
        payload.status = [filters.assignmentStatus];
      }

      // Add other relevant filters if backend supports them.
      // Usually, just passing the basic ones is enough for E5.

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

      console.error('Manager KPI AI error:', err);
      setError(err.message || 'Lỗi khi gọi dịch vụ AI');
      if (err.code) setErrorCode(err.code);
    } finally {
      if (requestId === latestRequestId.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleEvidenceDrillDown = (evidence: KPIEvidenceRef) => {
    if (onDrillDownEvidence) {
      onDrillDownEvidence(evidence);
    }
  };

  return (
    <div
      id="manager-kpi-ai-summary-container"
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
              <span>Tổng hợp KPI bằng AI</span>
            </h3>
            <p className="text-xs text-slate-500" id="manager-kpi-ai-scope-label">
              Phạm vi: <strong className="text-slate-700 font-semibold">{scopeLabelText}</strong>
              {filters.assignmentStatus && filters.assignmentStatus !== 'all' && (
                <span> · Trạng thái: {filters.assignmentStatus}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          id="btn-manager-kpi-ai-summary"
          onClick={handleGenerate}
          disabled={loading || !filters.periodId}
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
              <span>Tổng hợp lại</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Tổng hợp KPI bằng AI</span>
            </>
          )}
        </button>
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
            role="manager"
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
          <p className="font-semibold text-slate-700">Chưa có kết quả tổng hợp bằng AI</p>
          <p>
            Nhấn <strong className="text-indigo-600">"Tổng hợp KPI bằng AI"</strong> để AI phân tích hiệu suất và tiến độ của {isTeamMode ? 'toàn đơn vị quản lý' : 'đơn vị đã chọn'}.
          </p>
        </div>
      )}
    </div>
  );
};
