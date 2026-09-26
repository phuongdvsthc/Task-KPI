import React from 'react';
import { CheckSquare } from 'lucide-react';
import { TaskEvidenceRef } from '../../../types/task-intelligence';

interface TaskEvidenceListProps {
  evidence?: TaskEvidenceRef[];
  onDrillDown?: (evidence: TaskEvidenceRef) => void;
  maxDisplay?: number;
}

export const formatVNDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export const TaskEvidenceList: React.FC<TaskEvidenceListProps> = ({
  evidence,
  onDrillDown,
  maxDisplay = 3,
}) => {
  if (!evidence || evidence.length === 0) return null;

  const validEvidence = evidence.filter(
    (ev) => ev && ev.type === 'task' && ev.taskId
  );
  if (validEvidence.length === 0) return null;

  const displayItems = validEvidence.slice(0, maxDisplay);
  const overflowCount = validEvidence.length - maxDisplay;

  const renderLabel = (ev: TaskEvidenceRef) => {
    if (ev.taskTitle) {
      return ev.taskTitle;
    }
    return 'Công việc';
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-400 text-[11px] font-medium select-none">
        {validEvidence.length > 1 ? `Nguồn (${validEvidence.length}):` : 'Nguồn:'}
      </span>
      {displayItems.map((ev, idx) => {
        const label = renderLabel(ev);
        const isClickable = typeof onDrillDown === 'function';

        if (isClickable) {
          return (
            <button
              key={`${ev.taskId}-${idx}`}
              type="button"
              onClick={() => onDrillDown(ev)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 transition-colors cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-400/50"
              title={`Xem ${label}`}
              aria-label={`Xem chi tiết ${label}`}
            >
              <CheckSquare className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[200px]">{label}</span>
            </button>
          );
        }

        return (
          <span
            key={`${ev.taskId}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80 text-left"
          >
            <CheckSquare className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[200px]">{label}</span>
          </span>
        );
      })}

      {overflowCount > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
          title={`Còn ${overflowCount} công việc khác`}
        >
          +{overflowCount} nguồn
        </span>
      )}
    </div>
  );
};
