import React from 'react';
import { KpiDashboardKpiBreakdown, KpiDashboardResultMode } from '../../../types/kpi';

interface KpiPortfolioTableProps {
  onKpiClick?: (kpiKey: string) => void;
  data: KpiDashboardKpiBreakdown[];
  resultMode: KpiDashboardResultMode;
}

export const KpiPortfolioTable: React.FC<KpiPortfolioTableProps> = ({ 
  data, 
  resultMode 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
        <p className="text-sm font-medium text-slate-600">
          Chưa có dữ liệu KPI phù hợp với phạm vi đang chọn.
        </p>
      </div>
    );
  }

  // Stable KPI Identity grouping is done by backend. We just sort them here.
  const sortedData = [...data].sort((a, b) => {
    // If backend has no stable order, sort by name then code
    const nameCmp = (a.kpi_name || '').localeCompare(b.kpi_name || '');
    if (nameCmp !== 0) return nameCmp;
    return (a.kpi_code || '').localeCompare(b.kpi_code || '');
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">KPI</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Số lượt giao</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Số dòng KPI</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Đã có điểm</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Chưa đủ dữ liệu</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Tạm tính</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Chính thức</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Thành tích TB</th>
            <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right whitespace-nowrap ${resultMode === 'official' ? 'text-slate-400' : 'text-indigo-700'}`}>Điểm tạm tính TB</th>
            <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right whitespace-nowrap ${resultMode === 'live' ? 'text-slate-400' : 'text-emerald-700'}`}>Điểm chính thức TB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sortedData.map((row) => (
            <tr key={row.kpi_key || row.kpi_code || row.kpi_name} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{row.kpi_name}</div>
                {row.kpi_code && <div className="text-xs text-slate-500 font-mono mt-0.5">{row.kpi_code}</div>}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">
                {row.assignment_count}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {row.item_count}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {row.scored_count}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="text-amber-600 font-medium text-sm whitespace-nowrap">
                  {(row.partial_count ?? 0) + (row.unscored_count ?? 0) > 0 ? (
                    <>
                      <span title="Một phần">{row.partial_count ?? 0} một phần</span> <span className="text-amber-400 mx-1">·</span> <span title="Chưa có điểm">{row.unscored_count ?? 0} chưa có điểm</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {row.live_count}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {row.official_count}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium text-slate-900">
                  {row.average_achievement_percent === null || row.average_achievement_percent === undefined 
                    ? '—' 
                    : `${row.average_achievement_percent}%`}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold ${resultMode === 'official' ? 'text-slate-400' : 'text-indigo-600'}`}>
                  {resultMode === 'official' ? '—' : (row.live_average_score === null || row.live_average_score === undefined ? '—' : row.live_average_score)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold ${resultMode === 'live' ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {resultMode === 'live' ? '—' : (row.official_average_score === null || row.official_average_score === undefined ? '—' : row.official_average_score)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
