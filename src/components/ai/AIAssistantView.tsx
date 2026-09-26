/**
 * Main AI Assistant View (AI-B3)
 * - 2-column layout (Desktop: Sidebar + Chat viewport; Mobile: Drawer + Chat viewport)
 * - Lazy conversation creation: Does NOT create DB record until first message is sent
 * - Full streaming with AbortController on stop/unmount/navigation
 * - Rename, Archive, Delete with confirmation dialogs
 * - Idempotency clientRequestId support
 * - Role-based permissions via useAuthorization()
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu,
  Sparkles,
  Bot,
  AlertCircle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { AIAssistantSidebar } from './AIAssistantSidebar';
import { AIAssistantMessageList } from './AIAssistantMessageList';
import { AIAssistantComposer } from './AIAssistantComposer';
import { RenameConversationModal, DeleteConversationModal } from './AIAssistantModals';
import {
  aiAssistantApiClient,
  AIAssistantApiError,
} from '../../services/ai/aiAssistantApiClient';
import {
  AIConversationEntity,
  AIMessageEntity,
} from '../../services/ai/conversation/conversation.types';
import { useAuthorization } from '../../context/AuthorizationContext';
import { CAPABILITIES } from '../../types/authorization';

export const AIAssistantView: React.FC = () => {
  const { hasCapability } = useAuthorization();
  const canDelete = hasCapability(CAPABILITIES.AI_CONVERSATIONS_DELETE_OWN);

  // Conversations list state
  const [conversations, setConversations] = useState<AIConversationEntity[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  // Active conversation & messages state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessageEntity[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Composer input & Streaming state
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Mobile drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [renameTarget, setRenameTarget] = useState<AIConversationEntity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIConversationEntity | null>(null);

  // References to handle clean aborting on navigation/unmount
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastClientRequestIdRef = useRef<string | null>(null);
  const lastFailedContentRef = useRef<string | null>(null);

  // 1. Fetch conversations list
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      setConversationsError(null);
      const res = await aiAssistantApiClient.listConversations({ limit: 50 });
      setConversations(res.items);
    } catch (err: any) {
      setConversationsError(err?.message || 'Không thể tải danh sách cuộc trò chuyện.');
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load messages when activeConversationId changes
  const loadMessages = useCallback(async (conversationId: string) => {
    // Abort ongoing stream if user switches conversation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent('');
    }

    try {
      setIsLoadingMessages(true);
      setMessagesError(null);
      setComposerError(null);
      const res = await aiAssistantApiClient.listMessages(conversationId, { limit: 100 });
      setMessages(res.items);
    } catch (err: any) {
      if (err?.status === 404) {
        setMessagesError('Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập.');
      } else {
        setMessagesError(err?.message || 'Không thể tải nội dung tin nhắn.');
      }
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      // New chat state (empty messages)
      setMessages([]);
      setIsLoadingMessages(false);
      setMessagesError(null);
    }
  }, [activeConversationId, loadMessages]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 3. User actions: New Chat
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent('');
    }
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
    setComposerError(null);
    setMessagesError(null);
  };

  // 4. Stop streaming action
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);

    // Save partial content as stopped in local messages state
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `stopped-${Date.now()}`,
          conversation_id: activeConversationId || '',
          role: 'assistant',
          content: streamingContent,
          status: 'stopped',
          sequence_number: prev.length + 1,
          model_code: null,
          input_tokens: 0,
          output_tokens: 0,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
  };

  // 5. Send message & Streaming pipeline
  const handleSendMessage = async (contentToSend?: string) => {
    const text = (contentToSend ?? input).trim();
    if (!text || isStreaming || isCreatingConversation) return;

    setComposerError(null);
    lastFailedContentRef.current = text;
    const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    lastClientRequestIdRef.current = clientRequestId;

    let targetConversationId = activeConversationId;

    try {
      // Step A: Lazy creation of conversation if starting fresh
      if (!targetConversationId) {
        setIsCreatingConversation(true);
        // Create conversation first
        const newConvo = await aiAssistantApiClient.createConversation({
          title: text.slice(0, 50),
        });
        targetConversationId = newConvo.id;
        setActiveConversationId(newConvo.id);
        setConversations((prev) => [newConvo, ...prev]);
        setIsCreatingConversation(false);
      }

      // Step B: Optimistically add user message to messages list
      const tempUserMessage: AIMessageEntity = {
        id: `temp-user-${Date.now()}`,
        conversation_id: targetConversationId,
        role: 'user',
        content: text,
        status: 'completed',
        sequence_number: messages.length + 1,
        model_code: null,
        input_tokens: 0,
        output_tokens: 0,
        client_request_id: clientRequestId,
        created_at: new Date().toISOString(),
        completed_at: null,
      };

      setMessages((prev) => [...prev, tempUserMessage]);
      setInput(''); // Clear input box

      // Step C: Start streaming
      setIsStreaming(true);
      setStreamingContent('');

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedText = '';
      let completedMessageId: string | null = null;

      await aiAssistantApiClient.streamMessage(
        targetConversationId,
        { content: text, clientRequestId },
        abortController.signal,
        (event) => {
          if (event.type === 'start') {
            // Stream initialized
          } else if (event.type === 'delta') {
            accumulatedText += event.text;
            setStreamingContent(accumulatedText);
          } else if (event.type === 'done') {
            completedMessageId = event.assistantMessageId;
          } else if (event.type === 'error') {
            setComposerError(event.message || 'Đã xảy ra sự cố khi tạo câu trả lời.');
          }
        }
      );

      // Step D: Stream finished cleanly
      setIsStreaming(false);
      abortControllerRef.current = null;

      if (accumulatedText) {
        setMessages((prev) => [
          ...prev,
          {
            id: completedMessageId || `asst-${Date.now()}`,
            conversation_id: targetConversationId!,
            role: 'assistant',
            content: accumulatedText,
            status: 'completed',
            sequence_number: prev.length + 1,
            model_code: null,
            input_tokens: 0,
            output_tokens: 0,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        ]);
      }
      setStreamingContent('');

      // Refresh conversations list to update title / timestamp
      loadConversations();
    } catch (err: any) {
      setIsCreatingConversation(false);
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;

      if (err instanceof AIAssistantApiError) {
        setComposerError(err.message);
      } else if (err?.name === 'AbortError') {
        // Normal user abort
      } else {
        setComposerError(err?.message || 'Không thể gửi câu hỏi tới Trợ lý AI.');
      }
    }
  };

  // 6. Retry last message
  const handleRetry = () => {
    if (lastFailedContentRef.current) {
      handleSendMessage(lastFailedContentRef.current);
    }
  };

  // 7. Rename conversation
  const handleSaveRename = async (conversationId: string, newTitle: string) => {
    const updated = await aiAssistantApiClient.updateConversation(conversationId, {
      title: newTitle,
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: updated.title } : c))
    );
  };

  // 8. Archive conversation
  const handleArchive = async (conversation: AIConversationEntity) => {
    try {
      const isArchived = conversation.status === 'archived';
      if (isArchived) {
        const updated = await aiAssistantApiClient.updateConversation(conversation.id, {
          status: 'active',
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, status: 'active' } : c))
        );
      } else {
        await aiAssistantApiClient.archiveConversation(conversation.id);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, status: 'archived' } : c))
        );
        if (activeConversationId === conversation.id) {
          handleNewChat();
        }
      }
    } catch (err: any) {
      setComposerError(err?.message || 'Không thể lưu trữ cuộc trò chuyện.');
    }
  };

  // 9. Delete conversation
  const handleDeleteConfirm = async (conversationId: string) => {
    await aiAssistantApiClient.deleteConversation(conversationId);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      handleNewChat();
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div
      id="ai-assistant-container"
      className="flex h-[calc(100vh-8.5rem)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      {/* 1. Left Sidebar (History & New Chat) */}
      <AIAssistantSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        isLoading={isLoadingConversations}
        error={conversationsError}
        canDelete={canDelete}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onRename={(c) => setRenameTarget(c)}
        onArchive={handleArchive}
        onDelete={(c) => setDeleteTarget(c)}
        onRetryLoad={loadConversations}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Right Chat Viewport */}
      <div className="flex flex-1 flex-col min-w-0 bg-slate-50/40">
        {/* Top Header of Chat Viewport */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile drawer toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Mở danh sách hội thoại"
              className="md:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Bot className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                {activeConversation ? activeConversation.title : 'Cuộc trò chuyện mới'}
              </h1>
              <p className="text-[10px] text-slate-400">
                {activeConversation?.status === 'archived'
                  ? 'Đã lưu trữ'
                  : 'Trợ lý AI nội bộ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sẵn sàng
            </span>
          </div>
        </div>

        {/* Global Messages Error if any */}
        {messagesError && (
          <div className="m-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{messagesError}</span>
            </div>
            <button
              type="button"
              onClick={() => activeConversationId && loadMessages(activeConversationId)}
              className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Message List */}
        <AIAssistantMessageList
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          isLoadingMessages={isLoadingMessages}
          onRetry={handleRetry}
          onSelectSuggestion={(sug) => {
            setInput(sug);
            handleSendMessage(sug);
          }}
        />

        {/* Composer Input Area */}
        <AIAssistantComposer
          input={input}
          isStreaming={isStreaming}
          isCreatingConversation={isCreatingConversation}
          error={composerError}
          onInputChange={(val) => setInput(val)}
          onSend={() => handleSendMessage()}
          onStop={handleStopStreaming}
        />
      </div>

      {/* Rename Dialog */}
      <RenameConversationModal
        isOpen={Boolean(renameTarget)}
        conversation={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={handleSaveRename}
      />

      {/* Delete Dialog */}
      <DeleteConversationModal
        isOpen={Boolean(deleteTarget)}
        conversation={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
