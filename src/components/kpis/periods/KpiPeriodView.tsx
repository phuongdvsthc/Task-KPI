import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2, Calendar } from 'lucide-react';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';
import { KpiPeriod, KpiPeriodType, KpiPeriodStatus } from '../../../types/kpi';
import { KpiPeriodForm } from './KpiPeriodForm';

const PERIOD_TYPE_LABELS: Record<KpiPeriodType, string> = {
  monthly: 'Tháng',
  quarterly: 'Quý',
  semester: 'Học kỳ',
  academic_year: 'Năm học',
  yearly: 'Năm',
  custom: 'Tùy chỉnh'
};

const PERIOD_STATUS_LABELS: Record<KpiPeriodStatus, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'bg-slate-100 text-slate-800' },
  active: { label: 'Đang hoạt động', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Đã đóng', color: 'bg-amber-100 text-amber-800' },
  archived: { label: 'Lưu trữ', color: 'bg-slate-200 text-slate-500' }
};

export const KpiPeriodView: React.FC = () => {
  const { systemRole, primaryUnit, isAdmin } = useAuth();
  const [periods, setPeriods] = useState<KpiPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<KpiPeriod | undefined>(undefined);

  const fetchPeriods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Admin sees global (or all). Manager sees unit scoped.
      // Wait, admin might want to see all periods, but for now we'll fetch based on RLS.
      const { data, error } = await kpiService.getPeriods(undefined); // undefined means no filter on client side, let RLS do it or fetch all if admin
      if (error) throw error;
      setPeriods(data || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách kỳ đánh giá');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, [primaryUnit]);

  const handleOpenCreate = () => {
    setSelectedPeriod(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (period: KpiPeriod) => {
    setSelectedPeriod(period);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kỳ đánh giá</h2>
          <p className="text-sm text-slate-500">Quản lý các kỳ đánh giá KPI</p>
        </div>
        {(isAdmin || systemRole === 'manager') && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tạo mới
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Calendar className="h-12 w-12 text-slate-300 mb-3" />
          <p>Chưa có kỳ đánh giá nào.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tên</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Loại</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Đơn vị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {periods.map((period) => (
                <tr key={period.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{period.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{period.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {PERIOD_TYPE_LABELS[period.period_type] || period.period_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {period.start_date} - {period.end_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {period.organization_unit_id ? 'Nội bộ đơn vị' : 'Toàn trường'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PERIOD_STATUS_LABELS[period.status]?.color || 'bg-slate-100 text-slate-800'}`}>
                      {PERIOD_STATUS_LABELS[period.status]?.label || period.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(isAdmin || (systemRole === 'manager' && period.organization_unit_id === primaryUnit?.id)) && (
                      <button
                        onClick={() => handleOpenEdit(period)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <KpiPeriodForm
          period={selectedPeriod}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchPeriods();
          }}
        />
      )}
    </div>
  );
};
