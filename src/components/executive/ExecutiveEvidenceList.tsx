import React from 'react';
import { FileText, CheckSquare, Target, Activity } from 'lucide-react';
import { Badge } from '../common/Badge';

export interface ExecutiveEvidenceListProps {
  evidenceIds: string[];
  evidenceMap?: Record<string, { type: string; label: string; scoreMode?: string; assignmentId?: string }>;
  onDrillDown?: (type: string, id: string, assignmentId?: string) => void;
}

export const ExecutiveEvidenceList: React.FC<ExecutiveEvidenceListProps> = ({ evidenceIds, evidenceMap, onDrillDown }) => {
  if (!evidenceIds || evidenceIds.length === 0) return null;

  return (
    <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-md p-3 border border-gray-100 dark:border-gray-700">
      <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Nguồn liên quan:</h5>
      <ul className="space-y-2">
        {evidenceIds.map(id => {
          const ev = evidenceMap?.[id];
          if (!ev) {
            return (
              <li key={id} className="text-sm text-gray-500 italic">
                Nguồn không khả dụng ({id})
              </li>
            );
          }

          let Icon = FileText;
          let badgeLabel = 'Nguồn';
          let badgeColor = 'bg-gray-100 text-gray-700';

          if (ev.type === 'daily_report') {
            Icon = Activity;
            badgeLabel = 'Báo cáo ngày';
            badgeColor = 'bg-blue-100 text-blue-700';
          } else if (ev.type === 'task') {
            Icon = CheckSquare;
            badgeLabel = 'Công việc';
            badgeColor = 'bg-amber-100 text-amber-700';
          } else if (ev.type === 'kpi_assignment' || ev.type === 'kpi_item') {
            Icon = Target;
            badgeLabel = 'KPI';
            badgeColor = 'bg-purple-100 text-purple-700';
          }

          return (
            <li key={id} className="flex items-center space-x-2 text-sm">
              <Icon className="w-4 h-4 text-gray-400" />
              <Badge className={badgeColor + ' px-1.5 py-0.5 text-[10px]'}>{badgeLabel}</Badge>
              {onDrillDown ? (
                <button
                  onClick={() => onDrillDown(ev.type, id, ev.assignmentId)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                >
                  {ev.label}
                </button>
              ) : (
                <span className="text-gray-700 dark:text-gray-300">{ev.label}</span>
              )}
              {ev.scoreMode === 'official' && (
                <Badge className="bg-green-100 text-green-700 px-1.5 py-0.5 text-[10px]">Kết quả chính thức</Badge>
              )}
              {ev.scoreMode === 'live' && (
                <Badge className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 text-[10px]">Kết quả hiện tại</Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
