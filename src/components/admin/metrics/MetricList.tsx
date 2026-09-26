/**
 * MetricList Component (/admin/metrics)
 * Quản trị Danh mục Chỉ số Đo lường (Metric Definitions)
 */
import React, { useState, useEffect } from 'react';
import { 
  MetricDefinition, 
  MetricFilterOptions,
  METRIC_CATEGORY_LABELS,
  METRIC_DATA_TYPE_LABELS,
  METRIC_FREQUENCY_LABELS,
  MeasurementScope
} from '../../../types/metric';
import { OrganizationUnit } from '../../../types/database';
import { metricService } from '../../../services/metricService';
import { organizationService } from '../../../services/organizationService';
import { 
  MetricCategoryBadge, 
  MetricDataTypeBadge, 
  MetricFrequencyBadge, 
  MetricStatusBadge,
  MetricTargetDirectionBadge,
  MetricEntryModeBadge
} from './MetricBadges';
import { 
  Plus, 
  Search, 
  RotateCcw, 
  Building2, 
  Filter, 
  Power, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  BarChart3, 
  Layers, 
  Info,
  SlidersHorizontal,
  ChevronRight,
  Database
} from 'lucide-react';

interface MetricListProps {
  onNavigateNew: () => void;
  onNavigateEdit: (id: string) => void;
}

const MEASUREMENT_SCOPE_LABELS: Record<string, string> = {
  individual: 'Cá nhân',
  unit: 'Đơn vị',
  organization: 'Toàn trường'
};

export const MetricList: React.FC<MetricListProps> = ({
  onNavigateNew,
  onNavigateEdit,
}) => {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedScope, setSelectedScope] = useState<string>('all');

  // Preview Modal
  const [previewMetric, setPreviewMetric] = useState<MetricDefinition | null>(null);

  // Status message / toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const filterParams: MetricFilterOptions = {};
      
      if (selectedUnit !== 'all') {
        filterParams.organization_unit_id = selectedUnit;
      }
      if (selectedCategory !== 'all') {
        filterParams.category = selectedCategory;
      }
      if (selectedStatus === 'active') {
        filterParams.is_active = true;
      } else if (selectedStatus === 'inactive') {
        filterParams.is_active = false;
      }
      if (selectedScope !== 'all') {
        filterParams.measurement_scope = selectedScope;
      }
      if (searchQuery.trim()) {
        filterParams.search_query = searchQuery.trim();
      }

      const [metricsData, unitsData] = await Promise.all([
        metricService.getMetricDefinitions(filterParams),
        organizationService.getUnits(false)
      ]);

      // Yêu cầu: Sort (org -> sort_order -> name)
      const sortedMetrics = [...metricsData].sort((a, b) => {
        // Sort by org unit ID string comparison (simplistic grouping by org)
        const orgA = a.organization_unit_id || '';
        const orgB = b.organization_unit_id || '';
        if (orgA !== orgB) return orgA.localeCompare(orgB);
        
        // Sort by sort_order
        const sortA = a.sort_order || 0;
        const sortB = b.sort_order || 0;
        if (sortA !== sortB) return sortA - sortB;
        
        // Sort by name
        return a.name.localeCompare(b.name);
      });

      setMetrics(sortedMetrics);
      setUnits(unitsData);
    } catch (error: any) {
      console.error('Failed to load metrics:', error);
      showToast('Không thể tải danh sách chỉ số: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Init load & effect hooks for filters
  useEffect(() => {
    loadData();
  }, [selectedUnit, selectedCategory, selectedStatus, selectedScope]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setActionLoadingId(id);
    try {
      await metricService.toggleMetricDefinition(id, !currentStatus);
      showToast(`Đã ${!currentStatus ? 'kích hoạt' : 'tạm ngưng'} chỉ số thành công`);
      // Update local state to avoid full reload
      setMetrics(metrics.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
      
      // Close preview if it's the current metric
      if (previewMetric && previewMetric.id === id) {
        setPreviewMetric({ ...previewMetric, is_active: !currentStatus });
      }
    } catch (err: any) {
      showToast('Lỗi khi thay đổi trạng thái: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getUnitName = (id: string | null) => {
    if (!id) return 'Toàn trường';
    const unit = units.find(u => u.id === id);
    return unit ? unit.name : 'Unknown Unit';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedUnit('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedScope('all');
  };

  const activeFiltersCount = [
    selectedUnit !== 'all',
    selectedCategory !== 'all',
    selectedStatus !== 'all',
    selectedScope !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-in slide-in-from-top-2`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cấu hình Chỉ số (Metrics)</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý danh mục và tham số đo lường hiệu suất (KPIs)</p>
        </div>
        <button
          onClick={onNavigateNew}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
        >
          <Plus className="h-4 w-4" />
          Tạo Chỉ số mới
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Bộ lọc & Tìm kiếm</h2>
          {activeFiltersCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {activeFiltersCount} đang bật
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tên, mã chỉ số..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">Tất cả Đơn vị</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">Tất cả Nhóm</option>
            {Object.entries(METRIC_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">Tất cả Phạm vi</option>
            {Object.entries(MEASUREMENT_SCOPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="block flex-1 rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
            >
              <option value="all">Trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã tạm ngưng</option>
            </select>
            
            <button
              onClick={clearFilters}
              title="Xóa bộ lọc"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
              <tr>
                <th scope="col" className="px-6 py-4">Chỉ số đo lường</th>
                <th scope="col" className="px-6 py-4">Đơn vị quản lý</th>
                <th scope="col" className="px-6 py-4 hidden md:table-cell">Phạm vi</th>
                <th scope="col" className="px-6 py-4 hidden lg:table-cell">Loại dữ liệu / Tần suất</th>
                <th scope="col" className="px-6 py-4 text-center">Trạng thái</th>
                <th scope="col" className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                      <p className="font-medium">Đang tải dữ liệu chỉ số...</p>
                    </div>
                  </td>
                </tr>
              ) : metrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                      <BarChart3 className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-base font-semibold text-slate-900 mb-1">Không tìm thấy chỉ số nào</p>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Thay đổi bộ lọc tìm kiếm hoặc tạo chỉ số mới để bắt đầu thiết lập KPI cho tổ chức.
                    </p>
                  </td>
                </tr>
              ) : (
                metrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-slate-900 line-clamp-2" title={metric.name}>
                          {metric.name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600 border border-slate-200">
                            {metric.code}
                          </code>
                          <MetricCategoryBadge category={metric.category as string} />
                          <MetricEntryModeBadge 
                            entryMode={metric.entry_mode} 
                            calculationType={metric.calculation_type}
                            numeratorCode={metric.numerator_metric?.code}
                            denominatorCode={metric.denominator_metric?.code}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-700">
                          {getUnitName(metric.organization_unit_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top hidden md:table-cell">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                        {MEASUREMENT_SCOPE_LABELS[(metric as any).measurement_scope || 'individual'] || (metric as any).measurement_scope}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top hidden lg:table-cell">
                      <div className="flex flex-col gap-2">
                        <MetricDataTypeBadge dataType={metric.data_type as string} unit={metric.unit} />
                        <MetricFrequencyBadge frequency={metric.frequency as string} />
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-center">
                      <MetricStatusBadge isActive={metric.is_active} />
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPreviewMetric(metric)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onNavigateEdit(metric.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Chỉnh sửa cấu hình"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(metric.id, metric.is_active)}
                          disabled={actionLoadingId === metric.id}
                          className={`p-1.5 rounded-lg transition-colors ${
                            metric.is_active 
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={metric.is_active ? "Tạm ngưng chỉ số" : "Kích hoạt lại"}
                        >
                          {actionLoadingId === metric.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal (Read Only) */}
      {previewMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in p-4 sm:p-6">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chi tiết Chỉ số</h3>
                  <code className="text-xs font-mono text-slate-500">{previewMetric.code}</code>
                </div>
              </div>
              <MetricStatusBadge isActive={previewMetric.is_active} />
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">{previewMetric.name}</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{previewMetric.description || 'Không có mô tả.'}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Đơn vị quản lý</span>
                  <p className="text-sm font-semibold text-slate-900">{getUnitName(previewMetric.organization_unit_id)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nhóm chỉ số</span>
                  <div className="pt-1"><MetricCategoryBadge category={previewMetric.category as string} /></div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Phạm vi</span>
                  <p className="text-sm font-semibold text-slate-900">{MEASUREMENT_SCOPE_LABELS[(previewMetric as any).measurement_scope || 'individual']}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dữ liệu & Đơn vị</span>
                  <p className="text-sm font-semibold text-slate-900">
                    {METRIC_DATA_TYPE_LABELS[previewMetric.data_type as string] || previewMetric.data_type} ({previewMetric.unit})
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tần suất</span>
                  <p className="text-sm font-semibold text-slate-900">{METRIC_FREQUENCY_LABELS[previewMetric.frequency as string] || previewMetric.frequency}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nguồn dữ liệu</span>
                  <p className="text-sm font-semibold text-slate-900">{(previewMetric as any).source_type || 'manual'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setPreviewMetric(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setPreviewMetric(null);
                  onNavigateEdit(previewMetric.id);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Edit3 className="h-4 w-4" />
                Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
