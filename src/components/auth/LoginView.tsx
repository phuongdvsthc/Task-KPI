/**
 * Login View
 * Đăng nhập an toàn bằng email/password qua Supabase Auth
 */
import React, { useState } from 'react';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  SlidersHorizontal,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { systemSettingsService } from '../../services/system-settings.service';
import { SupabaseConfigModal } from '../config/SupabaseConfigModal';

export const LoginView: React.FC = () => {
  const { signIn, isConfigured, isLoading } = useAuth();
  const { settings } = useSystemSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setFormError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(cleanEmail, password);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Đăng nhập không thành công.');
    } else {
      // Safe Return URL handling (prevent open redirect vulnerabilities)
      try {
        const currentHash = window.location.hash || '';
        const returnUrlMatch = currentHash.match(/returnUrl=([^&]+)/);
        if (returnUrlMatch && returnUrlMatch[1]) {
          const rawUrl = decodeURIComponent(returnUrlMatch[1]);
          // Strict validation: must not contain protocol or domain
          if (!rawUrl.includes('://') && !rawUrl.startsWith('//')) {
            const cleanPath = rawUrl.replace(/^#\/?/, '').replace(/^\//, '');
            if (cleanPath && !cleanPath.includes('login')) {
              window.location.hash = `#/${cleanPath}`;
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to parse returnUrl safely:', err);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            {settings?.logoPath ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg p-1 overflow-hidden">
                <img src={systemSettingsService.getSystemAssetPublicUrl(settings.logoPath)} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <GraduationCap className="h-7 w-7" />
              </div>
            )}
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {settings?.appName || 'School Task & KPI'}
              </h1>
              <p className="text-xs text-indigo-400">
                {settings?.organizationName || 'Nền tảng Quản lý Hiệu suất'}
              </p>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Đăng nhập hệ thống
          </h2>
          <p className="text-sm text-slate-400">
            Nhập tài khoản email và mật khẩu được cấp
          </p>
        </div>

        {/* Supabase Status Banner */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm shadow-inner">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConfigured
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {isConfigured ? 'Supabase: Đã kết nối' : 'Supabase: Chưa kết nối'}
            </span>
          </div>
          <button
            type="button"
            id="open-config-btn-login"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Cài đặt</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-slate-950/50 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
          {formError && (
            <div
              id="login-error-banner"
              className="flex items-start gap-2.5 rounded-xl border border-red-900/50 bg-red-950/50 p-4 text-sm text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Đăng nhập thất bại</p>
                <p className="mt-1 text-red-300 leading-relaxed text-xs">{formError}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="input-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@truonghoc.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="input-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer mt-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang kết nối Supabase Auth...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-5 w-5" />
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="h-5 w-5 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
};
