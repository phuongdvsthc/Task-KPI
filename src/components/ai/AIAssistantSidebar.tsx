/**
 * AI Assistant Sidebar / Drawer
 * - Danh sách cuộc trò chuyện của chính người dùng
 * - Nút "Cuộc trò chuyện mới"
 * - Bộ lọc active / archived
 * - Thao tác đổi tên, archive, xóa
 * - Loading skeleton, empty state, error state + retry
 * - Hỗ trợ desktop view và mobile drawer view
 */

import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Archive,
  Trash2,
  Edit3,
  MoreVertical,
  Loader2,
  AlertCircle,
  RefreshCw,
  FolderArchive,
  MessagesSquare,
  X,
} from 'lucide-react';
import { AIConversationEntity } from '../../services/ai/conversation/conversation.types';

interface AIAssistantSidebarProps {
  conversations: AIConversationEntity[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  canDelete: boolean;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onRename: (conversation: AIConversationEntity) => void;
  onArchive: (conversation: AIConversationEntity) => void;
  onDelete: (conversation: AIConversationEntity) => void;
  onRetryLoad: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
  conversations,
  activeConversationId,
  isLoading,
  error,
  canDelete,
  onSelectConversation,
  onNewChat,
  onRename,
  onArchive,
  onDelete,
  onRetryLoad,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [filterStatus, setFilterStatus] = useState<'active' | 'archived'>('active');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredConversations = conversations.filter(
    (c) => (c.status || 'active') === filterStatus
  );

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const content = (
    <div className="flex h-full flex-col bg-slate-50/70 border-r border-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-none">Hội thoại</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Lịch sử trợ lý AI</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng danh sách hội thoại"
            className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Action button: New Chat */}
      <div className="p-3 bg-white border-b border-slate-200/60">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.25]" />
          <span>Cuộc trò chuyện mới</span>
        </button>

        {/* Tab switch: Hoạt động / Đã lưu trữ */}
        <div className="mt-2.5 flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`flex-1 rounded-md py-1.5 text-center transition-all cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Hoạt động
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('archived')}
            className={`flex-1 rounded-md py-1.5 text-center transition-all cursor-pointer ${
              filterStatus === 'archived'
                ? 'bg-white text-indigo-600 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Đã lưu trữ
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl bg-slate-200/70 p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-slate-300" />
                <div className="h-2.5 w-1/3 rounded bg-slate-300/80" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="m-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-rose-500 mb-1.5" />
            <p className="text-xs text-rose-800 font-medium">{error}</p>
            <button
              type="button"
              onClick={onRetryLoad}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 shadow-xs hover:bg-rose-50 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {!isLoading && !error && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            {filterStatus === 'active' ? (
              <>
                <MessageSquare className="h-8 w-8 stroke-[1.5] text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Chưa có hội thoại nào</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Bắt đầu bằng cách bấm &quot;Cuộc trò chuyện mới&quot;</p>
              </>
            ) : (
              <>
                <FolderArchive className="h-8 w-8 stroke-[1.5] text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Không có hội thoại đã lưu trữ</p>
              </>
            )}
          </div>
        )}

        {!isLoading &&
          !error &&
          filteredConversations.map((convo) => {
            const isActive = convo.id === activeConversationId;
            const isMenuOpen = openMenuId === convo.id;

            return (
              <div
                key={convo.id}
                className={`group relative flex items-center justify-between rounded-xl p-2.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/90 text-indigo-950 font-medium shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100/90'
                }`}
                onClick={() => {
                  onSelectConversation(convo.id);
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <p className="truncate text-xs font-medium text-slate-900 leading-snug">
                      {convo.title || 'Cuộc trò chuyện mới'}
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 pl-5">
                    {formatDate(convo.last_message_at || convo.updated_at || convo.created_at)}
                  </p>
                </div>

                {/* Dropdown Menu Actions */}
                <div
                  className="relative shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Tùy chọn cuộc trò chuyện"
                    onClick={() => setOpenMenuId(isMenuOpen ? null : convo.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 cursor-pointer"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 top-8 z-40 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onRename(convo);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                          <span>Đổi tên</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onArchive(convo);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Archive className="h-3.5 w-3.5 text-slate-400" />
                          <span>{convo.status === 'archived' ? 'Bỏ lưu trữ' : 'Lưu trữ'}</span>
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDelete(convo);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full w-72 shrink-0 flex-col">
        {content}
      </div>

      {/* Mobile drawer backdrop and sheet */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
