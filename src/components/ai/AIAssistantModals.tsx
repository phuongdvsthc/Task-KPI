/**
 * Modals for AI Assistant
 * - Rename conversation dialog
 * - Delete conversation confirmation dialog
 */

import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { AIConversationEntity } from '../../services/ai/conversation/conversation.types';

interface RenameModalProps {
  isOpen: boolean;
  conversation: AIConversationEntity | null;
  onClose: () => void;
  onSave: (conversationId: string, newTitle: string) => Promise<void>;
}

export const RenameConversationModal: React.FC<RenameModalProps> = ({
  isOpen,
  conversation,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title || '');
      setError(null);
    }
  }, [conversation]);

  if (!isOpen || !conversation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Tiêu đề cuộc trò chuyện không được để trống.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(conversation.id, cleanTitle);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể đổi tên cuộc trò chuyện.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Đổi tên cuộc trò chuyện</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="convo-title" className="block text-xs font-medium text-slate-700 mb-1">
              Tiêu đề mới
            </label>
            <input
              id="convo-title"
              type="text"
              value={title}
              disabled={isSubmitting}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              maxLength={200}
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteModalProps {
  isOpen: boolean;
  conversation: AIConversationEntity | null;
  onClose: () => void;
  onConfirm: (conversationId: string) => Promise<void>;
}

export const DeleteConversationModal: React.FC<DeleteModalProps> = ({
  isOpen,
  conversation,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !conversation) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm(conversation.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể xóa cuộc trò chuyện.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
          <AlertTriangle className="h-6 w-6 stroke-[1.75]" />
        </div>

        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-900">Xóa cuộc trò chuyện?</h3>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Bạn có chắc muốn xóa cuộc trò chuyện này? Lịch sử trong cuộc trò chuyện sẽ không còn hiển thị.
          </p>
          <p className="mt-1 font-medium text-xs text-slate-700 bg-slate-50 rounded-lg p-2 border border-slate-100 truncate">
            &quot;{conversation.title}&quot;
          </p>
        </div>

        {error && <p className="mt-3 text-xs text-center text-rose-600 font-medium">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-medium text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
