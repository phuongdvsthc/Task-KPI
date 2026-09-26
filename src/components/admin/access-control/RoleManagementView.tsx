import React, { useState, useEffect, useCallback } from 'react';
import { useAuthorization } from '../../../context/AuthorizationContext';
import { useAuth } from '../../../context/AuthContext';
import { accessControlApiClient, AccessRole } from '../../../services/accessControlApiClient';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { Shield, Users } from 'lucide-react';

export const RoleManagementView: React.FC = () => {
  const { can, scopeOf, permissions, isLoading: isAuthLoading, isReady } = useAuthorization();
  const { user } = useAuth();
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<AccessRole | null>(null);
  const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(false);
  const [isMatrixDirty, setIsMatrixDirty] = useState<boolean>(false);

  // Runtime diagnostics in DEV mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      const rolesViewScope = scopeOf('access_control.roles.view');
      const rolesViewCan = can('access_control.roles.view');
      let denyReason: string | null = null;
      if (!rolesViewCan) {
        if (!user) denyReason = 'auth_user_missing';
        else if (!isReady) denyReason = 'authorization_not_ready';
        else if (isAuthLoading) denyReason = 'authorization_loading';
        else if (rolesViewScope === null) denyReason = 'roles_view_permission_missing_from_map';
        else denyReason = 'scope_insufficient';
      }

      console.log('[RoleManagementView Diagnostic]', {
        auth_user_present: !!user,
        authorization_ready: isReady,
        authorization_loading: isAuthLoading,
        raw_permission_keys_count: Object.keys(permissions || {}).length,
        permission_response_shape: typeof permissions === 'object' && permissions !== null,
        roles_view_present: rolesViewScope !== null,
        roles_view_scope: rolesViewScope,
        roles_view_can: rolesViewCan,
        deny_or_fallback_reason: denyReason
      });
    }
  }, [user, isReady, isAuthLoading, permissions, can, scopeOf]);

  const fetchRoles = useCallback(async () => {
    if (!isReady || isAuthLoading || !can('access_control.roles.view')) return;

    try {
      setIsLoadingRoles(true);
      const data = await accessControlApiClient.getRoles();
      setRoles(data);
      if (data.length > 0 && !selectedRole) {
        setSelectedRole(data[0]);
      }
    } catch (e) {
      console.error('[RoleManagementView] Error fetching roles:', e);
    } finally {
      setIsLoadingRoles(false);
    }
  }, [isReady, isAuthLoading, can, selectedRole]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSelectRole = (role: AccessRole) => {
    if (selectedRole?.id === role.id) return;
    if (isMatrixDirty) {
      const confirmLeave = window.confirm(
        'Bạn có thay đổi chưa lưu trong ma trận quyền. Bạn có chắc chắn muốn bỏ thay đổi và chuyển sang vai trò khác?'
      );
      if (!confirmLeave) return;
    }
    setIsMatrixDirty(false);
    setSelectedRole(role);
  };

  if (!isReady || isAuthLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500 min-h-[300px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
          <div className="text-sm font-medium">Đang tải thông tin phân quyền...</div>
        </div>
      </div>
    );
  }

  if (!can('access_control.roles.view')) {
    return (
      <div className="p-8 text-center text-slate-600 bg-slate-50 rounded-xl m-6 border border-slate-200">
        Bạn không có quyền xem trang này.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vai trò và phân quyền</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý quyền truy cập chức năng và phạm vi dữ liệu cho các vai trò trong hệ thống.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-xs border border-slate-200 self-start">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
            <Users className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Danh sách vai trò ({roles.length})
            </h2>
          </div>

          {isLoadingRoles ? (
            <div className="text-xs text-slate-400 py-6 text-center">Đang tải vai trò...</div>
          ) : roles.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">Không có vai trò nào</div>
          ) : (
            <div className="space-y-1">
              {roles.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <button
                    key={role.id}
                    id={`role-item-${role.code}`}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-xs font-medium'
                        : 'border-transparent hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{role.name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {role.code}
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {role.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Matrix Container */}
        <div className="lg:col-span-3">
          {selectedRole ? (
            <RolePermissionMatrix
              key={selectedRole.id}
              roleId={selectedRole.id}
              roleName={selectedRole.name}
              roleCode={selectedRole.code}
              onDirtyChange={setIsMatrixDirty}
            />
          ) : (
            <div className="bg-white p-12 rounded-xl shadow-xs border border-slate-200 text-center text-slate-500">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Chọn vai trò để chỉnh sửa ma trận quyền</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
