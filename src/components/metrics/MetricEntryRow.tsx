/**
 * MetricEntryRow Component
 * Hàng nhập kết quả cho từng Chỉ số đo lường (Metric Definition):
 * - Hiển thị Tên, Mã, Đơn vị tính, Chiều hướng mục tiêu, Tần suất
 * - Ô nhập Giá trị (Value) tùy biến theo data_type
 * - Ô nhập Ghi chú (Note)
 * - Nút lưu đơn lẻ hoặc tự động đánh dấu trạng thái chưa lưu (dirty)
 */
import React, { useState } from 'react';
import { 
  MetricDefinition, 
  MetricEntry, 
  METRIC_CATEGORY_LABELS,
  METRIC_TARGET_DIRECTION_LABELS,
  METRIC_FREQUENCY_LABELS 
} from '../../types/metric';
import { 
  Save, 
  Check, 
  Clock, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertCircle,
  HelpCircle,
  Lock,
  Calendar
} from 'lucide-react';

interface MetricEntryRowProps {
  metric: MetricDefinition;
  entry?: MetricEntry;
  currentValue: string | number;
  currentNote: string;
  isReadOnly: boolean;
  isSaving: boolean;
  isSavedSuccess?: boolean;
  onValueChange: (metricId: string, val: string) => void;
  onNoteChange: (metricId: string, note: string) => void;
  onSaveSingle: (metricId: string) => void;
}

export const MetricEntryRow: React.FC<MetricEntryRowProps> = ({
  metric,
  entry,
  currentValue,
  currentNote,
  isReadOnly,
  isSaving,
  isSavedSuccess,
  onValueChange,
  onNoteChange,
  onSaveSingle,
}) => {
  const [showNoteInput, setShowNoteInput] = useState<boolean>(Boolean(currentNote));
  const [showDesc, setShowDesc] = useState<boolean>(false);

  const hasExistingData = entry !== undefined && entry.value !== undefined;
  const isDirty = entry ? Number(entry.value) !== Number(currentValue) || (entry.note || '') !== currentNote : currentValue !== '';

  const getTargetIcon = (direction: string) => {
    switch (direction) {
      case 'higher_is_better':
        return <TrendingUp className="h-3.5 w-3.5 text-emerald-600 inline mr-1" />;
      case 'lower_is_better':
        return <TrendingDown className="h-3.5 w-3.5 text-rose-600 inline mr-1" />;
      case 'target_exact':
        return <Target className="h-3.5 w-3.5 text-indigo-600 inline mr-1" />;
      default:
        return null;
    }
  };

  const getStepForDataType = (dataType: string) => {
    switch (dataType) {
      case 'count':
        return '1';
      case 'percentage':
        return '0.1';
      case 'currency':
        return '1000';
      case 'ratio':
        return '0.01';
      case 'time_hours':
        return '0.5';
      default:
        return 'any';
    }
  };

  return (
    <div 
      id={`metric-row-${metric.id}`}
      className={`group rounded-xl border p-4 transition-all duration-150 ${
        isDirty 
          ? 'border-amber-300 bg-amber-50/40 shadow-xs' 
          : hasExistingData
            ? 'border-slate-200 bg-white hover:border-slate-300'
            : 'border-slate-200/90 bg-white/80 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Metric Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 leading-snug">
              {metric.name}
            </h4>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 border border-slate-200">
              {metric.code}
            </span>
            {metric.frequency && (
              <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                {METRIC_FREQUENCY_LABELS[metric.frequency] || metric.frequency}
              </span>
            )}
          </div>

          {/* Description & Target direction */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {metric.target_direction && (
              <span className="inline-flex items-center font-medium">
                {getTargetIcon(metric.target_direction)}
                {METRIC_TARGET_DIRECTION_LABELS[metric.target_direction]?.label || metric.target_direction}
              </span>
            )}

            {metric.description && (
              <button
                type="button"
                onClick={() => setShowDesc(!showDesc)}
                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
              >
                <HelpCircle className="mr-1 h-3.5 w-3.5" />
                {showDesc ? 'Ẩn hướng dẫn' : 'Xem hướng dẫn'}
              </button>
            )}

            {hasExistingData && entry && (
              <span className="inline-flex items-center text-slate-400">
                <Clock className="mr-1 h-3 w-3" />
                Cập nhật lúc: {new Date(entry.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                {entry.creator_profile && ` bởi ${entry.creator_profile.full_name}`}
              </span>
            )}
          </div>

          {/* Collapsible description */}
          {showDesc && metric.description && (
            <div className="mt-2 rounded-lg bg-indigo-50/60 p-2.5 text-xs text-indigo-950 border border-indigo-100">
              <span className="font-semibold">Mô tả & Cách tính:</span> {metric.description}
            </div>
          )}
        </div>

        {/* Right: Value input & Action */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* Input field with unit badge */}
          <div className="relative flex items-center">
            {metric.data_type === 'boolean' ? (
              <select
                id={`metric-input-${metric.id}`}
                disabled={isReadOnly}
                value={currentValue === '' ? '0' : String(currentValue)}
                onChange={(e) => onValueChange(metric.id, e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="1">Đạt / Đúng (1)</option>
                <option value="0">Chưa đạt / Sai (0)</option>
              </select>
            ) : (
              <div className="relative flex items-center">
                <input
                  id={`metric-input-${metric.id}`}
                  type="number"
                  step={getStepForDataType(metric.data_type)}
                  disabled={isReadOnly}
                  placeholder="0"
                  value={currentValue}
                  onChange={(e) => onValueChange(metric.id, e.target.value)}
                  className={`h-10 w-36 sm:w-44 rounded-lg border bg-white px-3 text-right text-sm font-semibold tracking-tight text-slate-900 transition-colors focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500 ${
                    isDirty
                      ? 'border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20'
                  }`}
                />
                <span className="ml-2 inline-flex min-w-[50px] items-center text-xs font-semibold text-slate-600">
                  {metric.unit || 'đơn vị'}
                </span>
              </div>
            )}
          </div>

          {/* Toggle Note Button */}
          <button
            type="button"
            id={`toggle-note-${metric.id}`}
            onClick={() => setShowNoteInput(!showNoteInput)}
            className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-medium transition-colors ${
              currentNote 
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Thêm ghi chú/giải trình cho chỉ số này"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">
              {currentNote ? 'Có ghi chú' : 'Ghi chú'}
            </span>
          </button>

          {/* Single Save Button */}
          {!isReadOnly && (
            <button
              type="button"
              id={`save-btn-${metric.id}`}
              disabled={isSaving || currentValue === ''}
              onClick={() => onSaveSingle(metric.id)}
              className={`inline-flex h-10 items-center justify-center rounded-lg px-3.5 text-xs font-semibold transition-all shadow-xs ${
                isSavedSuccess
                  ? 'bg-emerald-600 text-white'
                  : isDirty
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-indigo-900 text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
              }`}
              title="Lưu số liệu chỉ số này"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isSavedSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  <span>Đã lưu</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>Lưu</span>
                </>
              )}
            </button>
          )}

          {isReadOnly && (
            <span className="inline-flex items-center text-xs font-medium text-slate-400">
              <Lock className="mr-1 h-3.5 w-3.5" />
              Chỉ xem
            </span>
          )}
        </div>
      </div>

      {/* Note input expand area */}
      {showNoteInput && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2">
          <MessageSquare className="h-4 w-4 text-slate-400 mt-2 shrink-0" />
          <div className="flex-1">
            <input
              id={`metric-note-${metric.id}`}
              type="text"
              disabled={isReadOnly}
              placeholder="Nhập ghi chú giải trình, căn cứ số liệu, tài liệu đính kèm..."
              value={currentNote}
              onChange={(e) => onNoteChange(metric.id, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};
