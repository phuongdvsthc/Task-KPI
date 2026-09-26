import React from 'react';
import { AggregatedSourceGroup } from '../../../types/manager-report';
import { BarChart3, Layers, Info, CheckCircle2 } from 'lucide-react';

interface Props {
  data: AggregatedSourceGroup[];
  isLoading: boolean;
  error: string | null;
  selectedSourceFilter: string;
}

export const DailyTeamMetricSummary: React.FC<Props> = ({
  data,
  isLoading,
  error,
  selectedSourceFilter,
}) => {
  // Filter by source if filter is active
  const filteredData = React.useMemo(() => {
    if (!selectedSourceFilter || selectedSourceFilter === 'all') return data;
    return data.filter(
      (g) => g.source_id === selectedSourceFilter || g.source_name === selectedSourceFilter
    );
  }, [data, selectedSourceFilter]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Tổng hợp kết quả (Team Metric Summary)
            </h3>
            <p className="text-xs text-slate-500">
              Tổng hợp từ các báo cáo Đã nộp (Submitted) của toàn đội ngũ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Chỉ tính báo cáo đã nộp (loại trừ Nháp)</span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="text-xs font-medium">Đang tổng hợp số liệu đội ngũ...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-100">
          Không thể tải tổng hợp kết quả: {error}
        </div>
      )}

      {!isLoading && !error && filteredData.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <Layers className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600">Chưa có số liệu tổng hợp</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Ngày này chưa có nhân viên nào nộp báo cáo hoặc chưa có số liệu theo nguồn.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredData.length > 0 && (
        <div className="space-y-4">
          {filteredData.map((group) => {
            const manualMetrics = group.metrics.filter((m) => !m.is_calculated);
            const calculatedMetrics = group.metrics.filter((m) => m.is_calculated);

            return (
              <div
                key={group.source_id || group.source_name}
                className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3"
              >
                {/* Source Title */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {group.source_name || 'Kênh trực tiếp'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {group.report_count} báo cáo nộp
                  </span>
                </div>

                {/* Manual Metric Sums */}
                {manualMetrics.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-2">
                      Tổng số liệu thực hiện (SUM):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {manualMetrics.map((m) => (
                        <div
                          key={m.metric_id}
                          className="rounded-lg bg-white p-2.5 border border-slate-200/80 shadow-2xs"
                        >
                          <span className="text-[11px] text-slate-500 block truncate" title={m.name}>
                            {m.name}
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-800">
                              {(m.sum_value || 0).toLocaleString('vi-VN')}
                            </span>
                            {m.unit && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {m.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calculated Ratios: SUM(num) / SUM(den) * 100 */}
                {calculatedMetrics.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/70">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 mb-2">
                      <span>Tỷ lệ chuyển đổi tổng hợp (SUM Numerator / SUM Denominator):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {calculatedMetrics.map((cm) => (
                        <div
                          key={cm.metric_id}
                          className="rounded-lg bg-indigo-50/70 p-2.5 border border-indigo-100 flex items-center justify-between"
                        >
                          <div>
                            <span className="text-[11px] font-semibold text-slate-700 block">
                              {cm.name}
                            </span>
                            {cm.numerator_sum !== undefined && cm.denominator_sum !== undefined && (
                              <span className="text-[10px] text-slate-400 block">
                                Tổng: {cm.numerator_sum.toLocaleString('vi-VN')} / {cm.denominator_sum.toLocaleString('vi-VN')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs">
                            {cm.display_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 italic pt-1">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              Công thức tỷ lệ tổng hợp tính theo tổng mẫu số &amp; tử số toàn đội ngũ, không cộng trung bình tỷ lệ cá nhân.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
