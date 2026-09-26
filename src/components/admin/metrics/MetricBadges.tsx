/**
 * Metric Badges Component
 * Các nhãn trạng thái và thuộc tính trực quan cho Chỉ số Đo lường (Metric Definition)
 */
import React from 'react';
import { 
  METRIC_CATEGORY_LABELS, 
  METRIC_DATA_TYPE_LABELS, 
  METRIC_FREQUENCY_LABELS,
  METRIC_TARGET_DIRECTION_LABELS,
  METRIC_AGGREGATION_LABELS
} from '../../../types/metric';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Target, HelpCircle } from 'lucide-react';

export const MetricCategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const meta = METRIC_CATEGORY_LABELS[category] || METRIC_CATEGORY_LABELS.other;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.bg} ${meta.color}`}
    >
      {meta.label}
    </span>
  );
};

export const MetricDataTypeBadge: React.FC<{ dataType: string; unit?: string | null }> = ({ dataType, unit }) => {
  const label = METRIC_DATA_TYPE_LABELS[dataType] || dataType;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      <span>{label}</span>
      {unit && <span className="text-slate-500 font-normal">({unit})</span>}
    </span>
  );
};

export const MetricEntryModeBadge: React.FC<{ 
  entryMode?: string | null; 
  calculationType?: string | null;
  numeratorCode?: string | null;
  denominatorCode?: string | null;
}> = ({ entryMode, calculationType, numeratorCode, denominatorCode }) => {
  if (entryMode === 'calculated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        <span>Tự động tính tỷ lệ</span>
        {numeratorCode && denominatorCode && (
          <span className="font-mono font-normal opacity-80">({numeratorCode}/{denominatorCode})</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Thủ công
    </span>
  );
};

export const MetricFrequencyBadge: React.FC<{ frequency: string }> = ({ frequency }) => {
  const label = METRIC_FREQUENCY_LABELS[frequency] || frequency;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
      {label}
    </span>
  );
};

export const MetricAggregationBadge: React.FC<{ aggregation: string }> = ({ aggregation }) => {
  const label = METRIC_AGGREGATION_LABELS[aggregation] || aggregation;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-600">
      {label}
    </span>
  );
};

export const MetricStatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        Đang áp dụng
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300">
      <XCircle className="h-3.5 w-3.5 text-slate-400" />
      Đã tạm dừng
    </span>
  );
};

export const MetricTargetDirectionBadge: React.FC<{ direction: string }> = ({ direction }) => {
  const meta = METRIC_TARGET_DIRECTION_LABELS[direction];
  if (!meta) return <span className="text-xs text-slate-500">—</span>;

  let Icon = HelpCircle;
  let color = 'text-slate-600';

  if (direction === 'higher_is_better') {
    Icon = TrendingUp;
    color = 'text-emerald-600';
  } else if (direction === 'lower_is_better') {
    Icon = TrendingDown;
    color = 'text-amber-600';
  } else if (direction === 'target_exact') {
    Icon = Target;
    color = 'text-indigo-600';
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{meta.iconDesc}</span>
    </span>
  );
};
