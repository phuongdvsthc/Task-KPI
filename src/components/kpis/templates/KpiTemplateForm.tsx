import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { KpiTemplate, KpiScopeType } from '../../../types/kpi';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';

interface KpiTemplateFormProps {
  template?: KpiTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiTemplateForm: React.FC<KpiTemplateFormProps> = ({ template, onClose, onSuccess }) => {
  const { isAdmin, primaryUnit } = useAuth();
  
  const [formData, setFormData] = useState<Partial<KpiTemplate>>(
    template || {
      code: '',
      name: '',
      scope_type: 'individual',
      owner_organization_unit_id: isAdmin ? null : primaryUnit?.id || null,
      is_active: true
    }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.code || !formData.name) {
      setError('Vui lòng điền mã và tên mẫu');
      return;
    }

    setIsSubmitting(true);
    try {
      if (template?.id) {
        const { error: updateError } = await kpiService.updateTemplate(template.id, formData);
        if (updateError) throw updateError;
      } else {
        const { error: createError } = await kpiService.createTemplate(formData);
        if (createError) throw createError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi lưu mẫu KPI');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800">
            {template ? 'Cập nhật mẫu KPI' : 'Thêm mẫu KPI mới'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã mẫu <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.code || ''}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder="VD: TPL_GV_2024"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên mẫu <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Mẫu KPI Giảng viên 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi áp dụng <span className="text-red-500">*</span></label>
              <select
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                value={formData.scope_type || 'individual'}
                onChange={e => setFormData({ ...formData, scope_type: e.target.value as KpiScopeType })}
              >
                <option value="individual">Cá nhân</option>
                <option value="organization">Đơn vị</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">Đang hoạt động</label>
            </div>

            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-1">Chủ sở hữu mẫu</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.owner_organization_unit_id === null ? 'global' : 'unit'}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({ ...formData, owner_organization_unit_id: val === 'global' ? null : primaryUnit?.id || null });
                  }}
                >
                  <option value="global">Toàn trường (Global)</option>
                  <option value="unit">Đơn vị ({primaryUnit?.name || 'Unknown'})</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Lưu lại</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
