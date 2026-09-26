import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, AlertCircle, CheckCircle, Key } from 'lucide-react';
import { userService, UserManagementData, CreateUserData, UpdateUserData } from '../../../services/userService';
import { organizationService } from '../../../services/organizationService';
import { OrganizationUnit, SystemRole, MemberRole } from '../../../types/database';
import { useAuth } from '../../../context/AuthContext';
import { useAuthorization } from '../../../context/AuthorizationContext';

interface UserFormProps {
  userId: string | null;
  onBack: () => void;
}

const SYSTEM_ROLES: { value: SystemRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Quản trị hệ thống', desc: 'Toàn quyền cấu hình' },
  { value: 'executive', label: 'Ban giám hiệu', desc: 'Xem báo cáo toàn diện & Phê duyệt KPI' },
  { value: 'manager', label: 'Quản lý đơn vị', desc: 'Quản lý công việc & KPI đơn vị' },
  { value: 'staff', label: 'Nhân viên', desc: 'Báo cáo chỉ số & Thực hiện công việc' },
  { value: 'viewer', label: 'Chỉ xem', desc: 'Chỉ xem dữ liệu được phân quyền' },
];

const MEMBER_ROLES: { value: MemberRole; label: string }[] = [
  { value: 'head', label: 'Trưởng đơn vị' },
  { value: 'deputy', label: 'Phó đơn vị' },
  { value: 'head', label: 'Tổ trưởng' },
  { value: 'member', label: 'Thành viên' },
  { value: 'viewer', label: 'Chỉ xem' },
];

const formatUserErrorMessage = (rawError?: string | null): string => {
  if (!rawError) return 'Đã xảy ra lỗi không xác định.';
  if (rawError.includes('organization_members_member_role_check') || rawError.includes('member_role')) {
    return 'Vai trò tại đơn vị không hợp lệ. Vui lòng chọn Trưởng đơn vị, Phó đơn vị, Tổ trưởng hoặc Thành viên.';
  }
  if (rawError.includes('organization_members_organization_unit_id_fkey') || rawError.includes('organization_unit_id')) {
    return 'Đơn vị phòng ban được chọn không tồn tại hoặc không hợp lệ.';
  }
  if (rawError.includes('profiles_email_key') || rawError.includes('User already registered') || rawError.includes('email already')) {
    return 'Email này đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.';
  }
  if (rawError.includes('violates check constraint') || rawError.includes('check constraint')) {
    return 'Dữ liệu không thỏa mãn điều kiện hợp lệ của hệ thống. Vui lòng kiểm tra lại.';
  }
  return rawError;
};

export const UserForm: React.FC<UserFormProps> = ({ userId, onBack }) => {
  const { user: currentUser } = useAuth();
  const { hasCapability } = useAuthorization();
  const isEdit = Boolean(userId);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [units, setUnits] = useState<OrganizationUnit[]>([]);

  // Form State
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [systemRole, setSystemRole] = useState<SystemRole>('staff');
  const [isActive, setIsActive] = useState(true);
  const [orgUnitId, setOrgUnitId] = useState('');
  const [memberRole, setMemberRole] = useState<MemberRole>('member');

  // Functional Roles State
  const [functionalRoles, setFunctionalRoles] = useState<any[]>([]);
  const [selectedFunctionalRoleIds, setSelectedFunctionalRoleIds] = useState<string[]>([]);
  const [savingFunctionalRoles, setSavingFunctionalRoles] = useState(false);
  const [functionalRolesSuccess, setFunctionalRolesSuccess] = useState<string | null>(null);
  const [functionalRolesError, setFunctionalRolesError] = useState<string | null>(null);

  // Effective Permissions State
  const [effectiveData, setEffectiveData] = useState<any>(null);
  const [loadingEffective, setLoadingEffective] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'effective'>('info');

  // Reset password states
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const unitsRes = await organizationService.getUnits(true);
      setUnits(unitsRes);

      if (hasCapability('access_control.roles.view')) {
        const allFuncRoles = await userService.getFunctionalRoles();
        setFunctionalRoles(allFuncRoles);
      } else {
        setFunctionalRoles([]);
      }

      if (isEdit && userId) {
        const user = await userService.getUserById(userId);
        if (!user) throw new Error('Không tìm thấy thông tin người dùng');
        
        setEmail(user.email);
        setFullName(user.full_name);
        setEmployeeCode(user.employee_code || '');
        setJobTitle(user.job_title || '');
        setSystemRole(user.system_role);
        setIsActive(user.is_active);
        
        if (user.primary_unit) {
          setOrgUnitId(user.primary_unit.id);
          setMemberRole(user.member_role || 'member');
        }

        const userFuncRoles = await userService.getUserFunctionalRoles(userId);
        setSelectedFunctionalRoleIds(userFuncRoles.map((ur: any) => ur.role_id));

        try {
          const eff = await userService.getEffectivePermissions(userId);
          setEffectiveData(eff);
        } catch (effErr) {
          console.warn('Failed to load effective permissions:', effErr);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFunctionalRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSavingFunctionalRoles(true);
    setFunctionalRolesError(null);
    setFunctionalRolesSuccess(null);
    const res = await userService.updateUserFunctionalRoles(userId, selectedFunctionalRoleIds);
    setSavingFunctionalRoles(false);
    if (!res.success) {
      setFunctionalRolesError(res.error || 'Lỗi cập nhật vai trò chức năng');
    } else {
      setFunctionalRolesSuccess('Đã cập nhật vai trò chức năng thành công.');
      // Reload user functional roles and effective permissions immediately
      try {
        const userFuncRoles = await userService.getUserFunctionalRoles(userId);
        setSelectedFunctionalRoleIds(userFuncRoles.map((ur: any) => ur.role_id));
        const eff = await userService.getEffectivePermissions(userId);
        setEffectiveData(eff);
      } catch (err) {
        console.warn('Failed to refresh data after save:', err);
      }
      setTimeout(() => setFunctionalRolesSuccess(null), 4000);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    if (newPassword.length < 8) {
      setResetError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setResetting(true);
    setResetError(null);

    try {
      const res = await userService.resetUserPassword(userId, newPassword);
      if (!res.success) {
        setResetError(res.error || 'Lỗi đặt lại mật khẩu.');
      } else {
        setShowResetModal(false);
        setSuccess('Đặt lại mật khẩu thành công.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setResetError(formatUserErrorMessage(err.message || 'Lỗi mạng khi kết nối máy chủ.'));
    } finally {
      setNewPassword('');
      setConfirmPassword('');
      setResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEdit) {
        if (!userId) throw new Error('Thiếu ID người dùng');
        const updateData: UpdateUserData = {
          full_name: fullName,
          employee_code: employeeCode || undefined,
          job_title: jobTitle || undefined,
          system_role: systemRole,
          is_active: isActive,
          organization_unit_id: orgUnitId || undefined,
          member_role: orgUnitId ? memberRole : undefined,
        };
        const res = await userService.updateUser(userId, updateData);
        if (!res.success) throw new Error(formatUserErrorMessage(res.error));
        setSuccess('Đã cập nhật thông tin người dùng thành công.');
      } else {
        if (!temporaryPassword) throw new Error('Vui lòng nhập mật khẩu tạm thời');
        const createData: CreateUserData = {
          email,
          temporary_password: temporaryPassword,
          full_name: fullName,
          employee_code: employeeCode || undefined,
          job_title: jobTitle || undefined,
          system_role: systemRole,
          is_active: isActive,
          organization_unit_id: orgUnitId || undefined,
          member_role: orgUnitId ? memberRole : undefined,
        };
        const res = await userService.createUser(createData);
        if (!res.success) throw new Error(formatUserErrorMessage(res.error));
        setSuccess('Đã tạo người dùng mới thành công.');
        // Reset form for new creation or navigate back
        setTimeout(() => {
          onBack();
        }, 1500);
      }
    } catch (err: any) {
      setError(formatUserErrorMessage(err.message || 'Lỗi khi lưu dữ liệu'));
    } finally {
      // Xóa password khỏi state sau khi request hoàn tất hoặc thất bại
      setTemporaryPassword('');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Sửa thông tin Người dùng' : 'Thêm Người dùng mới'}
          </h2>
          <p className="text-xs text-slate-500">
            {isEdit ? `Chỉnh sửa hồ sơ và phân quyền của ${fullName}` : 'Tạo tài khoản và phân quyền truy cập hệ thống'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {isEdit && (
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Thông tin & Phân vai trò
          </button>
          <button
            type="button"
            onClick={async () => {
              setActiveTab('effective');
              if (userId) {
                setLoadingEffective(true);
                try {
                  const eff = await userService.getEffectivePermissions(userId);
                  setEffectiveData(eff);
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setLoadingEffective(false);
                }
              }
            }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'effective' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Quyền hiệu lực & Nguồn cấp (C4.5-D)
          </button>
        </div>
      )}

      {activeTab === 'effective' && (
        <div className="space-y-6">
          {loadingEffective ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
          ) : effectiveData ? (
            <div className="space-y-6">
              {effectiveData.warnings && effectiveData.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Cảnh báo phân quyền hệ thống:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-xs">
                    {effectiveData.warnings.map((w: string, idx: number) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Vai trò nền (Baseline System Role)</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      {effectiveData.baseline_role?.code || 'none'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="h-3 w-3" /> Đang hiệu lực
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Quyết định cấp quản lý nền và phạm vi dữ liệu mặc định trong profiles.system_role.</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Vai trò chức năng được gán</h3>
                  {effectiveData.functional_roles && effectiveData.functional_roles.length > 0 ? (
                    <div className="space-y-2">
                      {effectiveData.functional_roles.map((fr: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg text-xs">
                          <div>
                            <span className="font-semibold text-slate-900">{fr.code}</span>
                            <span className="text-slate-500 ml-2">({fr.name})</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-medium ${fr.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {fr.status === 'active' ? 'Đang hiệu lực' : 'Đã thu hồi'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Chưa được gán vai trò chức năng nào.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Danh sách Capability hiệu lực & Nguồn cấp</h3>
                    <p className="text-xs text-slate-500">Hợp các quyền từ tất cả vai trò đang hoạt động (Đã loại bỏ trùng lặp)</p>
                  </div>
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    Tổng: {effectiveData.effective_capabilities?.length || 0} quyền hiệu lực
                  </span>
                </div>

                {effectiveData.effective_capabilities && effectiveData.effective_capabilities.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                        <tr>
                          <th className="py-3 px-4">Module</th>
                          <th className="py-3 px-4">Capability Code</th>
                          <th className="py-3 px-4">Mô tả / Hành động</th>
                          <th className="py-3 px-4">Phạm vi dữ liệu (Scope)</th>
                          <th className="py-3 px-4">Nguồn cấp (Granting Roles)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {effectiveData.effective_capabilities.map((cap: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-900">{cap.module_name || cap.module_code}</td>
                            <td className="py-3 px-4 font-mono font-semibold text-indigo-600">{cap.capability_code}</td>
                            <td className="py-3 px-4 text-slate-600">
                              <div>{cap.permission_name}</div>
                              {cap.permission_description && <div className="text-[11px] text-slate-400">{cap.permission_description}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                                {cap.effective_scope_vietnamese} <span className="text-[10px] font-mono ml-1 opacity-70">({cap.effective_scope})</span>
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                {cap.sources.map((src: any, sIdx: number) => (
                                  <div key={sIdx} className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${src.role_type === 'base' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                                      {src.role_type === 'base' ? 'Nền' : 'Chức năng'}
                                    </span>
                                    <span className="font-mono text-slate-800">{src.role_code}</span>
                                    <span className="text-slate-400 text-[11px]">({src.scope_vietnamese})</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    Không có capability hiệu lực nào cho tài khoản này.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">Không thể tải dữ liệu quyền hiệu lực.</div>
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cột 1: Thông tin cá nhân */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Thông tin Cá nhân & Đăng nhập</h3>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                placeholder="Nhập họ tên đầy đủ"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email đăng nhập <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                disabled={isEdit} // Không cho sửa email nếu edit (Auth liên kết chặt chẽ)
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="user@school.edu.vn"
              />
              {isEdit && <p className="text-[11px] text-slate-400 mt-1">Không thể thay đổi email sau khi tạo tài khoản.</p>}
            </div>

            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mật khẩu tạm thời <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required={!isEdit}
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                  placeholder="Mật khẩu ban đầu"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mã NV / Cán bộ</label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chức danh / Chuyên môn</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="is_active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                Tài khoản đang hoạt động (Cho phép đăng nhập)
              </label>
            </div>
          </div>

          {/* Cột 2: Phân quyền */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Phân quyền Hệ thống & Đơn vị</h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Quyền hệ thống <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {SYSTEM_ROLES.map((role) => (
                  <label key={role.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${systemRole === role.value ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="system_role"
                      value={role.value}
                      checked={systemRole === role.value}
                      onChange={() => setSystemRole(role.value as SystemRole)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{role.label}</span>
                      <span className="text-[11px] text-slate-500">{role.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Đơn vị trực thuộc chính
              </label>
              <select
                value={orgUnitId}
                onChange={(e) => setOrgUnitId(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 pl-3 pr-8 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
              >
                <option value="">-- Chọn đơn vị (Tùy chọn) --</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {orgUnitId && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vai trò tại đơn vị
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as MemberRole)}
                  className="block w-full rounded-lg border-0 py-2 pl-3 pr-8 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                >
                  {MEMBER_ROLES.map((r, idx) => (
                    <option key={`${r.value}-${idx}`} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {isEdit && currentUser?.id !== userId && (
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Key className="h-4 w-4" />
                Đặt lại mật khẩu
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              disabled={saving}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </div>
      </form>

      {/* Quản lý Vai trò Chức năng (Multi-role) */}
      {isEdit && userId && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Quản lý Vai trò Chức năng (Multi-role)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gán hoặc thu hồi các vai trò chức năng để cấp quyền sử dụng từng module mà không ảnh hưởng đến vai trò nền.
              </p>
            </div>
          </div>

          {functionalRolesError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200 text-sm text-red-600">
              {functionalRolesError}
            </div>
          )}

          {functionalRolesSuccess && (
            <div className="mb-4 rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-700">
              {functionalRolesSuccess}
            </div>
          )}

          <form onSubmit={handleSaveFunctionalRoles} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {functionalRoles.length === 0 ? (
                <p className="text-sm text-slate-500 italic col-span-full">Chưa có vai trò chức năng nào được cấu hình trong hệ thống.</p>
              ) : (
                functionalRoles.map((role) => {
                  const isChecked = selectedFunctionalRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked ? 'border-indigo-600 bg-indigo-50/50 shadow-xs' : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFunctionalRoleIds([...selectedFunctionalRoleIds, role.id]);
                          } else {
                            setSelectedFunctionalRoleIds(selectedFunctionalRoleIds.filter(id => id !== role.id));
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{role.name}</span>
                        <span className="text-xs font-mono text-slate-500">{role.code}</span>
                        {role.description && <span className="text-[11px] text-slate-600 mt-1">{role.description}</span>}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingFunctionalRoles}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {savingFunctionalRoles ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Cập nhật vai trò chức năng
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Đặt lại mật khẩu</h3>
            <p className="mt-1 text-sm text-slate-500 mb-6">
              Bạn đang đặt lại mật khẩu cho tài khoản <strong>{fullName}</strong>. Mật khẩu mới cần ít nhất 8 ký tự.
            </p>

            {resetError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200 text-sm text-red-600">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
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
                  placeholder="Nhập mật khẩu mới"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Xác nhận mật khẩu <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-lg border-0 py-2 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {resetting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang xử lý...
                    </>
                  ) : (
                    'Lưu mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
