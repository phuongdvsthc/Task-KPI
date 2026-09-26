import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { KpiTemplateItem, KpiDefinition, KpiObjective } from '../../../types/kpi';
import { kpiService } from '../../../services/kpi.service';

interface KpiTemplateItemFormProps {
  templateVersionId: string;
  item?: KpiTemplateItem;
  existingItems: KpiTemplateItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiTemplateItemForm: React.FC<KpiTemplateItemFormProps> = ({ templateVersionId, item, existingItems, onClose, onSuccess }) => {
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [objectives, setObjectives] = useState<KpiObjective[]>([]);
  
  const [definitionId, setDefinitionId] = useState(item?.kpi_definition_id || '');
  const [objectiveId, setObjectiveId] = useState(item?.objective_id || '');
  const [weight, setWeight] = useState(item?.weight || 0);
  const [isRequired, setIsRequired] = useState(item?.is_required ?? true);
  const [capPercent, setCapPercent] = useState<number | ''>(item?.cap_percent ?? 120);
  
  // Target config state
  const [targetValue, setTargetValue] = useState<number | ''>('');
  const [targetMin, setTargetMin] = useState<number | ''>('');
  const [targetMax, setTargetMax] = useState<number | ''>('');
  const [targetBoolean, setTargetBoolean] = useState<boolean>(true);
  const [targetDate, setTargetDate] = useState<string>('');
  const [targetScale, setTargetScale] = useState<number | ''>('');
  
  // Scoring config state
  const [scoringMethod, setScoringMethod] = useState<'linear' | 'threshold' | 'binary'>('linear');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load definitions and objectives
    kpiService.getDefinitions(undefined).then(res => setDefinitions(res.data || []));
    kpiService.getObjectives(undefined).then(res => setObjectives(res.data || []));
  }, []);

  useEffect(() => {
    if (item) {
      const tc = item.target_config || {};
      if (tc.value !== undefined && typeof tc.value === 'number') setTargetValue(tc.value);
      if (tc.value !== undefined && typeof tc.value === 'boolean') setTargetBoolean(tc.value);
      if (tc.min !== undefined) setTargetMin(tc.min);
      if (tc.max !== undefined) setTargetMax(tc.max);
      if (tc.due_date !== undefined) setTargetDate(tc.due_date);
      if (tc.target !== undefined) setTargetValue(tc.target);
      if (tc.scale !== undefined) setTargetScale(tc.scale);

      const sc = item.scoring_config || {};
      if (sc.method) setScoringMethod(sc.method);
    }
  }, [item]);

  const selectedDef = definitions.find(d => d.id === definitionId);

  // Available definitions (exclude already added, unless editing self)
  const availableDefinitions = definitions.filter(d => 
    d.is_active && (!existingItems.find(ei => ei.kpi_definition_id === d.id && ei.id !== item?.id))
  );

  useEffect(() => {
    if (selectedDef && !item) {
      if (selectedDef.default_scoring_method) {
        setScoringMethod(selectedDef.default_scoring_method as any);
      }
    }
  }, [selectedDef, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!definitionId) {
      setError('Vui lòng chọn tiêu chí (KPI Definition)');
      return;
    }
    if (weight <= 0 || weight > 100) {
      setError('Trọng số phải nằm trong khoảng (0, 100]');
      return;
    }

    // Build target config
    let targetConfig: any = {};
    if (selectedDef) {
      if (selectedDef.direction === 'target_range') {
        if (targetMin === '' || targetMax === '') return setError('Vui lòng nhập Min và Max');
        targetConfig = { min: Number(targetMin), max: Number(targetMax) };
      } else if (selectedDef.measurement_type === 'boolean') {
        targetConfig = { value: targetBoolean };
      } else if (selectedDef.measurement_type === 'milestone') {
        if (!targetDate) return setError('Vui lòng chọn ngày hoàn thành (due_date)');
        targetConfig = { due_date: targetDate };
      } else if (selectedDef.measurement_type === 'rating') {
        if (targetValue === '' || targetScale === '') return setError('Vui lòng nhập Target và Scale');
        targetConfig = { target: Number(targetValue), scale: Number(targetScale) };
      } else {
        if (targetValue === '') return setError('Vui lòng nhập chỉ tiêu (Target value)');
        targetConfig = { value: Number(targetValue) };
      }
    }

    // Build scoring config
    const scoringConfig: any = { method: scoringMethod };
    if (scoringMethod === 'linear') {
      scoringConfig.max_achievement_percent = capPercent === '' ? null : Number(capPercent);
    }

    const dataToSave = {
      template_version_id: templateVersionId,
      kpi_definition_id: definitionId,
      objective_id: objectiveId || null,
      weight: Number(weight),
      target_config: targetConfig,
      scoring_config: scoringConfig,
      cap_percent: capPercent === '' ? null : Number(capPercent),
      is_required: isRequired,
      sort_order: item?.sort_order || existingItems.length * 10
    };

    setIsSubmitting(true);
    try {
      if (item?.id) {
        const { error: updateError } = await kpiService.updateTemplateItem(item.id, dataToSave);
        if (updateError) throw updateError;
      } else {
        const { error: createError } = await kpiService.addTemplateItem(dataToSave);
        if (createError) throw createError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi lưu tiêu chí');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {item ? 'Cập nhật tiêu chí KPI' : 'Thêm tiêu chí vào mẫu'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Core Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thước đo KPI <span className="text-red-500">*</span></label>
              <select
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                value={definitionId}
                onChange={e => setDefinitionId(e.target.value)}
                disabled={!!item} // Cannot change definition after added
              >
                <option value="">-- Chọn KPI --</option>
                {item && selectedDef && !availableDefinitions.find(d => d.id === selectedDef.id) && (
                  <option value={selectedDef.id}>{selectedDef.code} - {selectedDef.name}</option>
                )}
                {availableDefinitions.map(d => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name} ({d.measurement_type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mục tiêu chiến lược (Tùy chọn)</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={objectiveId}
                  onChange={e => setObjectiveId(e.target.value)}
                >
                  <option value="">-- Không gắn mục tiêu --</option>
                  {objectives.map(o => (
                    <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trọng số (%) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  value={weight || ''}
                  onChange={e => setWeight(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Target Config UI generated based on definition */}
          {selectedDef && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-sm font-bold text-slate-800 mb-4">Cấu hình chỉ tiêu (Target)</h4>
              
              {selectedDef.direction === 'target_range' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Giá trị Min <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      value={targetMin}
                      onChange={e => setTargetMin(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Giá trị Max <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      value={targetMax}
                      onChange={e => setTargetMax(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                </div>
              ) : selectedDef.measurement_type === 'boolean' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mục tiêu đạt được <span className="text-red-500">*</span></label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                    value={targetBoolean ? 'true' : 'false'}
                    onChange={e => setTargetBoolean(e.target.value === 'true')}
                  >
                    <option value="true">Đạt (True)</option>
                    <option value="false">Không đạt (False)</option>
                  </select>
                </div>
              ) : selectedDef.measurement_type === 'milestone' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hạn hoàn thành (Due Date) <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                  />
                </div>
              ) : selectedDef.measurement_type === 'rating' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mục tiêu điểm <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      value={targetValue}
                      onChange={e => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thang điểm (Scale) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      value={targetScale}
                      onChange={e => setTargetScale(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="VD: 5 hoặc 10"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Giá trị mục tiêu ({selectedDef.unit_code || 'Số'}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Scoring Config */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-4">Cấu hình tính điểm</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phương pháp tính <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={scoringMethod}
                  onChange={e => setScoringMethod(e.target.value as any)}
                >
                  <option value="linear">Tuyến tính (Linear)</option>
                  <option value="threshold">Vượt ngưỡng (Threshold)</option>
                  <option value="binary">Đạt/Không đạt (Binary)</option>
                </select>
              </div>

              {scoringMethod === 'linear' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tỷ lệ hoàn thành tối đa (%)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    value={capPercent === '' ? '' : capPercent}
                    onChange={e => setCapPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Mặc định: 100 hoặc 120"
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="is_required"
                checked={isRequired}
                onChange={e => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_required" className="text-sm text-slate-700 font-medium">Bắt buộc phải đạt (Nếu không đạt, tổng điểm bị giảm/cảnh báo)</label>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
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
