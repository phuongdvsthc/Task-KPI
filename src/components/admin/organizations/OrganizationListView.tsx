import React, { useState, useEffect, useMemo } from 'react';
import { OrganizationUnit } from '../../../types/database';
import { organizationService } from '../../../services/organizationService';
import { useAuth } from '../../../context/AuthContext';
import { Plus, Search, ChevronRight, ChevronDown, CheckCircle2, XCircle, AlertCircle, Trash2, Edit2, Play, Pause } from 'lucide-react';

export const OrganizationListView: React.FC = () => {
  const { profile } = useAuth();
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // For Delete Confirmation
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<OrganizationUnit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getAdminUnits();
      setUnits(data);
      // Auto expand root node
      const root = data.find(u => !u.parent_id);
      if (root) {
        setExpandedNodes(new Set([root.id]));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const buildTree = (data: OrganizationUnit[], parentId: string | null = null): OrganizationUnit[] => {
    return data
      .filter(u => u.parent_id === parentId)
      .map(u => ({ ...u, children: buildTree(data, u.id) }))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  };

  const filteredUnits = useMemo(() => {
    let result = units;
    if (statusFilter === 'active') result = result.filter(u => u.is_active);
    if (statusFilter === 'inactive') result = result.filter(u => !u.is_active);
    if (search) {
      const lowerSearch = (search || '').toLowerCase();
      result = result.filter(u => 
        ((u.name || '').toLowerCase().includes(lowerSearch)) || 
        ((u.code || '').toLowerCase().includes(lowerSearch))
      );
    }
    return result;
  }, [units, search, statusFilter]);

  const tree = useMemo(() => {
    // If searching, just show flat list of matches, otherwise tree
    if (search || statusFilter !== 'all') {
      return buildTree(filteredUnits, null); // Actually, flat might be better for search, but let's see. Wait, if we search, we might break the parent-child relationship.
      // Let's just return flat list for search, or try to keep tree.
    }
    return buildTree(filteredUnits, null);
  }, [filteredUnits, search, statusFilter]);

  const handleDeactivate = async (id: string) => {
    try {
      await organizationService.deactivateOrganizationUnit(id);
      await loadUnits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await organizationService.activateOrganizationUnit(id);
      await loadUnits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUnit) return;
    setIsDeleting(true);
    try {
      await organizationService.deleteOrganizationUnit(deleteConfirmUnit.id);
      setDeleteConfirmUnit(null);
      await loadUnits();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderNode = (node: OrganizationUnit & { children?: OrganizationUnit[] }, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id) || search !== '';
    const isRoot = !node.parent_id && node.unit_type === 'school';

    const getUnitTypeName = (type: string) => {
      const map: Record<string, string> = {
        school: 'Trường', department: 'Phòng', division: 'Bộ phận',
        faculty: 'Bộ môn', team: 'Tổ/Nhóm', other: 'Khác'
      };
      return map[type] || type;
    };

    return (
      <React.Fragment key={node.id}>
        <div className={`flex items-center py-3 px-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${level === 0 ? 'bg-slate-50/50 font-medium' : ''}`}>
          <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: `${level * 24}px` }}>
            {hasChildren ? (
              <button onClick={() => toggleExpand(node.id)} className="p-1 mr-1 text-slate-400 hover:text-slate-600 rounded">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 mr-1" />
            )}
            <div className="truncate">
              <span className="text-slate-900">{node.name}</span>
              <span className="ml-2 text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{node.code}</span>
            </div>
          </div>
          
          <div className="w-32 flex-shrink-0 px-4 text-sm text-slate-500">
            {getUnitTypeName(node.unit_type)}
          </div>
          
          <div className="w-32 flex-shrink-0 px-4">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${node.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {node.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {node.is_active ? 'Hoạt động' : 'Ngừng'}
            </span>
          </div>

          <div className="w-48 flex-shrink-0 flex items-center justify-end gap-2 pr-4">
            <a
              href={`#/admin/organization-units/${node.id}/edit`}
              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"
              title="Sửa đơn vị"
            >
              <Edit2 className="w-4 h-4" />
            </a>
            {!isRoot && (
              <>
                {node.is_active ? (
                  <button
                    onClick={() => handleDeactivate(node.id)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 rounded"
                    title="Ngừng sử dụng"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(node.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded"
                    title="Kích hoạt lại"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirmUnit(node)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                  title="Xóa vĩnh viễn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && node.children!.map(child => renderNode(child, level + 1))}
      </React.Fragment>
    );
  };

  if (profile?.system_role !== 'admin') {
    return <div className="p-4 text-red-600">Không có quyền truy cập</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cơ cấu tổ chức</h2>
          <p className="text-sm text-slate-500 mt-1">Quản lý danh sách các phòng ban, bộ phận trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/admin/organization-units/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm đơn vị mới
          </a>
        </div>
      </div>

      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã ngừng</option>
        </select>
      </div>

      {error && (
        <div className="p-4 m-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Đang tải dữ liệu...</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex items-center py-3 px-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex-1 pl-4">Tên đơn vị</div>
              <div className="w-32 px-4">Loại</div>
              <div className="w-32 px-4">Trạng thái</div>
              <div className="w-48 pr-4 text-right">Thao tác</div>
            </div>
            <div className="divide-y divide-slate-100">
              {search || statusFilter !== 'all' ? (
                // Flat list if searching
                filteredUnits.map(u => renderNode(u, 0))
              ) : (
                // Tree view
                tree.map(node => renderNode(node, 0))
              )}
              {filteredUnits.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Không tìm thấy đơn vị nào.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUnit && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Xóa đơn vị</h3>
            <p className="text-sm text-slate-600 mb-6">
              Bạn có chắc muốn xóa vĩnh viễn đơn vị <strong>{deleteConfirmUnit.name}</strong>?
              <br/><br/>
              Chỉ nên thực hiện với đơn vị tạo nhầm và chưa có dữ liệu. Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmUnit(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
