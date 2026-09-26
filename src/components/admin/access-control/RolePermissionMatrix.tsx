import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthorization } from '../../../context/AuthorizationContext';
import {
  accessControlApiClient,
  AccessModule,
  AccessPermission,
  AccessRolePermission
} from '../../../services/accessControlApiClient';
import { ScopeCode } from '../../../types/authorization';
import {
  Check,
  RotateCcw,
  Save,
  Search,
  Shield,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';

interface RolePermissionMatrixProps {
  roleId: string;
  roleName?: string;
  roleCode?: string;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface PermissionStateItem {
  permissionId: string;
  code: string;
  name: string;
  description: string;
  moduleId: string;
  supportsDataScope: boolean;
  granted: boolean;
  scopeCode: ScopeCode;
}

const SCOPE_OPTIONS: { value: ScopeCode; label: string; desc: string }[] = [
  { value: 'own', label: 'Cá nhân (own)', desc: 'Chỉ xem/sửa dữ liệu do chính mình tạo' },
  { value: 'unit', label: 'Đơn vị (unit)', desc: 'Xem/sửa dữ liệu trong đơn vị trực tiếp' },
  { value: 'unit_tree', label: 'Cây đơn vị (unit_tree)', desc: 'Xem/sửa dữ liệu đơn vị và các đơn vị con' },
  { value: 'all', label: 'Toàn trường (all)', desc: 'Truy cập toàn bộ dữ liệu hệ thống' },
];

export const RolePermissionMatrix: React.FC<RolePermissionMatrixProps> = ({
  roleId,
  roleName,
  roleCode,
  onDirtyChange
}) => {
  const { can, refreshPermissions } = useAuthorization();

  // Capability check strictly using authorization engine:
  const canManage = can('access_control.permissions.manage');

  const [modules, setModules] = useState<AccessModule[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<AccessPermission[]>([]);
  const [initialGrants, setInitialGrants] = useState<Record<string, { granted: boolean; scopeCode: ScopeCode }>>({});
  const [currentGrants, setCurrentGrants] = useState<Record<string, { granted: boolean; scopeCode: ScopeCode }>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (Object.keys(initialGrants).length === 0 && Object.keys(currentGrants).length === 0) {
      return false;
    }
    for (const permId of Object.keys(currentGrants)) {
      const current = currentGrants[permId];
      const initial = initialGrants[permId] || { granted: false, scopeCode: 'none' };
      if (current.granted !== initial.granted) {
        return true;
      }
      if (current.granted && current.scopeCode !== initial.scopeCode) {
        return true;
      }
    }
    return false;
  }, [initialGrants, currentGrants]);

  // Sync dirty state to parent
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Load catalog & grants
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Parallel fetch of catalog (modules, permissions) and role-specific grants
      const [modulesData, catalogData, roleGrantsData] = await Promise.all([
        accessControlApiClient.getModules(),
        accessControlApiClient.getPermissions(),
        accessControlApiClient.getRolePermissions(roleId)
      ]);

      // Sort modules
      const sortedModules = [...modulesData].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setModules(sortedModules);
      setPermissionsCatalog(catalogData);

      // Build grant lookup
      const grantLookup: Record<string, ScopeCode> = {};
      roleGrantsData.forEach((rg) => {
        grantLookup[rg.permission_id] = rg.scope_code;
      });

      // Construct initial and current grants map
      const grantsMap: Record<string, { granted: boolean; scopeCode: ScopeCode }> = {};
      catalogData.forEach((p) => {
        const isGranted = Boolean(grantLookup[p.id]);
        const scope = isGranted ? grantLookup[p.id] : (p.supports_data_scope ? 'own' : 'none');
        grantsMap[p.id] = {
          granted: isGranted,
          scopeCode: scope
        };
      });

      setInitialGrants(grantsMap);
      setCurrentGrants(grantsMap);
    } catch (err: any) {
      console.error('[RolePermissionMatrix] Error loading role permissions:', err);
      setErrorMessage(err.message || 'Không thể tải danh sách quyền cho vai trò.');
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadData();
    setSuccessMessage(null);
  }, [loadData]);

  // Toggle permission
  const handleTogglePermission = (permissionId: string) => {
    if (!canManage) return;

    setCurrentGrants((prev) => {
      const current = prev[permissionId] || { granted: false, scopeCode: 'none' };
      const permMeta = permissionsCatalog.find((p) => p.id === permissionId);
      const nextGranted = !current.granted;

      let nextScope = current.scopeCode;
      if (nextGranted && permMeta?.supports_data_scope) {
        // If enabling a data-scoped permission that was 'none', default to 'own'
        if (nextScope === 'none') {
          nextScope = 'own';
        }
      } else if (!permMeta?.supports_data_scope) {
        nextScope = 'none';
      }

      return {
        ...prev,
        [permissionId]: {
          granted: nextGranted,
          scopeCode: nextScope
        }
      };
    });
    setSuccessMessage(null);
  };

  // Change scope
  const handleChangeScope = (permissionId: string, newScope: ScopeCode) => {
    if (!canManage) return;

    setCurrentGrants((prev) => {
      const current = prev[permissionId] || { granted: true, scopeCode: 'own' };
      return {
        ...prev,
        [permissionId]: {
          ...current,
          scopeCode: newScope
        }
      };
    });
    setSuccessMessage(null);
  };

  // Bulk toggle for a module
  const handleToggleAllInModule = (moduleId: string, enable: boolean) => {
    if (!canManage) return;

    const modulePerms = permissionsCatalog.filter((p) => p.module_id === moduleId);
    setCurrentGrants((prev) => {
      const updated = { ...prev };
      modulePerms.forEach((p) => {
        const current = updated[p.id] || { granted: false, scopeCode: 'none' };
        const scope = p.supports_data_scope
          ? (current.scopeCode === 'none' ? 'own' : current.scopeCode)
          : 'none';
        updated[p.id] = {
          granted: enable,
          scopeCode: scope
        };
      });
      return updated;
    });
    setSuccessMessage(null);
  };

  // Reset to initial
  const handleReset = () => {
    setCurrentGrants(initialGrants);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Save changes
  const handleSave = async () => {
    if (!canManage || !isDirty || isSaving) return;

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // Build payload according to contract:
      // Only include granted permissions
      // If supports_data_scope: send valid scope_code ('own' | 'unit' | 'unit_tree' | 'all')
      // If not supports_data_scope: send 'none'
      const payloadPermissions: { permission_id: string; scope_code: ScopeCode }[] = [];

      for (const [permId, item] of Object.entries(currentGrants)) {
        if (item.granted) {
          const permMeta = permissionsCatalog.find((p) => p.id === permId);
          const scope = permMeta?.supports_data_scope ? item.scopeCode : 'none';
          payloadPermissions.push({
            permission_id: permId,
            scope_code: scope
          });
        }
      }

      const res = await accessControlApiClient.updateRolePermissions(roleId, payloadPermissions);

      if (!res.ok) {
        setErrorMessage(res.error || 'Không thể cập nhật phân quyền.');
        return;
      }

      // Step 1: Success message
      setSuccessMessage('Đã lưu phân quyền vai trò thành công.');

      // Step 2 & 3: Refetch and rebuild state from backend response
      const updatedGrantsData = await accessControlApiClient.getRolePermissions(roleId);
      const grantLookup: Record<string, ScopeCode> = {};
      updatedGrantsData.forEach((rg) => {
        grantLookup[rg.permission_id] = rg.scope_code;
      });

      const newGrantsMap: Record<string, { granted: boolean; scopeCode: ScopeCode }> = {};
      permissionsCatalog.forEach((p) => {
        const isGranted = Boolean(grantLookup[p.id]);
        const scope = isGranted ? grantLookup[p.id] : (p.supports_data_scope ? 'own' : 'none');
        newGrantsMap[p.id] = {
          granted: isGranted,
          scopeCode: scope
        };
      });

      // Step 4: Reset dirty state
      setInitialGrants(newGrantsMap);
      setCurrentGrants(newGrantsMap);

      // Refresh logged in user permissions in case self role was updated
      await refreshPermissions();
    } catch (err: any) {
      console.error('[RolePermissionMatrix] Error saving permissions:', err);
      setErrorMessage(err.message || 'Lỗi không xác định khi lưu phân quyền.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCollapseModule = (moduleId: string) => {
    setCollapsedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // Filtered view items
  const filteredModulesWithPerms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return modules
      .filter((m) => selectedModuleFilter === 'all' || m.id === selectedModuleFilter || m.code === selectedModuleFilter)
      .map((module) => {
        const permsInModule = permissionsCatalog
          .filter((p) => p.module_id === module.id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .filter((p) => {
            if (!query) return true;
            return (
              p.name.toLowerCase().includes(query) ||
              p.code.toLowerCase().includes(query) ||
              (p.description && p.description.toLowerCase().includes(query))
            );
          });

        const activeCount = permsInModule.filter((p) => currentGrants[p.id]?.granted).length;

        return {
          module,
          permissions: permsInModule,
          activeCount,
          totalCount: permsInModule.length
        };
      })
      .filter((item) => item.permissions.length > 0 || !searchQuery);
  }, [modules, permissionsCatalog, currentGrants, searchQuery, selectedModuleFilter]);

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 text-center min-h-[360px] flex flex-col items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Đang tải ma trận phân quyền...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Ma trận quyền: <span className="text-indigo-600">{roleName || 'Vai trò'}</span>
            </h2>
            {roleCode && (
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                {roleCode}
              </span>
            )}
            {!canManage && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                Chế độ chỉ xem
              </span>
            )}
            {isDirty && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-100 text-amber-800 animate-pulse">
                Có thay đổi chưa lưu
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Bật/tắt quyền và định cấu hình phạm vi dữ liệu trực tiếp cho vai trò này.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              id="cancel-role-permissions-btn"
              type="button"
              disabled={isSaving}
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Hủy thay đổi
            </button>
          )}

          <button
            id="save-role-permissions-btn"
            type="button"
            disabled={!isDirty || isSaving || !canManage}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs font-medium text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="role-matrix-search-input"
            type="text"
            placeholder="Tìm kiếm quyền hoặc mã capability..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            id="role-matrix-module-filter"
            value={selectedModuleFilter}
            onChange={(e) => setSelectedModuleFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả modules ({modules.length})</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-500">
          Tổng cộng: <span className="font-semibold text-slate-700">{permissionsCatalog.length}</span> quyền
        </div>
      </div>

      {/* Modules & Permissions Accordion / Table */}
      <div className="divide-y divide-slate-200">
        {filteredModulesWithPerms.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Không tìm thấy quyền nào phù hợp với điều kiện lọc.
          </div>
        ) : (
          filteredModulesWithPerms.map(({ module, permissions, activeCount, totalCount }) => {
            const isCollapsed = collapsedModules[module.id];
            const allChecked = totalCount > 0 && activeCount === totalCount;

            return (
              <div key={module.id} className="bg-white">
                {/* Module Section Header */}
                <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/60 transition-colors">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none flex-1"
                    onClick={() => toggleCollapseModule(module.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-sm text-slate-800">{module.name}</span>
                    <span className="px-1.5 py-0.5 text-[11px] font-mono text-slate-500 bg-slate-200/70 rounded">
                      {module.code}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                      ({activeCount}/{totalCount} quyền được cấp)
                    </span>
                  </div>

                  {canManage && totalCount > 0 && !isCollapsed && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAllInModule(module.id, !allChecked)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                      >
                        {allChecked ? 'Bỏ chọn tất cả' : 'Cấp tất cả'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Permissions List */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/30 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-5 w-12 text-center">Cấp</th>
                          <th className="py-2.5 px-4 min-w-[240px]">Tên & Mô tả quyền</th>
                          <th className="py-2.5 px-4 w-44">Mã Capability</th>
                          <th className="py-2.5 px-4 w-32">Loại quyền</th>
                          <th className="py-2.5 px-5 w-56">Phạm vi dữ liệu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {permissions.map((p) => {
                          const state = currentGrants[p.id] || { granted: false, scopeCode: 'none' };
                          const isGranted = state.granted;
                          const supportsScope = p.supports_data_scope;

                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isGranted ? 'bg-indigo-50/20' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-3 px-5 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    id={`perm-check-${p.id}`}
                                    type="checkbox"
                                    checked={isGranted}
                                    disabled={!canManage}
                                    onChange={() => handleTogglePermission(p.id)}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  />
                                </label>
                              </td>

                              {/* Name & Description (Never UUID!) */}
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{p.name}</div>
                                {p.description && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                    {p.description}
                                  </div>
                                )}
                              </td>

                              {/* Capability Code */}
                              <td className="py-3 px-4 font-mono text-[11px] text-indigo-700">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {p.code}
                                </span>
                              </td>

                              {/* Scope Support Tag */}
                              <td className="py-3 px-4">
                                {supportsScope ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    Phạm vi dữ liệu
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    Hệ thống
                                  </span>
                                )}
                              </td>

                              {/* Scope Selector */}
                              <td className="py-3 px-5">
                                {supportsScope ? (
                                  isGranted ? (
                                    <select
                                      id={`perm-scope-${p.id}`}
                                      value={state.scopeCode}
                                      disabled={!canManage}
                                      onChange={(e) => handleChangeScope(p.id, e.target.value as ScopeCode)}
                                      className="w-full px-2.5 py-1.5 text-xs border border-indigo-200 rounded-md bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {SCOPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value} title={opt.desc}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">Chưa cấp quyền</span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-xs">Không áp dụng</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default RolePermissionMatrix;
