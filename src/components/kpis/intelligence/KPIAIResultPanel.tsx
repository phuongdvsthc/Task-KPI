import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  Target,
  Info,
  ShieldCheck,
  Activity
} from 'lucide-react';
import {
  KPIIntelligenceResult,
  KPIEvidenceRef
} from '../../../types/kpi-intelligence';
import { KPIEvidenceList } from './KPIEvidenceList';

export interface KPIAIResultPanelProps {
  result: KPIIntelligenceResult;
  role?: 'staff' | 'manager';
  unitName?: string;
  onDrillDownEvidence?: (evidence: KPIEvidenceRef) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
}

export const formatVNTimestamp = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `Tạo lúc ${hours}:${minutes}, ${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

export const KPIAIResultPanel: React.FC<KPIAIResultPanelProps> = ({
  result,
  role = 'staff',
  unitName,
  onDrillDownEvidence,
  onRegenerate,
  isRegenerating = false,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const {
    summary = '',
    highlights = [],
    issues = [],
    actions = [],
    metadata
  } = result;

  const generatedTimeText = formatVNTimestamp(metadata?.generatedAt);

  const scopeDisplay = (() => {
    if (metadata?.scopeLabel === 'team') return 'Toàn bộ nhóm';
    if (metadata?.scopeLabel === 'unit') return metadata?.unitName || unitName || 'Đơn vị';
    return metadata?.unitName || unitName || metadata?.scopeLabel || 'Phạm vi chỉ định';
  })();

  const handleCopy = () => {
    try {
      const parts: string[] = [];
      const title = role === 'staff' ? 'TÓM TẮT KPI CÁ NHÂN BẰNG AI' : 'TỔNG HỢP KPI BẰNG AI';
      parts.push(title);
      if (role === 'manager') {
        parts.push(`Phạm vi: ${scopeDisplay}`);
      }
      if (metadata?.periodLabel) {
        parts.push(`Kỳ đánh giá: ${metadata.periodLabel}`);
      }

      const stats: string[] = [];
      if (typeof metadata?.assignmentCount === 'number') stats.push(`${metadata.assignmentCount} giao KPI`);
      if (typeof metadata?.itemCount === 'number') stats.push(`${metadata.itemCount} mục KPI`);
      if (typeof metadata?.scoredCount === 'number') stats.push(`${metadata.scoredCount} đã chấm điểm`);
      if (typeof metadata?.unscoredCount === 'number') stats.push(`${metadata.unscoredCount} chưa chấm điểm`);
      if (typeof metadata?.lockedCount === 'number') stats.push(`${metadata.lockedCount} chính thức`);
      if (typeof metadata?.liveCount === 'number') stats.push(`${metadata.liveCount} hiện tại`);
      if (stats.length > 0) {
        parts.push(`Dữ liệu: ${stats.join(' • ')}`);
      }
      parts.push('');

      parts.push('--- TỔNG QUAN ---');
      parts.push(summary || 'Chưa có nội dung tóm tắt.');
      parts.push('');

      parts.push('--- ĐIỂM NỔI BẬT ---');
      if (highlights.length > 0) {
        highlights.forEach((h) => parts.push(`• ${h.text}`));
      } else {
        parts.push('Chưa ghi nhận điểm nổi bật.');
      }
      parts.push('');

      parts.push('--- VƯỚNG MẮC ---');
      if (issues.length > 0) {
        issues.forEach((item) => parts.push(`• ${item.text}`));
      } else {
        parts.push('Chưa ghi nhận vướng mắc.');
      }
      parts.push('');

      parts.push('--- VIỆC CẦN THEO DÕI ---');
      if (actions.length > 0) {
        actions.forEach((item) => {
          const typeStr = item.actionType === 'suggested' ? ' [Gợi ý theo dõi]' : '';
          parts.push(`• ${item.text}${typeStr}`);
        });
      } else {
        parts.push('Chưa có việc cần theo dõi.');
      }
      parts.push('');

      if (metadata?.truncatedContext) {
        parts.push('Lưu ý: Kết quả được tạo từ một phần dữ liệu KPI do giới hạn ngữ cảnh.');
      }
      parts.push('Nội dung AI chỉ mang tính hỗ trợ tổng hợp. Vui lòng đối chiếu với dữ liệu KPI gốc khi cần.');

      navigator.clipboard.writeText(parts.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API not available
    }
  };

  return (
    <div
      data-testid="kpi-ai-result-panel"
      className={`bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden text-sm flex flex-col h-full ${className}`}
    >
      {/* HEADER */}
      <div className="flex-none bg-linear-to-r from-indigo-50 via-white to-white dark:from-slate-850 dark:via-slate-900 dark:to-slate-900 px-5 py-4 border-b border-indigo-100/60 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
              {role === 'staff' ? 'Tóm tắt KPI cá nhân' : 'Tổng hợp KPI'}
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider select-none">
                AI
              </span>
            </h3>

            {/* Safe Metadata Display (E5.1.12) */}
            <div className="mt-1 flex flex-wrap items-center text-xs text-slate-500 dark:text-slate-400 gap-x-4 gap-y-1">
              {metadata?.periodLabel && (
                <span className="flex items-center gap-1.5" title="Kỳ đánh giá">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Kỳ: {metadata.periodLabel}</span>
                </span>
              )}

              {role === 'manager' && (
                <span className="flex items-center gap-1.5" title="Phạm vi đơn vị">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{scopeDisplay}</span>
                </span>
              )}

              {typeof metadata?.assignmentCount === 'number' && (
                <span className="flex items-center gap-1.5" title="Số lượng giao KPI">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{metadata.assignmentCount} giao KPI</span>
                </span>
              )}

              {typeof metadata?.itemCount === 'number' && (
                <span className="flex items-center gap-1.5" title="Số lượng mục KPI">
                  <Target className="w-3.5 h-3.5" />
                  <span>{metadata.itemCount} mục KPI</span>
                </span>
              )}

              {/* Live vs Official Counts if present (E5.1.9 & E5.1.10) */}
              {typeof metadata?.lockedCount === 'number' && metadata.lockedCount > 0 && (
                <span
                  data-testid="meta-locked-count"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70"
                  title="Kết quả chính thức"
                >
                  <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>{metadata.lockedCount} chính thức</span>
                </span>
              )}

              {typeof metadata?.liveCount === 'number' && metadata.liveCount > 0 && (
                <span
                  data-testid="meta-live-count"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70"
                  title="Kết quả hiện tại"
                >
                  <Activity className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{metadata.liveCount} hiện tại</span>
                </span>
              )}
            </div>

            {generatedTimeText && (
              <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                {generatedTimeText}
              </div>
            )}
          </div>
        </div>

        {/* CONTROLS (Read-only: regenerate and copy only. Strictly NO mutation controls!) */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto justify-end">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
              aria-label={isRegenerating ? 'Đang phân tích KPI...' : 'Làm mới phân tích KPI'}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? 'Đang tạo...' : 'Làm mới'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Đã sao chép nội dung' : 'Sao chép kết quả tóm tắt KPI'}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      {/* CONTENT SCROLL AREA */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/40 dark:bg-slate-950/40">
        <div className="p-5 space-y-6">
          {/* 1. TỔNG QUAN / TÓM TẮT (E5.1.2) */}
          <div data-testid="kpi-summary-section">
            <h4 className="sr-only">Tóm tắt</h4>
            <div
              data-testid="kpi-summary-content"
              className="text-slate-700 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-700/80 whitespace-pre-wrap text-[13.5px]"
            >
              {summary || 'Chưa có nội dung tóm tắt.'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2. ĐIỂM NỔI BẬT (E5.1.3 & E5.1.6) */}
            <KPIResultSection
              title="Điểm nổi bật"
              testId="kpi-highlights-section"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              items={highlights}
              emptyText="Chưa ghi nhận điểm nổi bật."
              onDrillDownEvidence={onDrillDownEvidence}
            />

            {/* 3. VƯỚNG MẮC (E5.1.4 & E5.1.7) */}
            <KPIResultSection
              title="Vướng mắc"
              testId="kpi-issues-section"
              icon={<AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              items={issues}
              emptyText="Chưa ghi nhận vướng mắc."
              onDrillDownEvidence={onDrillDownEvidence}
            />
          </div>

          {/* 4. VIỆC CẦN THEO DÕI (E5.1.5 & E5.1.8 & E5.1.20) */}
          <div data-testid="kpi-actions-section">
            <KPIResultSection
              title="Việc cần theo dõi"
              testId="kpi-actions-inner"
              icon={<ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />}
              items={actions}
              emptyText="Chưa có việc cần theo dõi."
              onDrillDownEvidence={onDrillDownEvidence}
            />
          </div>
        </div>
      </div>

      {/* FOOTER: Disclaimer & Truncation Notice (E5.1.18 & E5.1.19) */}
      <div className="flex-none p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div data-testid="kpi-disclaimer" className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            Nội dung AI chỉ mang tính hỗ trợ tổng hợp. Vui lòng đối chiếu với dữ liệu KPI gốc khi cần.
          </span>
        </div>

        {metadata?.truncatedContext && (
          <div
            data-testid="kpi-truncation-notice"
            className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded border border-amber-200/80 dark:border-amber-800/80"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-[11px]">
              Kết quả được tạo từ một phần dữ liệu KPI do giới hạn ngữ cảnh.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface KPIResultSectionProps {
  title: string;
  testId?: string;
  icon: React.ReactNode;
  items?: Array<{
    text: string;
    actionType?: 'explicit' | 'suggested';
    evidence?: KPIEvidenceRef[];
  }>;
  emptyText: string;
  onDrillDownEvidence?: (evidence: KPIEvidenceRef) => void;
}

const KPIResultSection: React.FC<KPIResultSectionProps> = ({
  title,
  testId,
  icon,
  items,
  emptyText,
  onDrillDownEvidence
}) => {
  return (
    <div
      data-testid={testId}
      className="bg-white dark:bg-slate-850 rounded-xl shadow-xs border border-slate-200/70 dark:border-slate-700/80 overflow-hidden flex flex-col h-full"
    >
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-2">
        {icon}
        <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{title}</h4>
        {items && items.length > 0 && (
          <span className="ml-auto bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {items.length}
          </span>
        )}
      </div>

      <div className="p-4 flex-1">
        {!items || items.length === 0 ? (
          <div
            data-testid="section-empty-text"
            className="text-slate-400 dark:text-slate-500 italic text-sm text-center py-4 select-none"
          >
            {emptyText}
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-3 items-start group">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 shrink-0 group-hover:bg-indigo-500 transition-colors" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-700 dark:text-slate-200 leading-relaxed text-[13px]">
                    {/* Render text safely as React children to prevent any XSS (E5.1.22, E5.1.23, E5.1.24) */}
                    <span>{item.text}</span>

                    {/* Suggested Action label (E5.1.20) */}
                    {item.actionType === 'suggested' && (
                      <span
                        data-testid="badge-suggested-action"
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 ml-2 whitespace-nowrap"
                      >
                        Gợi ý theo dõi
                      </span>
                    )}
                  </div>

                  {/* Render Evidence list */}
                  <KPIEvidenceList
                    evidence={item.evidence}
                    onDrillDown={onDrillDownEvidence}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
