/**
 * Supabase Connection Configuration Modal
 * Cho phép người dùng nhập Supabase Project URL và Anon Key,
 * đồng thời kiểm tra trực tiếp kết nối và API Key thật tới cơ sở dữ liệu.
 */
import React, { useState } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Globe, Loader2, PlayCircle } from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
  ConnectionTestResult,
} from '../../services/supabaseClient';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setStatusMessage(null);
    setTestResult(null);

    if (!url.trim() || !anonKey.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Vui lòng nhập cả Supabase URL và Anon Key trước khi kiểm tra.',
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await testSupabaseConnection(url, anonKey);
      setTestResult(result);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Kết nối thành công! ${result.message}`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({
        type: 'error',
        text: `Lỗi khi kiểm tra kết nối: ${msg}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Vui lòng điền đầy đủ Supabase URL và Anon Public Key.',
      });
      return;
    }

    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      setStatusMessage({
        type: 'error',
        text: 'Supabase URL phải bắt đầu bằng https:// (ví dụ: https://xyzcompany.supabase.co)',
      });
      return;
    }

    saveSupabaseConfig(url, anonKey);
    setStatusMessage({
      type: 'success',
      text: 'Đã lưu cấu hình kết nối Supabase thành công! Hệ thống đang sử dụng cấu hình mới.',
    });

    if (onConfigSaved) {
      onConfigSaved();
    }
  };

  const handleReset = () => {
    clearCustomSupabaseConfig();
    const fresh = getSupabaseConfig();
    setUrl(fresh.url);
    setAnonKey(fresh.anonKey);
    setTestResult(null);
    setStatusMessage({
      type: 'success',
      text: 'Đã hoàn tác về cấu hình biến môi trường mặc định.',
    });
    if (onConfigSaved) {
      onConfigSaved();
    }
  };

  return (
    <div id="supabase-config-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div id="supabase-config-modal-card" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Cấu Hình Kết Nối Supabase PostgreSQL
              </h3>
              <p className="text-[11px] text-slate-400">
                Thiết lập URL dự án và Anon Public API Key
              </p>
            </div>
          </div>
          <button
            id="close-config-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-400 leading-relaxed">
            Hệ thống kết nối trực tiếp với cơ sở dữ liệu Supabase của bạn. Thông tin được lưu cục bộ trên trình duyệt để gọi REST và Supabase Auth an toàn.
          </div>

          {statusMessage && (
            <div
              id="config-status-alert"
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
                statusMessage.type === 'success'
                  ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-red-800/60 bg-red-950/40 text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="flex-1">
                <span>{statusMessage.text}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Supabase Project URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                id="input-supabase-url"
                type="text"
                required
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Anon Public API Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                id="input-supabase-anon-key"
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Test connection action */}
          <div className="pt-1">
            <button
              type="button"
              id="test-supabase-connection-btn"
              disabled={isTesting}
              onClick={handleTestConnection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/30 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/40 hover:border-indigo-500/60 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Đang kiểm tra kết nối Supabase...</span>
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 text-indigo-400" />
                  <span>Kiểm tra kết nối thực tế (Test Connection)</span>
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
            <button
              type="button"
              id="reset-config-btn"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Khôi phục mặc định
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="cancel-config-btn"
                onClick={onClose}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Đóng
              </button>
              <button
                type="submit"
                id="save-config-btn"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
