import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { KpiAssignmentItem } from '../../../types/kpi';
import { kpiAssignmentService } from '../../../services/kpi-assignment.service';

interface KpiAssignmentTargetEditModalProps {
  item: KpiAssignmentItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiAssignmentTargetEditModal: React.FC<KpiAssignmentTargetEditModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const def = item.definition || item.definition_snapshot || {};
  const measurementType = def.measurement_type || 'number';
  const direction = def.direction || 'higher_is_better';
  const unitCode = def.unit_code || '';

  const initialTc = item.target_config || {};

  const [targetValue, setTargetValue] = useState<number | ''>(
    initialTc.value !== undefined && typeof initialTc.value === 'number'
      ? initialTc.value
      : initialTc.target !== undefined
      ? initialTc.target
      : ''
  );
  const [targetMin, setTargetMin] = useState<number | ''>(initialTc.min ?? '');
  const [targetMax, setTargetMax] = useState<number | ''>(initialTc.max ?? '');
  const [targetBoolean, setTargetBoolean] = useState<boolean>(initialTc.value ?? true);
  const [targetDate, setTargetDate] = useState<string>(initialTc.due_date || '');
  const [targetScale, setTargetScale] = useState<number | ''>(initialTc.scale ?? 5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let newTargetConfig: any = {};

    if (direction === 'target_range' || measurementType === 'target_range') {
      if (targetMin === '' || targetMax === '') {
        setError('Vui lòng nhập đầy đủ giá trị Tối thiểu (Min) và Tối đa (Max)');
        return;
      }
      if (Number(targetMin) > Number(targetMax)) {
        setError('Giá trị tối thiểu không được lớn hơn tối đa');
        return;
      }
      newTargetConfig = { min: Number(targetMin), max: Number(targetMax) };
    } else if (measurementType === 'boolean') {
      newTargetConfig = { value: Boolean(targetBoolean) };
    } else if (measurementType === 'milestone') {
      if (!targetDate) {
        setError('Vui lòng chọn ngày hoàn thành mốc (due_date)');
        return;
      }
      newTargetConfig = { due_date: targetDate };
    } else if (measurementType === 'rating') {
      if (targetValue === '' || targetScale === '') {
        setError('Vui lòng nhập điểm mục tiêu và thang điểm');
        return;
      }
      newTargetConfig = { target: Number(targetValue), scale: Number(targetScale) };
    } else {
      if (targetValue === '') {
        setError('Vui lòng nhập giá trị chỉ tiêu (Target value)');
        return;
      }
      newTargetConfig = { value: Number(targetValue) };
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await kpiAssignmentService.updateDraftTarget(item.id, newTargetConfig);
      if (updateError) throw updateError;
      onSuccess();
    } catch (err: any) {
      console.error('Update draft target failed:', err);
      setError(err.message || 'Lỗi khi cập nhật chỉ tiêu tiêu chí');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Điều chỉnh chỉ tiêu KPI</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chỉ áp dụng cho bản giao này, không ảnh hưởng đến Mẫu gốc
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-red-800 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80 space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {def.name || 'Tiêu chí KPI'}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {def.code || 'CODE'}
              </span>
              <span>•</span>
              <span>Đơn vị tính: {unitCode || 'Không'}</span>
              <span>•</span>
              <span>Loại: {measurementType}</span>
            </div>
          </div>

          {/* Dynamic Target Inputs according to measurement_type / direction */}
          {direction === 'target_range' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tối thiểu (Min) {unitCode && `(${unitCode})`}
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetMin}
                  onChange={(e) => setTargetMin(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Min"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tối đa (Max) {unitCode && `(${unitCode})`}
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetMax}
                  onChange={(e) => setTargetMax(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Max"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          ) : measurementType === 'boolean' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Yêu cầu hoàn thành
              </label>
              <select
                value={targetBoolean ? 'true' : 'false'}
                onChange={(e) => setTargetBoolean(e.target.value === 'true')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="true">Đạt / Hoàn thành (Bắt buộc đạt)</option>
                <option value="false">Không đạt</option>
              </select>
            </div>
          ) : measurementType === 'milestone' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hạn hoàn thành mốc (Due Date)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          ) : measurementType === 'rating' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Điểm mục tiêu
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ví dụ: 4.5"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thang điểm
                </label>
                <input
                  type="number"
                  step="1"
                  value={targetScale}
                  onChange={(e) => setTargetScale(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ví dụ: 5 hoặc 10"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chỉ tiêu mục tiêu (Target) {unitCode && `(${unitCode})`}
                {measurementType === 'percentage' && ' (%)'}
              </label>
              <input
                type="number"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Nhập giá trị chỉ tiêu"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Lưu chỉ tiêu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
