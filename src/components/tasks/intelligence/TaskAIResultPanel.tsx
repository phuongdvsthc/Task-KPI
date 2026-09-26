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
  Users,
  Info
} from 'lucide-react';
import {
  TaskIntelligenceResult,
  TaskEvidenceRef
} from '../../../types/task-intelligence';
import { TaskEvidenceList, formatVNDate } from './TaskEvidenceList';

interface TaskAIResultPanelProps {
  result: TaskIntelligenceResult;
  role: 'staff' | 'manager';
  unitName?: string;
  onDrillDownEvidence?: (evidence: TaskEvidenceRef) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
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

export const TaskAIResultPanel: React.FC<TaskAIResultPanelProps> = ({
  result,
  role,
  unitName,
  onDrillDownEvidence,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [copied, setCopied] = useState(false);

  const { metadata, summary, highlights = [], issues = [], actions = [] } = result;

  const dateFromFormatted = formatVNDate(metadata?.dateFrom);
  const dateToFormatted = formatVNDate(metadata?.dateTo);
  const isDateRange = metadata?.dateFrom && metadata?.dateTo && metadata.dateFrom !== metadata.dateTo;
  const dateDisplay = isDateRange
    ? `${dateFromFormatted} – ${dateToFormatted}`
    : dateFromFormatted;

  const taskCount = metadata?.taskCount ?? 0;
  const staffCount = metadata?.staffCount;
  const overdueCount = metadata?.overdueCount;
  const completedCount = metadata?.completedCount;
  const generatedTimeText = formatVNTimestamp(metadata?.generatedAt);

  const scopeDisplay = (() => {
    if (metadata?.scopeLabel === 'team') return 'Toàn phạm vi quản lý';
    if (metadata?.scopeLabel === 'unit') return unitName || 'Đơn vị';
    return metadata?.scopeLabel || unitName || 'Toàn phạm vi quản lý';
  })();

  const handleCopy = () => {
    try {
      const parts: string[] = [];
      const title = role === 'staff' ? 'TÓM TẮT CÔNG VIỆC BẰNG AI' : 'TỔNG HỢP CÔNG VIỆC BẰNG AI';
      parts.push(title);
      if (role === 'manager') {
        parts.push(`Phạm vi: ${scopeDisplay}`);
      }
      if (metadata?.dateFrom || metadata?.dateTo) {
        parts.push(`Thời gian: ${dateDisplay}`);
      }
      
      const stats = [];
      stats.push(`${taskCount} công việc`);
      if (role === 'manager' && typeof staffCount === 'number') stats.push(`${staffCount} nhân sự`);
      if (typeof overdueCount === 'number') stats.push(`${overdueCount} quá hạn`);
      if (typeof completedCount === 'number') stats.push(`${completedCount} hoàn thành`);
      
      parts.push(`Dữ liệu: ${stats.join(' • ')}`);
      parts.push('');

      if (summary) {
        parts.push('--- TỔNG QUAN ---');
        parts.push(summary);
        parts.push('');
      }

      if (highlights.length > 0) {
        parts.push('--- ĐIỂM NỔI BẬT ---');
        highlights.forEach((h) => {
           let type = '';
           if (h.riskType === 'overdue') type = '[Quá hạn] ';
           if (h.riskType === 'attention') type = '[Cần chú ý] ';
           parts.push(`• ${type}${h.text}`);
        });
        parts.push('');
      }

      if (issues.length > 0) {
        parts.push('--- VƯỚNG MẮC ---');
        issues.forEach((item) => {
           let type = '';
           if (item.riskType === 'overdue') type = '[Quá hạn] ';
           if (item.riskType === 'attention') type = '[Cần chú ý] ';
           parts.push(`• ${type}${item.text}`);
        });
        parts.push('');
      }

      if (actions.length > 0) {
        parts.push('--- VIỆC CẦN THEO DÕI ---');
        actions.forEach((item) => {
           const typeStr = item.actionType === 'suggested' ? ' (Gợi ý)' : '';
           parts.push(`• ${item.text}${typeStr}`);
        });
        parts.push('');
      }

      if (metadata?.truncatedContext) {
        parts.push('Lưu ý: Kết quả được tạo từ một phần dữ liệu công việc do giới hạn ngữ cảnh.');
      }

      navigator.clipboard.writeText(parts.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback if clipboard fails
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden text-sm flex flex-col h-full max-h-[80vh]">
      {/* HEADER */}
      <div className="flex-none bg-linear-to-r from-indigo-50 to-white px-5 py-4 border-b border-indigo-100/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              {role === 'staff' ? 'Tóm tắt công việc cá nhân' : 'Tổng hợp công việc'}
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider select-none">
                AI
              </span>
            </h3>
            <div className="mt-1 flex flex-wrap items-center text-xs text-slate-500 gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5" title="Phạm vi dữ liệu">
                <Layers className="w-3.5 h-3.5" />
                <span>{taskCount} công việc</span>
              </span>
              
              {role === 'manager' && (
                <span className="flex items-center gap-1.5" title="Phạm vi đơn vị/nhóm">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{scopeDisplay}</span>
                </span>
              )}
              {role === 'manager' && typeof staffCount === 'number' && (
                <span className="flex items-center gap-1.5" title="Số lượng nhân sự">
                  <Users className="w-3.5 h-3.5" />
                  <span>{staffCount} nhân sự</span>
                </span>
              )}
              
              {(metadata?.dateFrom || metadata?.dateTo) && (
                <span className="flex items-center gap-1.5" title="Khung thời gian">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dateDisplay}</span>
                </span>
              )}
            </div>
            {generatedTimeText && (
               <div className="mt-1 text-[11px] text-slate-400">
                  {generatedTimeText}
               </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto justify-end">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? 'Đang tạo...' : 'Làm mới'}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      {/* CONTENT SCROLL AREA */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/30">
        <div className="p-5 space-y-6">
          {/* SUMMARY */}
          {summary && (
            <div className="prose prose-sm prose-slate max-w-none text-slate-700 leading-relaxed bg-white p-4 rounded-xl shadow-xs border border-slate-100 whitespace-pre-wrap">
              {summary}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* HIGHLIGHTS */}
            <AIResultSection
              title="Điểm nổi bật"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              items={highlights}
              emptyText="Chưa ghi nhận điểm nổi bật."
              onDrillDownEvidence={onDrillDownEvidence}
            />

            {/* ISSUES */}
            <AIResultSection
              title="Vướng mắc"
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              items={issues}
              emptyText="Chưa ghi nhận vướng mắc."
              onDrillDownEvidence={onDrillDownEvidence}
            />
          </div>

          {/* ACTIONS */}
          <div className="md:col-span-2">
            <AIResultSection
              title="Việc cần theo dõi"
              icon={<ArrowRight className="w-4 h-4 text-indigo-500" />}
              items={actions}
              emptyText="Chưa có việc cần theo dõi."
              onDrillDownEvidence={onDrillDownEvidence}
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex-none p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
           <Info className="w-3.5 h-3.5 shrink-0" />
           <span>Nội dung AI chỉ mang tính hỗ trợ tổng hợp. Vui lòng đối chiếu với công việc gốc khi cần.</span>
        </div>
        {metadata?.truncatedContext && (
          <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200/50">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-[11px]">Kết quả được tạo từ một phần dữ liệu công việc do giới hạn ngữ cảnh.</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface AIResultSectionProps {
  title: string;
  icon: React.ReactNode;
  items?: Array<{
    text: string;
    actionType?: 'explicit' | 'suggested';
    riskType?: 'overdue' | 'attention';
    evidence?: TaskEvidenceRef[];
  }>;
  emptyText: string;
  onDrillDownEvidence?: (evidence: TaskEvidenceRef) => void;
}

const AIResultSection: React.FC<AIResultSectionProps> = ({
  title,
  icon,
  items,
  emptyText,
  onDrillDownEvidence
}) => {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        {icon}
        <h4 className="font-medium text-slate-800">{title}</h4>
        {items && items.length > 0 && (
          <span className="ml-auto bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200">
            {items.length}
          </span>
        )}
      </div>
      <div className="p-4 flex-1">
        {(!items || items.length === 0) ? (
          <div className="text-slate-400 italic text-sm text-center py-4">
            {emptyText}
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-3 items-start group">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0 group-hover:bg-indigo-400 transition-colors" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-700 leading-relaxed text-[13px]">
                     {item.riskType === 'overdue' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 mr-2 mb-1 whitespace-nowrap">
                           Quá hạn
                        </span>
                     )}
                     {item.riskType === 'attention' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200 mr-2 mb-1 whitespace-nowrap">
                           Cần chú ý
                        </span>
                     )}
                     {item.text}
                     {item.actionType === 'suggested' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 ml-2 whitespace-nowrap">
                           Gợi ý theo dõi
                        </span>
                     )}
                  </div>
                  <TaskEvidenceList 
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
