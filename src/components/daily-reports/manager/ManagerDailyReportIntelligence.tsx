import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, Building2 } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { ManagerScopeOrgUnit } from '../../../types/manager-report';
import { DailyReportIntelligenceResult, EvidenceRef } from '../../../types/daily-report-intelligence';
import { DailyReportAIResultPanel } from '../intelligence/DailyReportAIResultPanel';
import { AIErrorAlert } from '../intelligence/AIErrorAlert';

interface ManagerDailyReportIntelligenceProps {
  selectedDate: string;
  currentMonth: string;
  viewMode: 'daily' | 'monthly';
  orgUnits: ManagerScopeOrgUnit[];
  primaryUnitId?: string;
  onViewSubmittedReport?: (reportId: string) => void;
  onSelectDate?: (date: string) => void;
}

export const ManagerDailyReportIntelligence: React.FC<ManagerDailyReportIntelligenceProps> = ({
  selectedDate,
  currentMonth,
  viewMode,
  orgUnits = [],
  primaryUnitId,
  onViewSubmittedReport,
  onSelectDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DailyReportIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('all'); // 'all' means Team Summary

  // Request counter & abort controller for stale response / race condition protection
  const latestRequestId = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear result when date, viewMode, or unit scope changes (Stale Result Protection)
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setResult(null);
    setError(null);
    setErrorCode(null);
  }, [selectedDate, currentMonth, viewMode, selectedUnitId]);

  const generateSummary = async () => {
    if (loading) return; // Prevent double submit

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
      const supabase = getSupabaseClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;

      let dateFrom = selectedDate;
      let dateTo = selectedDate;

      if (viewMode === 'monthly') {
        const [yStr, mStr] = currentMonth.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const lastDay = new Date(y, m, 0).getDate();
        dateFrom = `${currentMonth}-01`;
        dateTo = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
      }

      const feature = selectedUnitId === 'all' ? 'manager_team_summary' : 'manager_unit_summary';

      const payload: any = {
        feature,
        dateFrom,
        dateTo,
      };

      if (selectedUnitId !== 'all') {
        payload.unitId = selectedUnitId;
      }

      const response = await fetch('/api/ai/daily-report/intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      // Stale response guard
      if (requestId !== latestRequestId.current) return;

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorCode(data.code || (response.status === 403 ? 'AI_CONTEXT_UNAUTHORIZED' : null));
        throw new Error(data.error || `Lỗi từ máy chủ: ${response.status}`);
      }

      if (requestId === latestRequestId.current) {
        setResult(data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (requestId !== latestRequestId.current) return;

      console.error('AI Generation error:', err);
      setError(err.message || 'Không thể tổng hợp báo cáo bằng AI lúc này.');
      if (err.code) setErrorCode(err.code);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  };

  const handleDrillDownEvidence = (ev: EvidenceRef) => {
    if (onViewSubmittedReport && ev.dailyReportId) {
      onViewSubmittedReport(ev.dailyReportId);
    } else if (onSelectDate && ev.reportDate) {
      onSelectDate(ev.reportDate);
    }
  };

  const selectedUnit = orgUnits.find((u) => u.id === selectedUnitId);
  const unitName = selectedUnitId === 'all' ? undefined : selectedUnit?.name || 'Đơn vị đã chọn';

  return (
    <div className="space-y-4 mb-6">
      {/* Control & Trigger Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Tổng hợp bằng AI
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Phân tích nội dung báo cáo để tóm tắt hoạt động, điểm nổi bật, vướng mắc và việc cần theo dõi.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Unit Scope Filter */}
          <div className="relative">
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full sm:w-auto border border-slate-200 rounded-xl text-xs font-medium bg-slate-50/80 text-slate-700 py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-500 transition-all cursor-pointer"
              aria-label="Chọn phạm vi đơn vị tổng hợp AI"
            >
              <option value="all">Toàn bộ phạm vi quản lý</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={generateSummary}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI đang tổng hợp báo cáo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{result ? 'Tổng hợp lại' : 'Tổng hợp bằng AI'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <AIErrorAlert
          error={error}
          errorCode={errorCode}
          onRetry={generateSummary}
        />
      )}

      {/* Structured Result Panel */}
      {result && !loading && (
        <DailyReportAIResultPanel
          result={result}
          role="manager"
          unitName={unitName}
          onDrillDownEvidence={handleDrillDownEvidence}
          onRegenerate={generateSummary}
          isRegenerating={loading}
        />
      )}
    </div>
  );
};
