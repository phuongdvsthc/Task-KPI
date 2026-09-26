import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, CalendarRange, Calendar } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { DailyReportIntelligenceResult, EvidenceRef } from '../../types/daily-report-intelligence';
import { DailyReportAIResultPanel } from './intelligence/DailyReportAIResultPanel';
import { AIErrorAlert } from './intelligence/AIErrorAlert';

interface StaffDailyReportIntelligenceProps {
  selectedDate: string;
  currentMonth: string;
  userId: string;
  onSelectDate?: (date: string) => void;
}

export const StaffDailyReportIntelligence: React.FC<StaffDailyReportIntelligenceProps> = ({
  selectedDate,
  currentMonth,
  userId,
  onSelectDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DailyReportIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<'day' | 'month'>('day');

  // Request counter & abort controller for stale response / race condition protection
  const latestRequestId = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear result when date/range changes (Stale Result Protection)
  useEffect(() => {
    // Abort pending request if filter changed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setResult(null);
    setError(null);
    setErrorCode(null);
  }, [selectedDate, currentMonth, rangeMode, userId]);

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

      if (rangeMode === 'month') {
        const [yStr, mStr] = currentMonth.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const lastDay = new Date(y, m, 0).getDate();
        dateFrom = `${currentMonth}-01`;
        dateTo = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
      }

      const response = await fetch('/api/ai/daily-report/intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          feature: 'staff_daily_summary',
          dateFrom,
          dateTo,
          userId,
        }),
        signal: abortController.signal,
      });

      // Check if stale request before parsing
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

      console.error('AI Staff Summary error:', err);
      setError(err.message || 'Có lỗi xảy ra khi tạo tóm tắt AI.');
      if (err.code) setErrorCode(err.code);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  };

  const handleDrillDown = (ev: EvidenceRef) => {
    if (ev.reportDate && onSelectDate) {
      onSelectDate(ev.reportDate);
    }
  };

  const isMultiDay = rangeMode === 'month';

  return (
    <div className="space-y-4 mb-6">
      {/* Filter & Trigger Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Tóm tắt bằng AI
            </h3>
            <p className="text-xs text-slate-500">
              {isMultiDay ? `Phạm vi tháng ${currentMonth}` : `Báo cáo ngày ${selectedDate}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Day / Month Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setRangeMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                rangeMode === 'day'
                  ? 'bg-white shadow-2xs text-slate-800 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ngày này</span>
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                rangeMode === 'month'
                  ? 'bg-white shadow-2xs text-slate-800 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Cả tháng</span>
            </button>
          </div>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={generateSummary}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI đang tổng hợp báo cáo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{result ? 'Tạo lại' : 'Tóm tắt'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <AIErrorAlert
          error={error}
          errorCode={errorCode}
          onRetry={generateSummary}
        />
      )}

      {/* Result Panel */}
      {result && !loading && (
        <DailyReportAIResultPanel
          result={result}
          role="staff"
          onDrillDownEvidence={onSelectDate ? handleDrillDown : undefined}
          onRegenerate={generateSummary}
          isRegenerating={loading}
        />
      )}
    </div>
  );
};
