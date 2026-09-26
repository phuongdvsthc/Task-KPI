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
  DailyReportIntelligenceResult,
  EvidenceRef
} from '../../../types/daily-report-intelligence';
import { EvidenceList, formatVNDate } from './EvidenceList';

interface DailyReportAIResultPanelProps {
  result: DailyReportIntelligenceResult;
  role: 'staff' | 'manager';
  unitName?: string;
  onDrillDownEvidence?: (evidence: EvidenceRef) => void;
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

export const DailyReportAIResultPanel: React.FC<DailyReportAIResultPanelProps> = ({
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

  const reportCount = metadata?.reportCount ?? 0;
  const staffCount = metadata?.staffCount ?? 0;
  const generatedTimeText = formatVNTimestamp(metadata?.generatedAt);

  const handleCopy = () => {
    try {
      const parts: string[] = [];
      const title = role === 'staff' ? 'TÓM TẮT BÁO CÁO BẰNG AI' : 'TỔNG HỢP BÁO CÁO BẰNG AI';
      parts.push(title);
      if (role === 'manager') {
        parts.push(`Phạm vi: ${unitName || 'Toàn bộ phạm vi quản lý'}`);
      }
      parts.push(`Thời gian: ${dateDisplay}`);
      parts.push(`Dữ liệu: ${reportCount} báo cáo${role === 'manager' ? ` • ${staffCount} nhân sự` : ''}`);
      parts.push('');

      if (summary) {
        parts.push('--- TỔNG QUAN ---');
        parts.push(summary);
        parts.push('');
      }

      if (highlights.length > 0) {
        parts.push('--- ĐIỂM NỔI BẬT ---');
        highlights.forEach((h) => parts.push(`• ${h.text}`));
        parts.push('');
      }

      if (issues.length > 0) {
        parts.push('--- VƯỚNG MẮC ---');
        issues.forEach((item) => parts.push(`• ${item.text}`));
        parts.push('');
      }

      if (actions.length > 0) {
        parts.push('--- VIỆC CẦN THEO DÕI ---');
        actions.forEach((act) => {
          const typeLabel = act.actionType === 'explicit' ? '[Báo cáo ghi]' : '[Gợi ý theo dõi]';
          parts.push(`• ${typeLabel} ${act.text}`);
        });
        parts.push('');
      }

      navigator.clipboard.writeText(parts.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Fast path for empty data
  if (reportCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center space-y-3 shadow-xs">
        <div className="inline-flex p-2.5 bg-slate-100 rounded-full text-slate-400">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-sm font-medium text-slate-700">
          Không có dữ liệu báo cáo trong khoảng thời gian đã chọn.
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {role === 'staff'
            ? 'Bạn chưa nộp báo cáo nào trong khoảng thời gian này.'
            : 'Chưa có nhân viên nào gửi báo cáo trong phạm vi và thời gian đã chọn.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header Container */}
      <div className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left info: Title & Scope */}
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                {role === 'staff' ? 'Tóm tắt báo cáo bằng AI' : 'Tổng hợp báo cáo bằng AI'}
              </h3>
            </div>

            {role === 'manager' && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Phạm vi: <strong className="text-slate-800">{unitName || 'Toàn bộ phạm vi quản lý'}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Right info: Date & Counts */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/80 shadow-2xs font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateDisplay}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/80 shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">
                {reportCount} báo cáo
                {role === 'manager' && ` • ${staffCount} nhân sự`}
              </span>
            </div>
          </div>
        </div>

        {/* Truncated Context Notice */}
        {metadata?.truncatedContext && (
          <div className="mt-3 text-xs bg-amber-50/90 text-amber-800 border border-amber-200/80 rounded-lg p-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Kết quả được tổng hợp từ phần dữ liệu nằm trong giới hạn xử lý.</span>
          </div>
        )}
      </div>

      {/* Structured Sections */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* Section 1: Summary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {role === 'staff' ? 'Tóm tắt' : 'Tổng quan'}
            </h4>
            <span className="text-[11px] text-slate-400">
              Nội dung do AI tổng hợp từ báo cáo đã chọn
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
        </div>

        {/* Section 2: Highlights */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Điểm nổi bật</span>
          </h4>
          {highlights.length > 0 ? (
            <ul className="space-y-2.5">
              {highlights.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 text-sm text-slate-800 flex items-start gap-2.5"
                >
                  <span className="text-emerald-600 font-bold mt-0.5 select-none">•</span>
                  <div className="flex-1">
                    <span className="block leading-relaxed">{item.text}</span>
                    <EvidenceList
                      evidence={item.evidence}
                      role={role}
                      onDrillDown={onDrillDownEvidence}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic p-3 rounded-xl bg-slate-50/50 border border-slate-100">
              Chưa ghi nhận điểm nổi bật.
            </p>
          )}
        </div>

        {/* Section 3: Issues */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Vướng mắc</span>
          </h4>
          {issues.length > 0 ? (
            <ul className="space-y-2.5">
              {issues.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-amber-50/40 border border-amber-100 text-sm text-slate-800 flex items-start gap-2.5"
                >
                  <span className="text-amber-600 font-bold mt-0.5 select-none">•</span>
                  <div className="flex-1">
                    <span className="block leading-relaxed">{item.text}</span>
                    <EvidenceList
                      evidence={item.evidence}
                      role={role}
                      onDrillDown={onDrillDownEvidence}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic p-3 rounded-xl bg-slate-50/50 border border-slate-100">
              Chưa ghi nhận vướng mắc.
            </p>
          )}
        </div>

        {/* Section 4: Actions */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5 mb-2.5">
            <ArrowRight className="w-4 h-4 text-indigo-600" />
            <span>Việc cần theo dõi</span>
          </h4>
          {actions.length > 0 ? (
            <ul className="space-y-2.5">
              {actions.map((item, idx) => {
                const isExplicit = item.actionType === 'explicit';
                return (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 text-sm text-slate-800 flex items-start gap-2.5"
                  >
                    <span className="text-indigo-600 font-bold mt-0.5 select-none">•</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isExplicit
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isExplicit ? 'Báo cáo ghi' : 'Gợi ý theo dõi'}
                        </span>
                      </div>
                      <span className="block leading-relaxed">{item.text}</span>
                      <EvidenceList
                        evidence={item.evidence}
                        role={role}
                        onDrillDown={onDrillDownEvidence}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic p-3 rounded-xl bg-slate-50/50 border border-slate-100">
              Chưa có việc cần theo dõi.
            </p>
          )}
        </div>
      </div>

      {/* Footer Container */}
      <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
          <span>Nội dung do AI tổng hợp từ dữ liệu báo cáo và có thể cần kiểm tra lại với nguồn gốc.</span>
          {generatedTimeText && (
            <span className="text-slate-400 text-[11px] font-medium shrink-0">
              • {generatedTimeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Sao chép toàn bộ nội dung tóm tắt"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Sao chép</span>
              </>
            )}
          </button>

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{role === 'staff' ? 'Tạo lại' : 'Tổng hợp lại'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
