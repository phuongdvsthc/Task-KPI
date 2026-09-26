/**
 * User Profile Modal / Drawer
 * Hiển thị chi tiết thông tin hồ sơ cán bộ/giảng viên từ bảng profiles và các đơn vị phụ trách
 */
import React, { useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Briefcase, 
  Building2, 
  Calendar,
  CheckCircle2,
  Key,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_DISPLAY_NAMES: Record<string, { label: string; bg: string; text: string }> = {
  admin: { label: 'Quản trị viên (Admin)', bg: 'bg-red-50 border-red-200', text: 'text-red-800' },
  executive: { label: 'Ban giám hiệu (Executive)', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800' },
  manager: { label: 'Trưởng/Phó đơn vị (Manager)', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
  staff: { label: 'Cán bộ / Giảng viên (Staff)', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
  viewer: { label: 'Người xem (Viewer)', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
  none: { label: 'Chưa có phân quyền trong database', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, user, primaryUnit, allUnits, systemRole } = useAuth();
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const roleMeta = systemRole ? (ROLE_DISPLAY_NAMES[systemRole] || ROLE_DISPLAY_NAMES.staff) : ROLE_DISPLAY_NAMES.none;

  const handleClose = () => {
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    onClose();
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    const res = await userService.changeOwnPassword(newPassword);
    if (!res.success) {
      setPasswordError(res.error || 'Lỗi đổi mật khẩu.');
    } else {
      setPasswordSuccess('Đổi mật khẩu thành công.');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsSaving(false);
  };

  return (
    <div id="user-profile-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div 
        id="user-profile-modal-card" 
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            {isChangingPassword ? (
               <button onClick={() => setIsChangingPassword(false)} className="mr-2 text-slate-500 hover:text-slate-700">
                 <ArrowLeft className="h-5 w-5" />
               </button>
            ) : (
               <User className="h-5 w-5 text-indigo-900" />
            )}
            <h3 className="text-base font-semibold text-slate-900">
              {isChangingPassword ? 'Bảo mật tài khoản' : 'Hồ Sơ Cán Bộ & Phân Quyền'}
            </h3>
          </div>
          <button
            id="close-profile-modal-btn"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isChangingPassword ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Hãy đặt mật khẩu mạnh để bảo vệ tài khoản của bạn.
              </p>

              {passwordError && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-sm text-red-600">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-700">
                  {passwordSuccess}
                </div>
              )}

              <form onSubmit={handleSubmitPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                    placeholder="Mật khẩu mới"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                    placeholder="Xác nhận mật khẩu mới"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Đang lưu...
                      </>
                    ) : (
                      'Đổi mật khẩu'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Avatar & Key Profile Info */}
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-indigo-900 text-xl font-bold text-white shadow-xs">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-lg font-bold text-slate-900">
                      {profile?.full_name || 'Chưa cập nhật tên'}
                    </h4>
                    {profile?.is_active && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Đang hoạt động
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mã cán bộ: <span className="font-mono font-medium text-slate-700">{profile?.employee_code || 'N/A'}</span>
                  </p>
                  <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${roleMeta.bg} ${roleMeta.text}`}>
                    <Shield className="h-3.5 w-3.5" />
                    {roleMeta.label}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> Email hệ thống
                  </span>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {profile?.email || user?.email || 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Số điện thoại
                  </span>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {profile?.phone || 'Chưa cập nhật'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" /> Chức danh công việc
                  </span>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {profile?.job_title || 'Cán bộ'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Ngày tạo hồ sơ
                  </span>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Organization Units Membership */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <Building2 className="h-4 w-4 text-indigo-700" /> Đơn vị trực thuộc
                  </span>
                  <span className="text-xs text-slate-400">
                    {allUnits.length} đơn vị
                  </span>
                </div>

                {allUnits.length > 0 ? (
                  <div className="space-y-2">
                    {allUnits.map((u) => {
                      const isPrimary = u.id === primaryUnit?.id;
                      return (
                        <div
                          key={u.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                            isPrimary
                              ? 'border-indigo-200 bg-indigo-50/50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{u.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-slate-500">[{u.code}]</span>
                          </div>
                          {isPrimary && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                              Đơn vị chính
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
                    Chưa gán đơn vị phòng ban cụ thể trong bảng organization_members
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 shrink-0">
          <div>
            {!isChangingPassword && (
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Key className="h-4 w-4" />
                Bảo mật & Mật khẩu
              </button>
            )}
          </div>
          <button
            id="close-profile-btn"
            onClick={handleClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
