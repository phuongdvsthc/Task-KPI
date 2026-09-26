import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart2, Loader2 } from 'lucide-react';
import { KpiDashboardUnitBreakdown, KpiDashboardResultMode } from '../../../../types/kpi';

interface KpiUnitScoreChartProps {
  unitBreakdown: KpiDashboardUnitBreakdown[];
  resultMode: KpiDashboardResultMode;
  loading: boolean;
  error: string | null;
}

export const KpiUnitScoreChart: React.FC<KpiUnitScoreChartProps> = ({ 
  unitBreakdown, 
  resultMode,
  loading, 
  error 
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs relative flex flex-col h-full lg:col-span-1">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
           <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <span className="text-sm font-medium text-slate-600">Đang tải biểu đồ...</span>
           </div>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Điểm KPI theo đơn vị
          </h2>
        </div>
      </div>

      <div className="flex-1 min-h-[300px]">
        {error ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-red-600 bg-red-50 rounded-lg">
            Không thể hiển thị biểu đồ KPI.
          </div>
        ) : !unitBreakdown || unitBreakdown.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-slate-500 bg-slate-50/60 border border-dashed border-slate-200 rounded-lg">
            Chưa có dữ liệu để hiển thị biểu đồ.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={unitBreakdown.map(u => ({
                name: u.unit_name,
                live: u.live_average_score !== null ? Number(u.live_average_score) : null,
                official: u.official_average_score !== null ? Number(u.official_average_score) : null,
              }))}
              margin={{ top: 20, right: 10, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                axisLine={{ stroke: '#cbd5e1' }} 
                tickLine={false} 
                angle={-45} 
                textAnchor="end" 
                height={60}
              />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any) => {
                  if (value === null || value === undefined) return ['—', name === 'live' ? 'Điểm tạm tính' : 'Điểm chính thức'];
                  return [value, name === 'live' ? 'Điểm tạm tính' : 'Điểm chính thức'];
                }}
                labelStyle={{ color: '#0f172a', fontWeight: 600, marginBottom: '8px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                formatter={(value) => <span className="text-sm font-medium text-slate-700 ml-1 mr-3">{value === 'live' ? 'Điểm tạm tính' : 'Điểm chính thức'}</span>}
              />
              {(resultMode === 'all' || resultMode === 'live') && (
                <Bar dataKey="live" name="live" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
              )}
              {(resultMode === 'all' || resultMode === 'official') && (
                <Bar dataKey="official" name="official" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={40} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
