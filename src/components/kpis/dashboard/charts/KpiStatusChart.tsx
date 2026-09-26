import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { BarChart2, Loader2 } from 'lucide-react';
import { KpiDashboardSummary } from '../../../../types/kpi';

interface KpiStatusChartProps {
  summary: KpiDashboardSummary | null;
  loading: boolean;
  error: string | null;
}

export const KpiStatusChart: React.FC<KpiStatusChartProps> = ({ summary, loading, error }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs relative flex flex-col h-full">
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
            Tình hình thực hiện KPI
          </h2>
        </div>
      </div>
      
      <div className="flex-1 min-h-[300px]">
        {error ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-red-600 bg-red-50 rounded-lg">
            Không thể hiển thị biểu đồ KPI.
          </div>
        ) : !summary || summary.assignment_count === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-slate-500 bg-slate-50/60 border border-dashed border-slate-200 rounded-lg">
            Chưa có dữ liệu để hiển thị biểu đồ.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Đang thực hiện', value: summary.active_count },
                { name: 'Đã đóng', value: summary.closed_count },
                { name: 'Đã khóa', value: summary.locked_count },
              ].filter(d => d.value > 0)}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [value, 'Số lượng']}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
