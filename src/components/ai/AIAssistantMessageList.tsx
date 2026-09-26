/**
 * AI Message List View
 * - Hiển thị tin nhắn người dùng và Trợ lý AI
 * - Safe Markdown rendering
 * - Trạng thái streaming với con trỏ nhấp nháy
 * - Sao chép câu trả lời AI
 * - Nút thử lại khi tin nhắn lỗi
 * - Empty state với các gợi ý câu hỏi ban đầu
 * - Cuộn thông minh: tự cuộn nếu ở gần đáy, không kéo giật nếu người dùng đang đọc ở trên
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ArrowDown,
  AlertCircle,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { AIMessageEntity } from '../../services/ai/conversation/conversation.types';
import { SafeMarkdown } from '../common/SafeMarkdown';
import { AIAssistantSourcesList, StreamSourceItem } from './AIAssistantSourcesList';

interface AIAssistantMessageListProps {
  messages: AIMessageEntity[];
  streamingContent: string;
  isStreaming: boolean;
  isLoadingMessages: boolean;
  onRetry: () => void;
  onSelectSuggestion?: (text: string) => void;
  ragStatus?: 'searching' | 'sources_found' | 'no_sources' | 'unavailable' | null;
  streamingSources?: StreamSourceItem[];
}

const SUGGESTIONS = [
  'Hướng dẫn tôi tạo báo cáo công việc hằng ngày.',
  'KPI trong phần mềm được theo dõi như thế nào?',
  'Giúp tôi soạn nội dung báo cáo tuần.',
  'Tôi là nhân viên mới, nên bắt đầu sử dụng phần mềm từ đâu?',
];

export const AIAssistantMessageList: React.FC<AIAssistantMessageListProps> = ({
  messages,
  streamingContent,
  isStreaming,
  isLoadingMessages,
  onRetry,
  onSelectSuggestion,
  ragStatus,
  streamingSources,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  // Check scroll position to determine if auto-scroll should activate
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom < 100;
    isNearBottomRef.current = isNear;
    setShowScrollBottom(!isNear);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  // Auto-scroll when messages or streaming tokens change, only if near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [messages, streamingContent, isStreaming]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Loading messages skeleton */}
        {isLoadingMessages && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 animate-pulse" />
              <div className="space-y-2 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 w-2/3 animate-pulse">
                <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <div className="space-y-2 rounded-2xl bg-indigo-50 p-4 border border-indigo-100 w-1/2 animate-pulse">
                <div className="h-3.5 w-full rounded bg-indigo-200/80" />
              </div>
            </div>
          </div>
        )}

        {/* Empty state & Suggestions */}
        {!isLoadingMessages && messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs mb-4 ring-8 ring-indigo-50/50">
              <Bot className="h-8 w-8 stroke-[1.75]" />
            </div>

            <h3 className="text-base font-semibold text-slate-900">
              Trợ lý AI - Work & KPI Report
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
              Tôi có thể hỗ trợ bạn tìm hiểu công việc, hướng dẫn sử dụng Work & KPI, giải thích quy trình và soạn thảo nội dung.
            </p>

            {/* Suggested prompts */}
            <div className="mt-8 w-full max-w-lg space-y-2 text-left">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span>Gợi ý câu hỏi bắt đầu:</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelectSuggestion?.(suggestion)}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-900 transition-all text-left shadow-2xs cursor-pointer group"
                  >
                    <span className="font-medium group-hover:text-indigo-600">
                      &quot;{suggestion}&quot;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message items */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isFailed = msg.status === 'failed';
          const isStopped = msg.status === 'stopped';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-2xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                }`}
              >
                {/* Content */}
                {isUser ? (
                  <div className="whitespace-pre-line text-sm text-white break-words">
                    {msg.content}
                  </div>
                ) : (
                  <div>
                    <SafeMarkdown content={msg.content} />

                    {/* Source citations for completed assistant message */}
                    {msg.sources && msg.sources.length > 0 && (
                      <AIAssistantSourcesList sources={msg.sources} />
                    )}

                    {/* Subtle note if message used no internal documents */}
                    {!isFailed && (!msg.sources || msg.sources.length === 0) && (
                      <p className="mt-2 text-[11px] text-slate-400 italic">
                        (Câu trả lời này không sử dụng tài liệu nội bộ)
                      </p>
                    )}

                    {/* Status badges */}
                    {isStopped && (
                      <p className="mt-2 text-[11px] italic text-amber-600">
                        (Câu trả lời đã được dừng theo yêu cầu)
                      </p>
                    )}

                    {isFailed && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        <span>Không thể hoàn thành câu trả lời.</span>
                        <button
                          type="button"
                          onClick={onRetry}
                          className="ml-2 inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Thử lại</span>
                        </button>
                      </div>
                    )}

                    {/* Message action bar */}
                    {!isFailed && msg.content && (
                      <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          aria-label={copiedId === msg.id ? 'Đã sao chép' : 'Sao chép câu trả lời'}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live streaming message */}
        {isStreaming && (
          <div className="flex gap-3 text-sm justify-start animate-in fade-in duration-150">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Bot className="h-4 w-4" />
            </div>

            <div
              aria-live="polite"
              className="relative max-w-[85%] sm:max-w-[75%] rounded-2xl bg-white border border-indigo-200/80 p-4 shadow-2xs text-slate-800 rounded-bl-xs"
            >
              {/* RAG searching indicator */}
              {ragStatus === 'searching' && (
                <div className="mb-2.5 flex items-center gap-2 rounded-md bg-indigo-50/70 px-2.5 py-1.5 text-xs font-medium text-indigo-700 border border-indigo-100/80 animate-pulse">
                  <Search className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tra cứu kho tài liệu nội bộ...</span>
                </div>
              )}

              {/* RAG unavailable banner */}
              {ragStatus === 'unavailable' && (
                <div className="mb-2.5 flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>Kho tài liệu nội bộ tạm thời không khả dụng. Trợ lý sẽ trả lời dựa trên kiến thức chung.</span>
                </div>
              )}

              {streamingContent ? (
                <>
                  <SafeMarkdown content={streamingContent} />
                  <span className="inline-block h-3.5 w-1.5 ml-1 bg-indigo-600 animate-pulse align-middle" />

                  {/* Streaming source list if sources were already found */}
                  {streamingSources && streamingSources.length > 0 && (
                    <AIAssistantSourcesList sources={streamingSources} />
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                  </span>
                  <span>{ragStatus === 'searching' ? 'Đang chuẩn bị câu trả lời từ tài liệu...' : 'Trợ lý AI đang suy nghĩ...'}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating scroll to bottom button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Cuộn xuống tin nhắn mới nhất"
          className="fixed bottom-24 right-8 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
