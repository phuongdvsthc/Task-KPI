import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, Database } from 'lucide-react';
import { kpiBindingService } from '../../../services/kpi-binding.service';
import { 
  KpiTemplateItemBinding, 
  KpiBindingSourceType, 
  KpiBindingAggregationMethod, 
  KpiBindingScopeMode 
} from '../../../types/kpi';
import { MetricDefinition } from '../../../types/metric';

interface Props {
  templateItemId: string;
  itemCode: string;
  itemName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiBindingModal: React.FC<Props> = ({ 
  templateItemId, 
  itemCode, 
  itemName, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [bindings, setBindings] = useState<Partial<KpiTemplateItemBinding>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [calculatedMetrics, setCalculatedMetrics] = useState<MetricDefinition[]>([]);
  const taskMeasures = kpiBindingService.getTaskMeasures();

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, templateItemId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bindingsRes, metricsRes, calcMetricsRes] = await Promise.all([
        kpiBindingService.getTemplateItemBindings(templateItemId),
        kpiBindingService.getAvailableMetricSources(),
        kpiBindingService.getAvailableCalculatedMetricSources()
      ]);

      if (bindingsRes.error) throw bindingsRes.error;
      
      setBindings(bindingsRes.data || []);
      setMetrics(metricsRes);
      setCalculatedMetrics(calcMetricsRes);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải cấu hình nguồn dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBinding = () => {
    setBindings([
      ...bindings, 
      {
        template_item_id: templateItemId,
        binding_key: '',
        source_type: 'manual',
        source_reference_id: null,
        aggregation_method: null,
        scope_mode: 'assignee',
        source_config: { input_role: 'manager' },
        filter_config: {},
        formula_config: {},
        is_active: true,
        sort_order: bindings.length
      }
    ]);
  };

  const handleRemoveBinding = async (index: number) => {
    const binding = bindings[index];
    if (binding.id) {
      if (!confirm('Bạn có chắc chắn muốn xóa nguồn dữ liệu này?')) return;
      setIsSaving(true);
      try {
        const { error } = await kpiBindingService.deleteTemplateItemBinding(binding.id);
        if (error) throw error;
        setBindings(bindings.filter((_, i) => i !== index));
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xóa nguồn dữ liệu');
      } finally {
        setIsSaving(false);
      }
    } else {
      setBindings(bindings.filter((_, i) => i !== index));
    }
  };

  const updateBinding = (index: number, field: keyof KpiTemplateItemBinding, value: any) => {
    const newBindings = [...bindings];
    const binding = { ...newBindings[index], [field]: value };
    
    // Auto-adjust fields based on source_type
    if (field === 'source_type') {
      const type = value as KpiBindingSourceType;
      binding.source_reference_id = null;
      binding.source_config = {};
      binding.formula_config = {};
      
      if (type === 'metric' || type === 'calculated_metric') {
        binding.aggregation_method = 'sum';
        binding.scope_mode = 'assignee';
      } else if (type === 'task') {
        binding.aggregation_method = null;
        binding.scope_mode = 'assignee';
        binding.source_config = { measure: 'completed_count' };
      } else if (type === 'manual') {
        binding.aggregation_method = null;
        binding.scope_mode = 'assignee';
        binding.source_config = { input_role: 'manager' };
      } else if (type === 'formula') {
        binding.aggregation_method = null;
        binding.scope_mode = null;
        binding.formula_config = { operator: 'divide', multiply: 100 };
      }
    }

    newBindings[index] = binding;
    setBindings(newBindings);
  };

  const updateSourceConfig = (index: number, key: string, value: any) => {
    const newBindings = [...bindings];
    newBindings[index] = {
      ...newBindings[index],
      source_config: {
        ...(newBindings[index].source_config || {}),
        [key]: value
      }
    };
    setBindings(newBindings);
  };

  const handleSave = async () => {
    setError(null);
    
    // Validation
    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i];
      if (!b.binding_key?.trim()) {
        setError(`Binding key ở dòng ${i + 1} không được để trống`);
        return;
      }
      
      // Check duplicate keys
      const duplicateKeys = bindings.filter((x, idx) => idx !== i && x.binding_key === b.binding_key);
      if (duplicateKeys.length > 0) {
        setError(`Binding key "${b.binding_key}" bị trùng lặp`);
        return;
      }

      if ((b.source_type === 'metric' || b.source_type === 'calculated_metric') && !b.source_reference_id) {
        setError(`Vui lòng chọn chỉ số đo lường cho dòng ${i + 1}`);
        return;
      }

      if (b.source_type === 'task' && !b.source_config?.measure) {
        setError(`Vui lòng chọn đại lượng công việc cho dòng ${i + 1}`);
        return;
      }

      if (b.source_type === 'manual' && !b.source_config?.input_role) {
        setError(`Vui lòng chọn đối tượng nhập cho dòng ${i + 1}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      for (const b of bindings) {
        const payload = {
          template_item_id: templateItemId,
          binding_key: b.binding_key!,
          source_type: b.source_type as KpiBindingSourceType,
          source_reference_id: b.source_reference_id || null,
          aggregation_method: b.aggregation_method || null,
          scope_mode: b.scope_mode || null,
          source_config: b.source_config || {},
          filter_config: b.filter_config || {},
          formula_config: b.formula_config || {},
          is_active: b.is_active ?? true,
          sort_order: b.sort_order ?? 0
        };

        if (b.id) {
          const { error } = await kpiBindingService.updateTemplateItemBinding(b.id, payload);
          if (error) throw error;
        } else {
          const { error } = await kpiBindingService.createTemplateItemBinding(payload);
          if (error) throw error;
        }
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Lỗi khi lưu cấu hình nguồn dữ liệu');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-900">Cấu hình nguồn dữ liệu</h2>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">{itemCode}</span>
              <span>{itemName}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
                  {error}
                </div>
              )}

              {bindings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                  <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Chưa có nguồn dữ liệu nào được cấu hình</p>
                  <button
                    onClick={handleAddBinding}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm nguồn dữ liệu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bindings.map((binding, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-700 text-sm">Cấu hình {idx + 1}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveBinding(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Binding Key */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Binding Key <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={binding.binding_key || ''}
                            onChange={(e) => updateBinding(idx, 'binding_key', e.target.value)}
                            placeholder="vd: primary, numerator..."
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Định danh duy nhất cho nguồn dữ liệu này (của tiêu chí này).</p>
                        </div>

                        {/* Source Type */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Loại nguồn</label>
                          <select
                            value={binding.source_type}
                            onChange={(e) => updateBinding(idx, 'source_type', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="metric">Chỉ số đo lường (Metric)</option>
                            <option value="calculated_metric">Chỉ số tính toán (Calculated Metric)</option>
                            <option value="task">Công việc (Task)</option>
                            <option value="manual">Nhập thủ công (Manual)</option>
                            <option value="formula">Công thức nội bộ (Formula)</option>
                          </select>
                        </div>

                        {/* Source specific configs */}
                        {(binding.source_type === 'metric' || binding.source_type === 'calculated_metric') && (
                          <>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Chọn chỉ số <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={binding.source_reference_id || ''}
                                onChange={(e) => updateBinding(idx, 'source_reference_id', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">-- Chọn chỉ số --</option>
                                {(binding.source_type === 'metric' ? metrics : calculatedMetrics).map(m => (
                                  <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Phương pháp tổng hợp</label>
                              <select
                                value={binding.aggregation_method || 'sum'}
                                onChange={(e) => updateBinding(idx, 'aggregation_method', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="sum">Tổng (SUM)</option>
                                <option value="avg">Trung bình (AVG)</option>
                                <option value="count">Đếm (COUNT)</option>
                                <option value="max">Lớn nhất (MAX)</option>
                                <option value="min">Nhỏ nhất (MIN)</option>
                                <option value="latest">Mới nhất (LATEST)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Phạm vi dữ liệu (Scope)</label>
                              <select
                                value={binding.scope_mode || 'assignee'}
                                onChange={(e) => updateBinding(idx, 'scope_mode', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="assignee">Chỉ lấy của đối tượng được giao</option>
                                <option value="assignee_tree">Lấy của đối tượng và cấp dưới (Tree)</option>
                              </select>
                            </div>
                          </>
                        )}

                        {binding.source_type === 'task' && (
                          <>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Đại lượng (Measure) <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={binding.source_config?.measure || ''}
                                onChange={(e) => updateSourceConfig(idx, 'measure', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">-- Chọn đại lượng công việc --</option>
                                {taskMeasures.map(m => (
                                  <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Phạm vi dữ liệu (Scope)</label>
                              <select
                                value={binding.scope_mode || 'assignee'}
                                onChange={(e) => updateBinding(idx, 'scope_mode', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="assignee">Chỉ công việc của đối tượng được giao</option>
                                <option value="assignee_tree">Công việc của đối tượng và cấp dưới</option>
                              </select>
                            </div>
                          </>
                        )}

                        {binding.source_type === 'manual' && (
                          <>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Đối tượng nhập liệu <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={binding.source_config?.input_role || 'manager'}
                                onChange={(e) => updateSourceConfig(idx, 'input_role', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="manager">Chỉ Quản lý (Manager)</option>
                                <option value="staff">Chỉ Nhân viên (Staff - tự đánh giá)</option>
                                <option value="either">Cả hai đều có thể nhập</option>
                              </select>
                            </div>
                            
                            <div className="md:col-span-2 flex items-center gap-6">
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!binding.source_config?.require_note}
                                  onChange={(e) => updateSourceConfig(idx, 'require_note', e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                Bắt buộc ghi chú
                              </label>
                              
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!binding.source_config?.require_evidence}
                                  onChange={(e) => updateSourceConfig(idx, 'require_evidence', e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                Bắt buộc bằng chứng (Link/File)
                              </label>
                            </div>
                          </>
                        )}
                        
                        {binding.source_type === 'formula' && (
                          <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                            <strong>Lưu ý:</strong> Nguồn công thức chỉ dùng để lưu trữ cấu hình, hệ thống tính toán (Formula Resolver) chưa được triển khai trong phiên bản này.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleAddBinding}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm cấu hình nguồn khác
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-white">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu cấu hình
          </button>
        </div>

      </div>
    </div>
  );
};
