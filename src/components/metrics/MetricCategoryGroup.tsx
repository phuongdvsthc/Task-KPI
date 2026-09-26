/**
 * MetricCategoryGroup Component
 * Nhóm các chỉ số theo Category (Tuyển sinh, Tư vấn, Đào tạo, NCKH,...)
 */
import React from 'react';
import { 
  MetricDefinition, 
  MetricEntry, 
  MetricCategory,
  METRIC_CATEGORY_LABELS 
} from '../../types/metric';
import { MetricEntryRow } from './MetricEntryRow';
import { 
  UserPlus, 
  PhoneCall, 
  GraduationCap, 
  FlaskConical, 
  Building, 
  DollarSign, 
  HeartHandshake, 
  Wrench, 
  Award, 
  Layers 
} from 'lucide-react';

interface MetricCategoryGroupProps {
  category: string;
  metrics: MetricDefinition[];
  entriesMap: Map<string, MetricEntry>;
  valuesMap: Record<string, string | number>;
  notesMap: Record<string, string>;
  isReadOnly: boolean;
  savingMap: Record<string, boolean>;
  savedSuccessMap: Record<string, boolean>;
  onValueChange: (metricId: string, val: string) => void;
  onNoteChange: (metricId: string, note: string) => void;
  onSaveSingle: (metricId: string) => void;
}

export const MetricCategoryGroup: React.FC<MetricCategoryGroupProps> = ({
  category,
  metrics,
  entriesMap,
  valuesMap,
  notesMap,
  isReadOnly,
  savingMap,
  savedSuccessMap,
  onValueChange,
  onNoteChange,
  onSaveSingle,
}) => {
  const categoryConfig = METRIC_CATEGORY_LABELS[category] || {
    label: category,
    color: 'text-slate-700 border-slate-200',
    bg: 'bg-slate-50',
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'admissions':
        return <UserPlus className="h-4 w-4 text-rose-600 mr-2" />;
      case 'consulting':
        return <PhoneCall className="h-4 w-4 text-orange-600 mr-2" />;
      case 'teaching':
        return <GraduationCap className="h-4 w-4 text-blue-600 mr-2" />;
      case 'scientific_research':
        return <FlaskConical className="h-4 w-4 text-purple-600 mr-2" />;
      case 'administration':
        return <Building className="h-4 w-4 text-slate-600 mr-2" />;
      case 'finance':
        return <DollarSign className="h-4 w-4 text-emerald-600 mr-2" />;
      case 'student_affairs':
        return <HeartHandshake className="h-4 w-4 text-amber-600 mr-2" />;
      case 'facilities':
        return <Wrench className="h-4 w-4 text-cyan-600 mr-2" />;
      case 'quality_assurance':
        return <Award className="h-4 w-4 text-indigo-600 mr-2" />;
      default:
        return <Layers className="h-4 w-4 text-gray-600 mr-2" />;
    }
  };

  // Tính số lượng chỉ số đã có dữ liệu
  const enteredCount = metrics.filter((m) => {
    const val = valuesMap[m.id];
    return val !== undefined && val !== '';
  }).length;

  return (
    <div 
      id={`category-group-${category}`}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      {/* Category Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/75 px-5 py-3.5">
        <div className="flex items-center">
          {getCategoryIcon(category)}
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            {categoryConfig.label}
          </h3>
          <span className="ml-3 inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            {metrics.length} chỉ số
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Tiến độ nhập:</span>
          <span className={`font-semibold ${enteredCount === metrics.length ? 'text-emerald-700' : 'text-slate-700'}`}>
            {enteredCount}/{metrics.length} đã nhập
          </span>
        </div>
      </div>

      {/* Metric Rows */}
      <div className="divide-y divide-slate-100 p-4 space-y-3">
        {metrics.map((metric) => (
          <MetricEntryRow
            key={metric.id}
            metric={metric}
            entry={entriesMap.get(metric.id)}
            currentValue={valuesMap[metric.id] ?? ''}
            currentNote={notesMap[metric.id] ?? ''}
            isReadOnly={isReadOnly}
            isSaving={Boolean(savingMap[metric.id])}
            isSavedSuccess={Boolean(savedSuccessMap[metric.id])}
            onValueChange={onValueChange}
            onNoteChange={onNoteChange}
            onSaveSingle={onSaveSingle}
          />
        ))}
      </div>
    </div>
  );
};
