import React from 'react';
import { KpiDashboardUnitBreakdown, KpiDashboardResultMode } from '../../../types/kpi';

interface KpiUnitBreakdownTableProps {
  onUnitClick?: (unitId: string) => void;
  data: KpiDashboardUnitBreakdown[];
  resultMode: KpiDashboardResultMode;
  showDetailCounts?: boolean; // Show individual and organization counts (Executive)
  labels?: {
    totalAssignment?: string;
    liveAssignment?: string;
    officialAssignment?: string;
  };
}

export const KpiUnitBreakdownTable: React.FC<KpiUnitBreakdownTableProps> = ({ 
  data, 
  resultMode, 
  showDetailCounts = false,
  labels = {
    totalAssignment: 'Tổng KPI',
    liveAssignment: 'Tạm tính',
    officialAssignment: 'Chính thức'
  },
  onUnitClick
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
        <p className="text-sm font-medium text-slate-600">
          Chưa có dữ liệu KPI theo đơn vị trong phạm vi đang chọn.
        </p>
      </div>
    );
  }

  const sortedData = [...data].sort((a, b) => a.unit_name.localeCompare(b.unit_name));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Đơn vị</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">{labels.totalAssignment}</th>
            
            {showDetailCounts && (
              <>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">KPI cá nhân</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">KPI đơn vị</th>
              </>
            )}
            
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">{labels.liveAssignment}</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">{labels.officialAssignment}</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap">Chưa đủ dữ liệu</th>
            
            <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right whitespace-nowrap ${resultMode === 'official' ? 'text-slate-400' : 'text-indigo-700'}`}>Điểm tạm tính</th>
            <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right whitespace-nowrap ${resultMode === 'live' ? 'text-slate-400' : 'text-emerald-700'}`}>Điểm chính thức</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sortedData.map((row) => (
            <tr key={row.unit_id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{row.unit_name}</div>
                {row.unit_code && <div className="text-xs text-slate-500 font-mono mt-0.5">{row.unit_code}</div>}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">
                {row.assignment_count}
              </td>
              
              {showDetailCounts && (
                <>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.individual_assignment_count}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.organization_assignment_count}
                  </td>
                </>
              )}

              <td className="px-4 py-3 text-right text-slate-600">
                {row.live_assignment_count}
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {row.official_assignment_count}
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
