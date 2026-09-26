/**
 * AI Message Composer
 * - Textarea tự tăng chiều cao
 * - Enter để gửi, Shift+Enter để xuống dòng
 * - Nút Dừng trả lời khi đang streaming
 * - Thông báo giới hạn AI
 * - Đếm ký tự và chặn nội dung vượt 4000 ký tự
 */

import React, { useRef, useEffect } from 'react';
import { Send, Square, AlertTriangle, Sparkles } from 'lucide-react';

interface AIAssistantComposerProps {
  input: string;
  isStreaming: boolean;
  isCreatingConversation: boolean;
  error: string | null;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export const AIAssistantComposer: React.FC<AIAssistantComposerProps> = ({
  input,
  isStreaming,
  isCreatingConversation,
  error,
  onInputChange,
  onSend,
  onStop,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 4000;
  const charsLeft = MAX_CHARS - input.length;
  const isNearLimit = charsLeft < 300;
  const isOverLimit = charsLeft < 0;

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at 180px height
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && !isCreatingConversation && input.trim() && !isOverLimit) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-200/90 bg-white p-3 sm:p-4">
      <div className="mx-auto max-w-4xl space-y-2">
        {/* Error alert banner */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 border border-rose-200/80 animate-in fade-in duration-200"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Input box */}
        <div className="relative flex flex-col rounded-2xl border border-slate-300 bg-white shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            disabled={isStreaming || isCreatingConversation}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi về công việc hoặc cách sử dụng Work & KPI… (Enter để gửi, Shift+Enter xuống dòng)"
            aria-label="Nội dung câu hỏi cho Trợ lý AI"
            className="w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden disabled:opacity-60 leading-relaxed"
          />

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/60 rounded-b-2xl">
            {/* Character counter & Hint */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>Shift+Enter để xuống dòng</span>
              {isNearLimit && (
                <span className={`font-mono ${isOverLimit ? 'text-rose-600 font-semibold' : 'text-amber-600'}`}>
                  • Còn {charsLeft} ký tự
                </span>
              )}
            </div>

            {/* Action buttons: Send / Stop */}
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Dừng câu trả lời"
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-white" />
                  <span>Dừng trả lời</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!input.trim() || isCreatingConversation || isOverLimit}
                  aria-label="Gửi câu hỏi"
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Gửi</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI Disclaimer */}
        <p className="text-center text-[11px] text-slate-400">
          AI có thể đưa ra thông tin chưa chính xác. Bạn nên kiểm tra lại nội dung quan trọng trước khi sử dụng.
        </p>
      </div>
    </div>
  );
};
