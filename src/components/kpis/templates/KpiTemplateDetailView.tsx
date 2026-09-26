import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Copy, CheckCircle, AlertTriangle, Loader2, Edit2, Trash2 } from 'lucide-react';
import { kpiService } from '../../../services/kpi.service';
import { kpiBindingService } from '../../../services/kpi-binding.service';
import { useAuth } from '../../../context/AuthContext';
import { KpiTemplate, KpiTemplateVersion, KpiTemplateItem, KpiTemplateStatus, KpiTemplateItemBinding } from '../../../types/kpi';
import { MetricDefinition } from '../../../types/metric';
import { KpiTemplateItemForm } from './KpiTemplateItemForm';
import { KpiBindingModal } from './KpiBindingModal';

interface Props {
  templateId: string;
  onBack: () => void;
}

export const KpiTemplateDetailView: React.FC<Props> = ({ templateId, onBack }) => {
  const { systemRole, primaryUnit, isAdmin } = useAuth();
  
  const [template, setTemplate] = useState<KpiTemplate | null>(null);
  const [versions, setVersions] = useState<KpiTemplateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [items, setItems] = useState<KpiTemplateItem[]>([]);
  const [bindings, setBindings] = useState<KpiTemplateItemBinding[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KpiTemplateItem | undefined>(undefined);
  const [bindingModalItem, setBindingModalItem] = useState<KpiTemplateItem | null>(null);
  
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const fetchTemplateData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: tpls, error: tError } = await kpiService.getTemplates(undefined);
      if (tError) throw tError;
      const tpl = (tpls || []).find(t => t.id === templateId);
      if (!tpl) throw new Error('Không tìm thấy mẫu KPI');
      setTemplate(tpl);

      const { data: vs, error: vError } = await kpiService.getTemplateVersions(templateId);
      if (vError) throw vError;
      setVersions(vs || []);
      
      if (vs && vs.length > 0) {
        setSelectedVersionId(vs[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu mẫu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplateData();
  }, [templateId]);

  const fetchItems = async (versionId: string) => {
    setIsItemsLoading(true);
    try {
      const { data, error } = await kpiService.getTemplateItems(versionId);
      if (error) throw error;
      setItems(data || []);

      const [bindingsRes, metricsRes, calcMetricsRes] = await Promise.all([
        kpiBindingService.getTemplateVersionBindings(versionId),
        kpiBindingService.getAvailableMetricSources(),
        kpiBindingService.getAvailableCalculatedMetricSources()
      ]);
      
      setBindings(bindingsRes.data || []);
      setMetrics([...metricsRes, ...calcMetricsRes]);
    } catch (err: any) {
      console.error(err);
      // Just keep items empty on error to let user know
      setItems([]);
      setBindings([]);
    } finally {
      setIsItemsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVersionId) {
      fetchItems(selectedVersionId);
    }
  }, [selectedVersionId]);

  const handleCloneVersion = async (sourceId: string) => {
    try {
      const { data, error } = await kpiService.cloneTemplateVersion(templateId, sourceId);
      if (error) throw error;
      await fetchTemplateData();
      if (data) setSelectedVersionId(data.id);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi nhân bản phiên bản');
    }
  };

  const handleCreateDraft = async () => {
    try {
      const { data: vs, error: vError } = await kpiService.getTemplateVersions(templateId);
      if (vError) throw vError;
      
      // If there's a draft already, just select it
      const existingDraft = vs?.find(v => v.status === 'draft');
      if (existingDraft) {
        setSelectedVersionId(existingDraft.id);
        return;
      }

      // Create empty draft
      const nextVersion = (vs?.[0]?.version_no || 0) + 1;
      const { data, error } = await kpiService.cloneTemplateVersion(templateId, vs?.[0]?.id || '');
      if (error) throw error;
      
      await fetchTemplateData();
      if (data) setSelectedVersionId(data.id);
    } catch (err: any) {
      alert(err.message || 'Lỗi tạo bản nháp');
    }
  };

  const handlePublishClick = (currentTotalWeight: number) => {
    console.debug('[KPI Publish] button clicked', { versionId: selectedVersionId, currentTotalWeight, itemCount: items.length });
    
    if (Math.abs(currentTotalWeight - 100) > 0.0001) {
      console.warn('[KPI Publish] blocked: weight invalid', { currentTotalWeight });
      alert('Tổng trọng số phải đúng 100% để xuất bản.');
      return;
    }
    if (items.length === 0) {
      console.warn('[KPI Publish] blocked: no items');
      alert('Cần ít nhất 1 mục tiêu/chỉ số để xuất bản.');
      return;
    }
    
    console.debug('[KPI Publish] confirmation opened');
    setShowPublishConfirm(true);
  };

  const handleConfirmPublish = async () => {
    if (!selectedVersionId) return;
    
    console.debug('[KPI Publish] confirmed by user');
    setIsPublishing(true);
    
    try {
      console.debug('[KPI Publish] before service call');
      const { error } = await kpiService.updateTemplateVersionStatus(selectedVersionId, 'published');
      console.debug('[KPI Publish] service result', { error });
      
      if (error) throw error;
      
      await fetchTemplateData();
      alert('Xuất bản mẫu KPI thành công!');
      setShowPublishConfirm(false);
    } catch (err: any) {
      console.error('KPI publish failed', err);
      alert(err.message || 'Lỗi khi xuất bản. Vui lòng kiểm tra lại quyền của bạn.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancelPublish = () => {
    setShowPublishConfirm(false);
  };

  const handleRetire = async (versionId: string) => {
    if (!window.confirm('Bạn có chắc muốn dừng áp dụng (retired) phiên bản này?')) return;
    try {
      const { error } = await kpiService.updateTemplateVersionStatus(versionId, 'retired');
      if (error) throw error;
      await fetchTemplateData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thao tác');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Xóa tiêu chí này khỏi mẫu?')) return;
    try {
      const { error } = await kpiService.deleteTemplateItem(itemId);
      if (error) throw error;
      if (selectedVersionId) fetchItems(selectedVersionId);
    } catch (err: any) {
      alert(err.message || 'Lỗi xóa tiêu chí');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error || 'Không tìm thấy mẫu'}
        </div>
      </div>
    );
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const isDraft = selectedVersion?.status === 'draft';
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const isOwner = isAdmin || (systemRole === 'manager' && template.owner_organization_unit_id === primaryUnit?.id);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.0001;
  const canPublish = isDraft && items.length > 0 && isWeightValid;

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 font-medium transition-colors">
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách mẫu
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900">{template.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                {template.is_active ? 'Hoạt động' : 'Đã ẩn'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>Mã: <strong className="text-slate-700">{template.code}</strong></span>
              <span>•</span>
              <span>Áp dụng: <strong className="text-slate-700">{template.scope_type === 'individual' ? 'Cá nhân' : 'Đơn vị'}</strong></span>
            </div>
          </div>
          
          {isOwner && (
            <button
              onClick={handleCreateDraft}
              className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" /> Bản nháp mới
            </button>
          )}
        </div>
        
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex gap-2 overflow-x-auto">
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => setSelectedVersionId(v.id)}
              className={`flex flex-col items-start px-4 py-2.5 rounded-lg border min-w-[140px] transition-colors ${
                selectedVersionId === v.id 
                  ? 'bg-white border-indigo-300 ring-1 ring-indigo-500 shadow-xs' 
                  : 'bg-white border-slate-200 hover:border-indigo-200 text-slate-600'
              }`}
            >
              <span className={`text-sm font-bold ${selectedVersionId === v.id ? 'text-indigo-900' : ''}`}>Version {v.version_no}</span>
              <span className={`text-[11px] font-medium mt-1 px-1.5 py-0.5 rounded ${
                v.status === 'published' ? 'bg-green-100 text-green-800' : 
                v.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {v.status === 'published' ? 'Đã xuất bản' : v.status === 'draft' ? 'Bản nháp' : 'Đã dừng'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedVersion && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-slate-800">
                Chi tiết Version {selectedVersion.version_no}
              </h3>
              
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                isWeightValid 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                {isWeightValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                Tổng trọng số: {totalWeight}%
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  onClick={() => handleCloneVersion(selectedVersion.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
                >
                  <Copy className="h-4 w-4" /> Nhân bản
                </button>
              )}
              
              {isOwner && isDraft && (
                <button
                  onClick={() => setIsItemFormOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-700 px-3 py-1.5 text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  <Plus className="h-4 w-4" /> Thêm tiêu chí
                </button>
              )}

              {isOwner && isDraft && (
                <button
                  type="button"
                  onClick={() => handlePublishClick(totalWeight)}
                  disabled={!canPublish}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" /> Xuất bản
                </button>
              )}
              
              {isOwner && selectedVersion.status === 'published' && (
                <button
                  onClick={() => handleRetire(selectedVersion.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors shadow-xs"
                >
                  Dừng áp dụng
                </button>
              )}
            </div>
          </div>

          {isItemsLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>Chưa có tiêu chí đánh giá nào trong phiên bản này.</p>
              {isDraft && isOwner && (
                <button
                  onClick={() => setIsItemFormOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" /> Thêm tiêu chí đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">KPI</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mục tiêu (Cha)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nguồn dữ liệu</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Trọng số</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Chỉ tiêu (Target)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tính điểm</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Bắt buộc</th>
                    {isOwner && isDraft && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-bold text-slate-900">{item.definition?.name || 'KPI Không xác định'}</div>
                        <div className="text-xs text-slate-500">{item.definition?.code} • {item.definition?.measurement_type}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {item.objective ? (
                          <div className="truncate max-w-[200px]" title={item.objective.name}>
                            {item.objective.code} - {item.objective.name}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {(() => {
                          const itemBindings = bindings.filter(b => b.template_item_id === item.id);
                          
                          if (itemBindings.length === 0) {
                            return (
                              <div className="flex flex-col gap-2">
                                <span className="text-slate-400 italic">Chưa cấu hình</span>
                                {isDraft && (
                                  <button
                                    onClick={() => setBindingModalItem(item)}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium text-left"
                                  >
                                    Cấu hình nguồn dữ liệu
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1.5">
                              {itemBindings.map(b => {
                                let summary = '';
                                if (b.source_type === 'metric' || b.source_type === 'calculated_metric') {
                                  const metric = metrics.find(m => m.id === b.source_reference_id);
                                  summary = `Metric · ${metric?.name || 'Không xác định'} · ${b.aggregation_method?.toUpperCase() || 'SUM'}`;
                                } else if (b.source_type === 'task') {
                                  const measure = kpiBindingService.getTaskMeasures().find(m => m.value === b.source_config?.measure);
                                  summary = `Task · ${measure?.label || 'Không xác định'}`;
                                } else if (b.source_type === 'manual') {
                                  const role = b.source_config?.input_role === 'manager' ? 'Manager nhập' : b.source_config?.input_role === 'staff' ? 'Staff nhập' : 'Ai cũng có thể nhập';
                                  summary = `Manual · ${role}`;
                                } else if (b.source_type === 'formula') {
                                  summary = `Formula`;
                                }

                                return (
                                  <div key={b.id} className="text-xs border border-slate-200 bg-slate-50 px-2 py-1 rounded truncate max-w-[200px]" title={`${b.binding_key}: ${summary}`}>
                                    <span className="font-semibold text-slate-700 mr-1">{b.binding_key}:</span>
                                    {summary}
                                  </div>
                                );
                              })}
                              
                              {isDraft && (
                                <button
                                  onClick={() => setBindingModalItem(item)}
                                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium text-left mt-1"
                                >
                                  Sửa cấu hình
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm">
                          {item.weight}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <pre className="text-[10px] bg-slate-50 p-1 rounded border border-slate-100 max-w-[150px] overflow-hidden truncate">
                          {JSON.stringify(item.target_config)}
                        </pre>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <pre className="text-[10px] bg-slate-50 p-1 rounded border border-slate-100 max-w-[150px] overflow-hidden truncate">
                          {JSON.stringify(item.scoring_config)}
                        </pre>
                        {item.cap_percent && <div className="text-xs mt-1 text-slate-400">Max: {item.cap_percent}%</div>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.is_required ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : '-'}
                      </td>
                      {isOwner && isDraft && (
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsItemFormOpen(true);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1.5 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isItemFormOpen && selectedVersion && (
        <KpiTemplateItemForm
          templateVersionId={selectedVersion.id}
          item={selectedItem}
          existingItems={items}
          onClose={() => {
            setIsItemFormOpen(false);
            setSelectedItem(undefined);
          }}
          onSuccess={() => {
            setIsItemFormOpen(false);
            setSelectedItem(undefined);
            fetchItems(selectedVersion.id);
          }}
        />
      )}

      {bindingModalItem && (
        <KpiBindingModal
          templateItemId={bindingModalItem.id}
          itemCode={bindingModalItem.definition?.code || ''}
          itemName={bindingModalItem.definition?.name || ''}
          isOpen={!!bindingModalItem}
          onClose={() => setBindingModalItem(null)}
          onSuccess={() => {
            setBindingModalItem(null);
            if (selectedVersionId) fetchItems(selectedVersionId);
          }}
        />
      )}

      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Xuất bản phiên bản KPI?</h3>
              <p className="text-sm text-slate-600">
                Sau khi xuất bản, phiên bản này sẽ được khóa. Bạn sẽ không thể sửa các tiêu chí trong phiên bản đã xuất bản.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelPublish}
                disabled={isPublishing}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isPublishing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>Đang xuất bản...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Xuất bản</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
