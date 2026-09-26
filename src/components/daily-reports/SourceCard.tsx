import React, { useState, useEffect } from 'react';
import {
  Layers,
  Trash2,
  Calculator,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { MetricDefinition } from '../../types/metric';
import { metricService } from '../../services/metricService';

interface SourceCardProps {
  sourceKey: string; // Unique key for form state
  reportSourceId: string;
  sourceName: string;
  sourceCode?: string;
  sortOrder: number;
  metricValues: Record<string, number | string>;
  disabled?: boolean;
  onChangeMetricValue: (sourceKey: string, metricId: string, value: number | string) => void;
  onRemoveSource: (sourceKey: string, hasValues: boolean) => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({
  sourceKey,
  reportSourceId,
  sourceName,
  sourceCode,
  sortOrder,
  metricValues = {},
  disabled = false,
  onChangeMetricValue,
  onRemoveSource,
}) => {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load metric definitions assigned to this report source
  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await metricService.getMetricsForReportSource(reportSourceId);
        if (isMounted) {
          setMetrics(data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(`[SourceCard] Failed to load metrics for source ${reportSourceId}:`, err);
          setError(err.message || 'Không thể tải danh sách chỉ số của nguồn');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (reportSourceId) {
      loadMetrics();
    }
    return () => {
      isMounted = false;
    };
  }, [reportSourceId]);

  // Separate manual and calculated metrics
  const manualMetrics = React.useMemo(() => {
    return metrics.filter((m) => m.entry_mode !== 'calculated');
  }, [metrics]);

  const calculatedMetrics = React.useMemo(() => {
    return metrics.filter((m) => m.entry_mode === 'calculated');
  }, [metrics]);

  // Check if any manual metric in this source has a value
  const hasValues = React.useMemo(() => {
    return manualMetrics.some((m) => {
      const val = metricValues[m.id];
      return val !== undefined && val !== null && val !== '' && Number(val) !== 0;
    });
  }, [manualMetrics, metricValues]);

  // Compute calculated metrics strictly from this source's manual metric values
  const computeCalculatedValue = (m: MetricDefinition): { display: string; raw: number | null } => {
    if (m.calculation_type === 'ratio' || (!m.calculation_type && m.numerator_metric_id && m.denominator_metric_id)) {
      const numId = m.numerator_metric_id;
      const denId = m.denominator_metric_id;

      if (!numId || !denId) return { display: '—', raw: null };

      const numVal = Number(metricValues[numId]) || 0;
      const denVal = Number(metricValues[denId]) || 0;

      if (denVal === 0) {
        return { display: '0.0%', raw: 0 };
      }

      const ratio = (numVal / denVal) * 100;
      return {
        display: `${ratio.toFixed(1)}%`,
        raw: ratio,
      };
    }

    return { display: '—', raw: null };
  };

  const handleRemoveClick = () => {
    onRemoveSource(sourceKey, hasValues);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">{sourceName}</h3>
              {sourceCode && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs font-medium text-slate-600">
                  {sourceCode}
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-400">Vị trí: #{sortOrder + 1}</p>
          </div>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={handleRemoveClick}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
            title="Xóa Kênh/Nguồn này"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Xóa nguồn</span>
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Đang tải chỉ số của nguồn...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : metrics.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
          Chưa có chỉ số nào được cấu hình cho Kênh/Nguồn này.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Manual Metrics Section */}
          {manualMetrics.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Chỉ số nhập liệu (Manual)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manualMetrics.map((m) => {
                  const isRequired = (m as any).assignment_is_required ?? false;
                  const curVal = metricValues[m.id] !== undefined ? metricValues[m.id] : '';

                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor={`metric-${sourceKey}-${m.id}`}
                          className="text-xs font-semibold text-slate-700 truncate"
                          title={m.name}
                        >
                          {m.name}
                          {isRequired && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        {m.unit && (
                          <span className="text-2xs font-medium text-slate-400 shrink-0 ml-1">
                            ({m.unit})
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          id={`metric-${sourceKey}-${m.id}`}
                          type="number"
                          min="0"
                          step="any"
                          disabled={disabled}
                          value={curVal}
                          onChange={(e) =>
                            onChangeMetricValue(
                              sourceKey,
                              m.id,
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calculated Metrics Section */}
          {calculatedMetrics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calculator className="h-3.5 w-3.5 text-indigo-600" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Chỉ số tự động tính (Calculated)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {calculatedMetrics.map((m) => {
                  const res = computeCalculatedValue(m);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/40 p-3"
                    >
                      <div className="truncate pr-2">
                        <span className="block text-xs font-medium text-slate-700 truncate" title={m.name}>
                          {m.name}
                        </span>
                        <span className="text-2xs text-indigo-600/80 font-medium">Tự động từ nguồn này</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-bold text-indigo-700 font-mono">
                          {res.display}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
