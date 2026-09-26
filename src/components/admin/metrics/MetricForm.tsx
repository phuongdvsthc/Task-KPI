/**
 * MetricForm Component
 * Xử lý biểu mẫu Tạo mới (/admin/metrics/new) và Chỉnh sửa (/admin/metrics/[id]/edit)
 * Hỗ trợ:
 * - entry_mode: manual | calculated
 * - calculation_type: ratio (Tử số / Mẫu số)
 * - report_source_metric_assignments (Phân quyền áp dụng theo Kênh/Nguồn)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreateMetricDefinitionPayload, 
  UpdateMetricDefinitionPayload,
  MetricCategory,
  MetricDataType,
  MetricAggregationType,
  MetricFrequency,
  MetricTargetDirection,
  METRIC_CATEGORY_LABELS,
  MeasurementScope,
  MetricSourceType,
  MetricEntryMode,
  MetricCalculationType,
  MetricDefinition
} from '../../../types/metric';
import { OrganizationUnit } from '../../../types/database';
import { metricService, metricHasEntries } from '../../../services/metricService';
import { organizationService } from '../../../services/organizationService';
import { useAuth } from '../../../context/AuthContext';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Building2, 
  AlertCircle, 
  Sparkles, 
  Sliders, 
  Database,
  Calculator,
  Radio,
  Share2,
  Check,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

interface MetricFormProps {
  mode: 'create' | 'edit';
  metricId?: string | null;
  onBack: () => void;
  onSuccess: (metricId?: string) => void;
}

interface SourceAssignmentRow {
  report_source_id: string;
  source_code: string;
  source_name: string;
  source_category?: string;
  source_is_active: boolean; // Source system status
  is_assigned: boolean;      // Whether assigned in this form
  is_active: boolean;        // Assignment status
  is_required: boolean;      // Required input in daily report
  sort_order: number;
}

const MEASUREMENT_SCOPE_LABELS: Record<string, string> = {
  individual: 'Cá nhân',
  unit: 'Đơn vị',
  organization: 'Toàn trường'
};

const DATA_TYPE_LABELS: Record<string, string> = {
  number: 'Số lượng',
  percentage: 'Tỷ lệ %',
  currency: 'Tiền tệ',
  time_hours: 'Thời lượng'
};

const AGGREGATION_LABELS: Record<string, string> = {
  sum: 'Tổng',
  avg: 'Trung bình',
  max: 'Cao nhất',
  min: 'Thấp nhất',
  latest: 'Giá trị mới nhất'
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  yearly: 'Hàng năm',
  manual: 'Không theo chu kỳ cố định'
};

const TARGET_DIRECTION_LABELS: Record<string, string> = {
  higher_better: 'Càng cao càng tốt',
  lower_better: 'Càng thấp càng tốt',
  neutral: 'Chỉ theo dõi'
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: 'Nhập thủ công',
  task: 'Lấy từ công việc',
  import: 'Import dữ liệu',
  api: 'API',
  system: 'Hệ thống tự tính'
};

export const MetricForm: React.FC<MetricFormProps> = ({
  mode,
  metricId,
  onBack,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [allMetrics, setAllMetrics] = useState<MetricDefinition[]>([]);
  const [allSources, setAllSources] = useState<any[]>([]);
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignmentRow[]>([]);
  // Map of sourceId -> Set of metric_definition_ids actively assigned to it (for validation)
  const [sourceActiveMetricMap, setSourceActiveMetricMap] = useState<Map<string, Set<string>>>(new Map());

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasEntries, setHasEntries] = useState<boolean>(false);

  // Form Fields State
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [organizationUnitId, setOrganizationUnitId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<MetricCategory>('admissions');
  
  // v0.3.4d Entry Mode & Calculation
  const [entryMode, setEntryMode] = useState<MetricEntryMode>('manual');
  const [calculationType, setCalculationType] = useState<MetricCalculationType>('ratio');
  const [numeratorMetricId, setNumeratorMetricId] = useState<string>('');
  const [denominatorMetricId, setDenominatorMetricId] = useState<string>('');

  const [measurementScope, setMeasurementScope] = useState<MeasurementScope>('individual');
  const [dataType, setDataType] = useState<MetricDataType>('number');
  const [unit, setUnit] = useState<string>('lượt');
  const [aggregationType, setAggregationType] = useState<MetricAggregationType>('sum');
  const [frequency, setFrequency] = useState<MetricFrequency | 'manual'>('daily');
  const [targetDirection, setTargetDirection] = useState<MetricTargetDirection | 'higher_better' | 'lower_better' | 'neutral'>('higher_better');
  const [sourceType, setSourceType] = useState<MetricSourceType>('manual');
  
  const [allowManualEntry, setAllowManualEntry] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Auto-suggest code generator based on name
  const handleAutoGenerateCode = () => {
    if (!name.trim()) return;
    const cleanStr = name.trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/Đ/g, "D")
      .replace(/[^A-Z0-9 ]/g, "")
      .replace(/\s+/g, "_");
    setCode(cleanStr);
  };

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        setIsLoading(true);
        // Load units, all metrics, all sources, and all assignments for dependency checking
        const [orgs, metricsList, sourcesList] = await Promise.all([
          organizationService.getUnits().catch(() => []),
          metricService.getMetricDefinitions().catch(() => []),
          metricService.getAllReportSources().catch(() => []),
        ]);

        setUnits(orgs);
        setAllMetrics(metricsList);
        setAllSources(sourcesList);

        // Fetch all active assignments across all sources for dependency checking
        try {
          const supabase = (await import('../../../lib/supabase')).getSupabaseClient();
          let allAssigns: any[] = [];
          if (supabase) {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token) {
              const res = await fetch('/api/admin/metrics/all-assignments', {
                headers: { Authorization: `Bearer ${token}` }
              }).catch(() => null);
              if (res && res.ok) {
                allAssigns = await res.json();
              }
            }

            if (!allAssigns || allAssigns.length === 0) {
              const { data } = await (supabase.from('report_source_metric_assignments') as any)
                .select('report_source_id, metric_definition_id, is_active')
                .eq('is_active', true);
              allAssigns = data || [];
            }
            
            const srcMap = new Map<string, Set<string>>();
            (allAssigns || []).forEach((a: any) => {
              if (!srcMap.has(a.report_source_id)) {
                srcMap.set(a.report_source_id, new Set());
              }
              srcMap.get(a.report_source_id)!.add(a.metric_definition_id);
            });
            setSourceActiveMetricMap(srcMap);
          }
        } catch (e) {
          console.warn('Could not build source-metric mapping for client-side validation:', e);
        }

        if (mode === 'edit' && metricId) {
          const [metric, savedAssignments] = await Promise.all([
            metricService.getMetricDefinitionById(metricId),
            metricService.getSourceMetricAssignments(metricId).catch(() => []),
          ]);

          if (metric) {
            setName(metric.name);
            setCode(metric.code);
            setOrganizationUnitId(metric.organization_unit_id || '');
            setDescription(metric.description || '');
            setCategory((metric.category as MetricCategory) || 'admissions');
            
            setEntryMode(metric.entry_mode || 'manual');
            setCalculationType(metric.calculation_type || 'ratio');
            setNumeratorMetricId(metric.numerator_metric_id || '');
            setDenominatorMetricId(metric.denominator_metric_id || '');

            setMeasurementScope((metric.measurement_scope as MeasurementScope) || 'individual');
            setSourceType((metric.source_type as MetricSourceType) || 'manual');
            setDataType((metric.data_type as MetricDataType) || 'number');
            setUnit(metric.unit || '');
            setAggregationType((metric.aggregation_type as MetricAggregationType) || 'sum');
            setFrequency((metric.frequency as any) || 'daily');
            setTargetDirection((metric.target_direction as any) || 'higher_better');
            setAllowManualEntry(metric.allow_manual_entry ?? true);
            setSortOrder(metric.sort_order || 0);
            setIsActive(metric.is_active ?? true);

            // Build source assignments list
            const savedMap = new Map<string, any>();
            savedAssignments.forEach((sa: any) => savedMap.set(sa.report_source_id, sa));

            const rows: SourceAssignmentRow[] = sourcesList.map((src: any) => {
              const saved = savedMap.get(src.id);
              return {
                report_source_id: src.id,
                source_code: src.code,
                source_name: src.name,
                source_category: src.category,
                source_is_active: src.is_active,
                is_assigned: saved ? (saved.is_active ?? true) : false,
                is_active: saved ? (saved.is_active ?? true) : true,
                is_required: saved ? (saved.is_required ?? false) : false,
                sort_order: saved ? (saved.sort_order ?? src.sort_order ?? 0) : (src.sort_order ?? 0),
              };
            });
            setSourceAssignments(rows);

            // Check if metric has entries
            const entriesExist = await metricHasEntries(metricId);
            setHasEntries(entriesExist);
          } else {
            setErrorMessage('Không tìm thấy thông tin chỉ số.');
          }
        } else {
          // Create mode defaults
          const rows: SourceAssignmentRow[] = sourcesList.map((src: any) => ({
            report_source_id: src.id,
            source_code: src.code,
            source_name: src.name,
            source_category: src.category,
            source_is_active: src.is_active,
            is_assigned: false,
            is_active: true,
            is_required: false,
            sort_order: src.sort_order || 0,
          }));
          setSourceAssignments(rows);
        }
      } catch (err: any) {
        setErrorMessage('Lỗi khi tải dữ liệu: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDependencies();
  }, [mode, metricId]);

  // When switching entry mode
  useEffect(() => {
    if (entryMode === 'calculated') {
      setDataType('percentage');
      setUnit('%');
      setAllowManualEntry(false);
      setSourceType('system');
    } else {
      if (sourceType === 'system') {
        setSourceType('manual');
        setAllowManualEntry(true);
      }
    }
  }, [entryMode]);

  // Filter available metrics for numerator / denominator
  const availableManualMetrics = useMemo(() => {
    return allMetrics.filter(m => 
      m.id !== metricId && // Cannot select itself
      (m.entry_mode === 'manual' || !m.entry_mode) && // Must be manual
      m.is_active !== false // Must be active
    );
  }, [allMetrics, metricId]);

  // Handle toggle source assignment
  const handleToggleSourceAssign = (sourceId: string) => {
    setSourceAssignments(prev => prev.map(row => {
      if (row.report_source_id === sourceId) {
        const nextAssigned = !row.is_assigned;
        return {
          ...row,
          is_assigned: nextAssigned,
          is_active: nextAssigned,
        };
      }
      return row;
    }));
  };

  const handleUpdateAssignmentField = (sourceId: string, field: 'is_required' | 'sort_order' | 'is_active', val: any) => {
    setSourceAssignments(prev => prev.map(row => {
      if (row.report_source_id === sourceId) {
        return { ...row, [field]: val };
      }
      return row;
    }));
  };

  // Check dependency warnings for calculated metrics
  const calculatedDependencyWarnings = useMemo(() => {
    if (entryMode !== 'calculated' || !numeratorMetricId || !denominatorMetricId) {
      return [];
    }

    const warnings: { sourceName: string; missing: string }[] = [];
    const assignedSources = sourceAssignments.filter(s => s.is_assigned && s.is_active);

    for (const src of assignedSources) {
      const activeIds = sourceActiveMetricMap.get(src.report_source_id) || new Set();
      const hasNum = activeIds.has(numeratorMetricId);
      const hasDen = activeIds.has(denominatorMetricId);

      if (!hasNum || !hasDen) {
        const missingParts: string[] = [];
        if (!hasNum) missingParts.push('Tử số');
        if (!hasDen) missingParts.push('Mẫu số');
        warnings.push({
          sourceName: src.source_name,
          missing: missingParts.join(' và ')
        });
      }
    }

    return warnings;
  }, [entryMode, numeratorMetricId, denominatorMetricId, sourceAssignments, sourceActiveMetricMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim()) return setErrorMessage('Vui lòng nhập tên chỉ số.');
    if (!code.trim()) return setErrorMessage('Vui lòng nhập mã chỉ số.');

    if (entryMode === 'calculated') {
      if (!numeratorMetricId) return setErrorMessage('Vui lòng chọn Tử số cho chỉ số tự động tính tỷ lệ.');
      if (!denominatorMetricId) return setErrorMessage('Vui lòng chọn Mẫu số cho chỉ số tự động tính tỷ lệ.');
      if (numeratorMetricId === denominatorMetricId) {
        return setErrorMessage('Tử số và Mẫu số không được trùng nhau.');
      }
    } else {
      if (!dataType) return setErrorMessage('Vui lòng chọn Loại dữ liệu.');
      if (!unit.trim()) return setErrorMessage('Vui lòng nhập Đơn vị tính.');
    }

    // Clean code format: A-Z 0-9 _
    const cleanedCode = code.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");

    // Prepare assignments payload
    const assignmentsPayload = sourceAssignments
      .filter(s => s.is_assigned)
      .map(s => ({
        report_source_id: s.report_source_id,
        is_active: s.is_active,
        is_required: entryMode === 'manual' ? s.is_required : false,
        sort_order: s.sort_order,
      }));

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateMetricDefinitionPayload = {
          name: name.trim(),
          code: cleanedCode,
          organization_unit_id: organizationUnitId || null,
          description: description.trim() || null,
          category,
          entry_mode: entryMode,
          calculation_type: entryMode === 'calculated' ? calculationType : null,
          numerator_metric_id: entryMode === 'calculated' ? numeratorMetricId : null,
          denominator_metric_id: entryMode === 'calculated' ? denominatorMetricId : null,
          measurement_scope: measurementScope,
          data_type: entryMode === 'calculated' ? 'percentage' : dataType,
          unit: entryMode === 'calculated' ? '%' : unit.trim(),
          aggregation_type: aggregationType,
          frequency,
          target_direction: targetDirection,
          source_type: entryMode === 'calculated' ? 'system' : sourceType,
          allow_manual_entry: entryMode === 'calculated' ? false : allowManualEntry,
          sort_order: sortOrder,
          is_active: isActive,
          source_assignments: assignmentsPayload,
        };

        const res = await metricService.createMetricDefinition(payload, user?.id);
        onSuccess(res.id);
      } else if (metricId) {
        const payload: UpdateMetricDefinitionPayload = {
          name: name.trim(),
          code: cleanedCode,
          organization_unit_id: organizationUnitId || null,
          description: description.trim() || null,
          category,
          entry_mode: entryMode,
          calculation_type: entryMode === 'calculated' ? calculationType : null,
          numerator_metric_id: entryMode === 'calculated' ? numeratorMetricId : null,
          denominator_metric_id: entryMode === 'calculated' ? denominatorMetricId : null,
          measurement_scope: measurementScope,
          data_type: entryMode === 'calculated' ? 'percentage' : dataType,
          unit: entryMode === 'calculated' ? '%' : unit.trim(),
          aggregation_type: aggregationType,
          frequency,
          target_direction: targetDirection,
          source_type: entryMode === 'calculated' ? 'system' : sourceType,
          allow_manual_entry: entryMode === 'calculated' ? false : allowManualEntry,
          sort_order: sortOrder,
          is_active: isActive,
          source_assignments: assignmentsPayload,
        };

        await metricService.updateMetricDefinition(metricId, payload, user?.id);
        onSuccess(metricId);
      }
    } catch (err: any) {
      if (err.message?.includes('duplicate key') || err.message?.includes('metric_definitions_code_organization_key')) {
        setErrorMessage('Mã chỉ số này đã tồn tại. Vui lòng chọn mã khác.');
      } else {
        setErrorMessage(err.message || 'Có lỗi xảy ra khi lưu chỉ số.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-indigo-600">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3 font-medium">Đang tải dữ liệu biểu mẫu...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {mode === 'create' ? 'Tạo mới Chỉ số đo lường' : 'Cập nhật Chỉ số đo lường'}
            </h1>
            <p className="text-xs text-slate-500">
              Cấu hình hình thức thu thập (Thủ công / Tính toán) và phân bổ theo Kênh/Nguồn
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 animate-in fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
            <div className="text-sm leading-relaxed whitespace-pre-line">{errorMessage}</div>
          </div>
        )}

        {/* Section 1: Hình thức thu thập (Entry Mode) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hình thức thu thập</h3>
              <p className="text-xs text-slate-500">Chọn phương thức khởi tạo dữ liệu cho chỉ số</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`relative flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
              entryMode === 'manual' 
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <input
                type="radio"
                name="entryMode"
                value="manual"
                checked={entryMode === 'manual'}
                onChange={() => setEntryMode('manual')}
                className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900">Nhập liệu thủ công (Manual)</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Nhân sự trực tiếp điền kết quả vào báo cáo hằng ngày (Số cuộc gọi, Lead, Doanh số, v.v.).
                </span>
              </div>
            </label>

            <label className={`relative flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
              entryMode === 'calculated' 
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <input
                type="radio"
                name="entryMode"
                value="calculated"
                checked={entryMode === 'calculated'}
                onChange={() => setEntryMode('calculated')}
                className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900">Tự động tính toán (Calculated Ratio)</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Hệ thống tự động tính tỷ lệ phần trăm thời gian thực từ 2 chỉ số thủ công (Tử số / Mẫu số).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 2: Calculated Ratio Configuration (Hiển thị khi entryMode === 'calculated') */}
        {entryMode === 'calculated' && (
          <div className="bg-indigo-50/60 rounded-2xl border border-indigo-200 p-6 shadow-xs space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 border-b border-indigo-200/60 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950">Cấu hình công thức Tỷ lệ (Ratio Formula)</h3>
                <p className="text-xs text-indigo-700">Công thức: [Tử số] / [Mẫu số] × 100%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chỉ số Tử số (Numerator) <span className="text-rose-500">*</span>
                </label>
                <select
                  required={entryMode === 'calculated'}
                  value={numeratorMetricId}
                  onChange={(e) => setNumeratorMetricId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Chọn chỉ số làm Tử số --</option>
                  {availableManualMetrics
                    .filter(m => m.id !== denominatorMetricId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Chỉ số thể hiện kết quả đạt được (vd: Cuộc gọi nghe máy, Đóng học phí)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chỉ số Mẫu số (Denominator) <span className="text-rose-500">*</span>
                </label>
                <select
                  required={entryMode === 'calculated'}
                  value={denominatorMetricId}
                  onChange={(e) => setDenominatorMetricId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Chọn chỉ số làm Mẫu số --</option>
                  {availableManualMetrics
                    .filter(m => m.id !== numeratorMetricId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Chỉ số thể hiện tổng cơ sở (vd: Tổng số cuộc gọi, Tổng số Lead)</p>
              </div>
            </div>

            {/* Formula Preview Box */}
            {numeratorMetricId && denominatorMetricId && (
              <div className="rounded-xl border border-indigo-200 bg-white p-3.5 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Xem trước công thức:</span>
                <div className="flex items-center gap-2 font-mono text-sm font-semibold text-indigo-900">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {allMetrics.find(m => m.id === numeratorMetricId)?.name || 'Tử số'}
                  </span>
                  <span>/</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {allMetrics.find(m => m.id === denominatorMetricId)?.name || 'Mẫu số'}
                  </span>
                  <span>× 100%</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Thông tin cơ bản */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Thông tin định danh</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên chỉ số <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleAutoGenerateCode}
                    placeholder="VD: Tỷ lệ nghe máy, Số cuộc gọi..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã chỉ số <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))}
                      placeholder="VD: TY_LE_NGHE_MAY"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGenerateCode}
                      className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-indigo-600 rounded"
                      title="Tạo mã tự động từ tên"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Chỉ chứa A-Z, 0-9 và dấu gạch dưới (_)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đơn vị quản lý (Tùy chọn / Legacy)
                  </label>
                  <select
                    value={organizationUnitId}
                    onChange={(e) => setOrganizationUnitId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Chung (Áp dụng theo Kênh/Nguồn) --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">Mô hình mới: Kênh/Nguồn quyết định bộ chỉ số</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nhóm danh mục <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MetricCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(METRIC_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mô tả / Hướng dẫn
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả ý nghĩa của chỉ số và cách thức đo lường..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Áp dụng cho Kênh / Nguồn báo cáo (Source Assignments) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Áp dụng cho Kênh / Nguồn báo cáo</h3>
                    <p className="text-xs text-slate-500">Chỉ số này sẽ xuất hiện khi Staff chọn các Kênh/Nguồn được kích hoạt</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {sourceAssignments.filter(s => s.is_assigned && s.is_active).length} kênh đã chọn
                </span>
              </div>

              {/* Calculated Metric Dependency Warning Box */}
              {calculatedDependencyWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Lưu ý về tính hợp lệ của Kênh đã chọn:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-amber-800">
                    {calculatedDependencyWarnings.map((w, idx) => (
                      <li key={idx}>
                        <strong>{w.sourceName}</strong>: Chưa được gán {w.missing} trong danh sách chỉ số của kênh đó.
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-700 italic">
                    * Để chỉ số tỷ lệ hoạt động chính xác khi Staff báo cáo, hãy đảm bảo các Kênh này cũng được gán cả Tử số và Mẫu số.
                  </p>
                </div>
              )}

              {allSources.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 text-center text-xs text-slate-500">
                  Chưa có Kênh/Nguồn nào được tạo trong hệ thống.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600 font-medium">
                        <th className="py-2.5 px-3 w-10">Chọn</th>
                        <th className="py-2.5 px-3">Tên Kênh / Nguồn</th>
                        <th className="py-2.5 px-3">Mã Kênh</th>
                        <th className="py-2.5 px-3">Phân loại</th>
                        {entryMode === 'manual' && (
                          <th className="py-2.5 px-3 text-center">Bắt buộc nhập</th>
                        )}
                        <th className="py-2.5 px-3 text-right w-24">Thứ tự</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sourceAssignments.map((row) => (
                        <tr 
                          key={row.report_source_id} 
                          className={`hover:bg-slate-50/60 transition-colors ${row.is_assigned ? 'bg-indigo-50/20' : ''}`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={row.is_assigned}
                              onChange={() => handleToggleSourceAssign(row.report_source_id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{row.source_name}</span>
                              {!row.source_is_active && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                  (Ngừng HĐ)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">
                            {row.source_code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {row.source_category || '—'}
                          </td>
                          {entryMode === 'manual' && (
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.is_required}
                                disabled={!row.is_assigned}
                                onChange={(e) => handleUpdateAssignmentField(row.report_source_id, 'is_required', e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 disabled:opacity-40"
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              value={row.sort_order}
                              disabled={!row.is_assigned}
                              onChange={(e) => handleUpdateAssignmentField(row.report_source_id, 'sort_order', parseInt(e.target.value) || 0)}
                              className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-xs text-slate-800 focus:border-indigo-500 disabled:bg-slate-100 disabled:opacity-40"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Cột phải: Thuộc tính đo lường & Đánh giá */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sliders className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Thuộc tính đo lường</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại dữ liệu <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={entryMode === 'calculated' ? 'percentage' : dataType}
                    onChange={(e) => setDataType(e.target.value as MetricDataType)}
                    disabled={entryMode === 'calculated'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {Object.entries(DATA_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đơn vị tính (Hiển thị) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={entryMode === 'calculated' ? '%' : unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={entryMode === 'calculated'}
                    placeholder="VD: người, cuộc, %"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phương pháp tổng hợp <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={aggregationType}
                    onChange={(e) => setAggregationType(e.target.value as MetricAggregationType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(AGGREGATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tần suất đánh giá <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chiều hướng mục tiêu <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={targetDirection}
                    onChange={(e) => setTargetDirection(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(TARGET_DIRECTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thứ tự sắp xếp chung
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Trạng thái kích hoạt</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Lưu chỉ số
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
