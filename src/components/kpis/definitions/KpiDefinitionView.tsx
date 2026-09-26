import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2, BookOpen } from 'lucide-react';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';
import { KpiDefinition, KpiMeasurementType, KpiDirection } from '../../../types/kpi';
import { KpiDefinitionForm } from './KpiDefinitionForm';

const MEASUREMENT_LABELS: Record<KpiMeasurementType, string> = {
  number: 'Số lượng',
  percentage: 'Tỷ lệ %',
  currency: 'Tiền tệ',
  rating: 'Điểm đánh giá',
  boolean: 'Đạt/Không đạt',
  milestone: 'Cột mốc (Ngày)',
  duration: 'Thời lượng'
};

const DIRECTION_LABELS: Record<KpiDirection, string> = {
  higher_is_better: 'Càng cao càng tốt',
  lower_is_better: 'Càng thấp càng tốt',
  target_range: 'Trong khoảng mục tiêu',
  exact_target: 'Đúng mục tiêu'
};

export const KpiDefinitionView: React.FC = () => {
  const { systemRole, primaryUnit, isAdmin } = useAuth();
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<KpiDefinition | undefined>(undefined);

  const fetchDefinitions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await kpiService.getDefinitions(undefined);
      if (error) throw error;
      setDefinitions(data || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh mục KPI');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, [primaryUnit]);

  const handleOpenCreate = () => {
    setSelectedDefinition(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (definition: KpiDefinition) => {
    setSelectedDefinition(definition);
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
          <h2 className="text-lg font-bold text-slate-900">Danh mục KPI</h2>
          <p className="text-sm text-slate-500">Từ điển các thước đo KPI tiêu chuẩn</p>
        </div>
        {(isAdmin || systemRole === 'manager') && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Thêm thước đo
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      ) : definitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <BookOpen className="h-12 w-12 text-slate-300 mb-3" />
          <p>Chưa có danh mục KPI nào.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tên KPI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Loại đo lường</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Chiều hướng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {definitions.map((def) => (
                <tr key={def.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{def.code}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{def.name}</div>
                    {def.category && <div className="text-xs text-slate-500 mt-1">{def.category}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {MEASUREMENT_LABELS[def.measurement_type] || def.measurement_type}
                    {def.unit_code && <span className="ml-1 text-xs text-slate-400">({def.unit_code})</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {DIRECTION_LABELS[def.direction] || def.direction}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${def.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                      {def.is_active ? 'Hoạt động' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(isAdmin || (systemRole === 'manager' && def.owner_organization_unit_id === primaryUnit?.id)) && (
                      <button
                        onClick={() => handleOpenEdit(def)}
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
        <KpiDefinitionForm
          definition={selectedDefinition}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchDefinitions();
          }}
        />
      )}
    </div>
  );
};
