import React from 'react';
import {
  Target,
  FileText,
  ShieldCheck,
  Activity,
  User,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { KPIEvidenceRef } from '../../../types/kpi-intelligence';

export interface KPIEvidenceListProps {
  evidence?: KPIEvidenceRef[];
  onDrillDown?: (evidence: KPIEvidenceRef) => void;
  maxDisplay?: number;
  className?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUUID = (str?: string | null): boolean => {
  if (!str) return false;
  return UUID_REGEX.test(str.trim());
};

export const getHumanReadableLabel = (ev: KPIEvidenceRef): string => {
  if (ev.kpiName && !isUUID(ev.kpiName)) {
    return ev.kpiName.trim();
  }
  if (ev.type === 'kpi_item') {
    return 'Mục KPI';
  }
  if (ev.type === 'kpi_assignment') {
    return 'Giao KPI';
  }
  return 'KPI';
};

export const KPIEvidenceList: React.FC<KPIEvidenceListProps> = ({
  evidence,
  onDrillDown,
  maxDisplay = 4,
  className = ''
}) => {
  if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
    return null;
  }

  // Filter valid and supported evidence types only (E5.1.14 & E5.1.15)
  const validEvidence = evidence.filter((ev) => {
    if (!ev || typeof ev !== 'object') return false;
    if (ev.type !== 'kpi_assignment' && ev.type !== 'kpi_item') return false;
    return Boolean(ev.assignmentId);
  });

  if (validEvidence.length === 0) {
    return null;
  }

  const displayItems = validEvidence.slice(0, maxDisplay);
  const overflowCount = validEvidence.length - maxDisplay;

  return (
    <div
      data-testid="kpi-evidence-list"
      className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${className}`}
    >
      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium select-none">
        {validEvidence.length > 1 ? `Căn cứ (${validEvidence.length}):` : 'Căn cứ:'}
      </span>

      {displayItems.map((ev, idx) => {
        const primaryLabel = getHumanReadableLabel(ev);
        const isClickable = typeof onDrillDown === 'function';

        // Badges and descriptors
        const isOfficial = ev.scoreMode === 'official';
        const isLive = ev.scoreMode === 'live';

        // Scoring & Actual factual indicators
        const hasMissingActual = ev.actual === null || ev.actual === undefined;
        const isUnscored = ev.scoringStatus === 'not_scored';
        const isPartial = ev.scoringStatus === 'partial';

        const content = (
          <>
            {ev.type === 'kpi_item' ? (
              <Target className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            )}

            <span className="font-medium truncate max-w-[220px]" title={primaryLabel}>
              {primaryLabel}
            </span>

            {/* Historical Unit Label (E5.1.17) */}
            {ev.unitLabel && (
              <span
                data-testid="evidence-unit-label"
                className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 px-1 py-0.2 bg-slate-200/60 dark:bg-slate-700/60 rounded"
                title={`Đơn vị: ${ev.unitLabel}`}
              >
                <Building2 className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[120px]">{ev.unitLabel}</span>
              </span>
            )}

            {/* Assignee label if present and distinct */}
            {ev.assigneeLabel && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 px-1 py-0.2 bg-slate-200/60 dark:bg-slate-700/60 rounded"
                title={`Nhân sự: ${ev.assigneeLabel}`}
              >
                <User className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[100px]">{ev.assigneeLabel}</span>
              </span>
            )}

            {/* Period label */}
            {ev.periodLabel && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 px-1 py-0.2 bg-slate-200/60 dark:bg-slate-700/60 rounded"
                title={`Kỳ: ${ev.periodLabel}`}
              >
                <Calendar className="w-2.5 h-2.5 shrink-0" />
                <span>{ev.periodLabel}</span>
              </span>
            )}

            {/* Score Mode Badges (E5.1.9 & E5.1.10) */}
            {isOfficial && (
              <span
                data-testid="badge-official"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80"
                title="Kết quả chính thức"
              >
                <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                <span>Kết quả chính thức</span>
              </span>
            )}

            {isLive && (
              <span
                data-testid="badge-live"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80"
                title="Kết quả hiện tại"
              >
                <Activity className="w-2.5 h-2.5 shrink-0" />
                <span>Kết quả hiện tại</span>
              </span>
            )}

            {/* Missing Actual / Unscored / Partial (E5.1.11, E5.1.12, E5.1.13) */}
            {hasMissingActual && (
              <span
                data-testid="badge-missing-actual"
                className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/70"
              >
                Chưa có Actual
              </span>
            )}

            {isUnscored && (
              <span
                data-testid="badge-unscored"
                className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              >
                Chưa chấm điểm
              </span>
            )}

            {isPartial && (
              <span
                data-testid="badge-partial"
                className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70"
              >
                Kết quả một phần
              </span>
            )}

            {/* Target and Actual if present and not missing */}
            {!hasMissingActual && ev.actual !== undefined && (
              <span className="text-[10px] text-slate-600 dark:text-slate-400">
                Thực tế: {String(ev.actual)}
              </span>
            )}
            {ev.target !== undefined && ev.target !== null && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Mục tiêu: {String(ev.target)}
              </span>
            )}
          </>
        );

        const key = `${ev.type}-${ev.assignmentId}-${ev.assignmentItemId || idx}`;

        // Secure Drill-Down Principle (Section 10):
        // Only render clickable button if onDrillDown is passed from parent!
        if (isClickable) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDrillDown(ev)}
              className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50/80 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-400/50"
              title={`Xem chi tiết ${primaryLabel}`}
              aria-label={`Xem chi tiết ${primaryLabel}`}
            >
              {content}
            </button>
          );
        }

        // Non-clickable element if no onDrillDown handler provided
        return (
          <span
            key={key}
            data-testid="evidence-item-static"
            className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 text-left"
          >
            {content}
          </span>
        );
      })}

      {overflowCount > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          title={`Còn ${overflowCount} căn cứ khác`}
        >
          +{overflowCount} căn cứ
        </span>
      )}
    </div>
  );
};
