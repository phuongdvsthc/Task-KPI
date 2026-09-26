import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { KpiObjective } from '../../../types/kpi';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';

interface KpiObjectiveFormProps {
  objective?: KpiObjective;
  parentObjectiveId: string | null;
  objectives: KpiObjective[];
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiObjectiveForm: React.FC<KpiObjectiveFormProps> = ({ objective, parentObjectiveId, objectives, onClose, onSuccess }) => {
  const { isAdmin, primaryUnit } = useAuth();
  
  const [formData, setFormData] = useState<Partial<KpiObjective>>(
    objective || {
      code: '',
      name: '',
      description: '',
      parent_objective_id: parentObjectiveId,
      organization_unit_id: isAdmin ? null : primaryUnit?.id || null,
      period_id: null,
      objective_level: 1, // Will be calculated on save if parent exists
      status: 'active',
      sort_order: 10
    }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out self and descendants for parent selection
  const getDescendantIds = (objId: string): string[] => {
    let ids: string[] = [];
    const children = objectives.filter(o => o.parent_objective_id === objId);
    children.forEach(child => {
      ids.push(child.id);
      ids = ids.concat(getDescendantIds(child.id));
    });
    return ids;
  };

  const invalidParentIds = objective ? [objective.id, ...getDescendantIds(objective.id)] : [];
  const validParents = objectives.filter(o => !invalidParentIds.includes(o.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.code || !formData.name) {
      setError('Vui lòng điền mã và tên mục tiêu');
      return;
    }

    // Calculate level
    let level = 1;
    if (formData.parent_objective_id) {
      const parent = objectives.find(o => o.id === formData.parent_objective_id);
      if (parent) {
        level = (parent.objective_level || 1) + 1;
      }
    }
    const dataToSave = { ...formData, objective_level: level };

    setIsSubmitting(true);
    try {
      if (objective?.id) {
        const { error: updateError } = await kpiService.updateObjective(objective.id, dataToSave);
        if (updateError) throw updateError;
      } else {
        const { error: createError } = await kpiService.createObjective(dataToSave);
        if (createError) throw createError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi lưu mục tiêu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800">
            {objective ? 'Cập nhật mục tiêu' : 'Thêm mục tiêu mới'}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Mục tiêu cha</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                value={formData.parent_objective_id || ''}
                onChange={e => setFormData({ ...formData, parent_objective_id: e.target.value || null })}
              >
                <option value="">-- Không có (Mục tiêu gốc) --</option>
                {validParents.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã mục tiêu <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.code || ''}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder="VD: MT01"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên mục tiêu <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Nâng cao chất lượng đào tạo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Thứ tự hiển thị</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  value={formData.sort_order || 0}
                  onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                <select
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.status || 'active'}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={formData.organization_unit_id === null ? 'global' : 'unit'}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({ ...formData, organization_unit_id: val === 'global' ? null : primaryUnit?.id || null });
                  }}
                >
                  <option value="global">Toàn trường (Global)</option>
                  <option value="unit">Theo đơn vị ({primaryUnit?.name || 'Unknown'})</option>
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
