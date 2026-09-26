import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { AIMessageSourceEntity } from '../../services/ai/conversation/conversation.types';

export interface StreamSourceItem {
  sourceId: string;
  title: string;
  version?: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  snippet?: string;
}

interface AIAssistantSourcesListProps {
  sources: (AIMessageSourceEntity | StreamSourceItem)[];
}

export const AIAssistantSourcesList: React.FC<AIAssistantSourcesListProps> = ({ sources }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!sources || sources.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mt-3.5 border-t border-slate-100 pt-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
        <BookOpen className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
        <span>Tài liệu nội bộ đã tham khảo ({sources.length})</span>
      </div>

      <div className="space-y-1.5">
        {sources.map((src, idx) => {
          // Normalize between AIMessageSourceEntity and StreamSourceItem
          const sourceId = (src as StreamSourceItem).sourceId || `S${(src as AIMessageSourceEntity).rank || idx + 1}`;
          const title =
            (src as AIMessageSourceEntity).document_title_snapshot ||
            (src as StreamSourceItem).title ||
            'Tài liệu nội bộ';
          const pageNumber =
            (src as AIMessageSourceEntity).page_number_snapshot ??
            (src as StreamSourceItem).pageNumber;
          const sectionTitle = (src as StreamSourceItem).sectionTitle;
          const content =
            (src as AIMessageSourceEntity).chunk_content_snapshot ||
            (src as StreamSourceItem).snippet;

          const locationParts: string[] = [];
          if (pageNumber) locationParts.push(`Trang ${pageNumber}`);
          if (sectionTitle) locationParts.push(`Mục: ${sectionTitle}`);
          const locationText = locationParts.join(' • ');

          const uniqueKey = `source-${idx}-${sourceId}`;
          const isExpanded = expandedId === uniqueKey;

          return (
            <div
              key={uniqueKey}
              className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 text-xs text-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="inline-flex shrink-0 items-center justify-center rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-indigo-800">
                    [{sourceId}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate" title={title}>
                      {title}
                    </p>
                    {locationText && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{locationText}</p>
                    )}
                  </div>
                </div>

                {content && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(uniqueKey)}
                    aria-label={isExpanded ? 'Thu gọn trích đoạn' : 'Xem đoạn trích dẫn'}
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Thu gọn' : 'Đoạn trích'}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              {/* Collapsible snippet preview */}
              {isExpanded && content && (
                <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
