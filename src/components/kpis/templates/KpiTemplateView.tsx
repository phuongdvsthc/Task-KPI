import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2, Layers, Eye } from 'lucide-react';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';
import { KpiTemplate, KpiTemplateVersion } from '../../../types/kpi';
import { KpiTemplateForm } from './KpiTemplateForm';
import { KpiTemplateDetailView } from './KpiTemplateDetailView';

export const KpiTemplateView: React.FC = () => {
  const { systemRole, primaryUnit, isAdmin } = useAuth();
  
  // Check if we're on a specific template detail page
  const hash = window.location.hash;
  const isDetail = hash.includes('/templates/');
  const templateIdMatch = hash.match(/templates\/([a-zA-Z0-9-]+)/);
  const selectedTemplateId = isDetail && templateIdMatch ? templateIdMatch[1] : null;

  const [templates, setTemplates] = useState<(KpiTemplate & { versions?: KpiTemplateVersion[] })[]>([]);
  const [isLoading, setIsLoading] = useState(!isDetail);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<KpiTemplate | undefined>(undefined);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await kpiService.getTemplates(undefined);
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách mẫu KPI');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isDetail) {
      fetchTemplates();
    }
  }, [primaryUnit, isDetail]);

  const handleOpenCreate = () => {
    setEditingTemplate(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (template: KpiTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  if (isDetail && selectedTemplateId) {
    return <KpiTemplateDetailView templateId={selectedTemplateId} onBack={() => window.location.hash = '#/kpis/templates'} />;
  }

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
          <h2 className="text-lg font-bold text-slate-900">Mẫu KPI</h2>
          <p className="text-sm text-slate-500">Quản lý các mẫu KPI tiêu chuẩn áp dụng cho tổ chức hoặc cá nhân</p>
        </div>
        {(isAdmin || systemRole === 'manager') && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tạo mẫu mới
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Layers className="h-12 w-12 text-slate-300 mb-3" />
          <p>Chưa có mẫu KPI nào.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã mẫu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tên mẫu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phạm vi áp dụng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phiên bản mới nhất</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {templates.map((tpl) => {
                const isOwner = isAdmin || (systemRole === 'manager' && tpl.owner_organization_unit_id === primaryUnit?.id);
                return (
                  <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{tpl.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{tpl.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {tpl.scope_type === 'individual' ? 'Cá nhân' : tpl.scope_type === 'organization' ? 'Đơn vị' : tpl.scope_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {tpl.latest_version ? `v${tpl.latest_version}` : 'Chưa có'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tpl.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          Đã ẩn
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => window.location.hash = `#/kpis/templates/${tpl.id}`}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleOpenEdit(tpl)}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                            title="Sửa thông tin mẫu"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <KpiTemplateForm
          template={editingTemplate}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
};
