import React, { useState, useEffect } from 'react';
import { OrganizationUnit } from '../../../types/database';
import { organizationService } from '../../../services/organizationService';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';

interface OrganizationFormViewProps {
  id?: string;
}

export const OrganizationFormView: React.FC<OrganizationFormViewProps> = ({ id }) => {
  const isEdit = !!id;
  const { refreshProfile } = useAuth();
  const [formData, setFormData] = useState<Partial<OrganizationUnit>>({
    name: '',
    code: '',
    unit_type: 'department',
    parent_id: '',
    description: '',
    sort_order: 0,
    is_active: true
  });
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUnits = await organizationService.getAdminUnits();
      setUnits(allUnits);
      
      if (isEdit) {
        const target = allUnits.find(u => u.id === id);
        if (target) {
          setFormData({
            ...target,
            parent_id: target.parent_id || ''
          });
        } else {
          setError('Không tìm thấy đơn vị');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu đơn vị');
    } finally {
      setLoading(false);
    }
  };

  const isRoot = isEdit && !formData.parent_id && formData.unit_type === 'school';

  const handleChange = (field: keyof OrganizationUnit, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        parent_id: formData.parent_id || null
      };

      if (isEdit) {
        await organizationService.updateOrganizationUnit(id!, payload);
      } else {
        await organizationService.createOrganizationUnit(payload);
      }

      // Refresh auth profile and primaryUnit so sidebar immediately reflects new name & code
      try {
        await refreshProfile();
      } catch (refErr) {
        console.warn('[OrganizationFormView] Error refreshing profile:', refErr);
      }

      window.location.hash = '#/admin/organization-units';
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật đơn vị');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  const parentOptions = units
    .filter(u => u.is_active && u.id !== id)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="#/admin/organization-units" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{isEdit ? 'Sửa đơn vị' : 'Thêm đơn vị mới'}</h2>
          <p className="text-sm text-slate-500">{isEdit ? 'Cập nhật thông tin phòng ban/bộ phận' : 'Khởi tạo phòng ban/bộ phận mới trong hệ thống'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên đơn vị <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={e => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="VD: Phòng Hành chính Nhân sự"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã đơn vị <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.code || ''}
                onChange={e => handleChange('code', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase font-mono"
                placeholder="VD: HCNS"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loại đơn vị</label>
              <select
                value={formData.unit_type || 'department'}
                onChange={e => handleChange('unit_type', e.target.value)}
                disabled={isRoot}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {isRoot && <option value="school">Trường</option>}
                {!isRoot && (
                  <>
                    <option value="department">Phòng</option>
                    <option value="division">Bộ phận</option>
                    <option value="faculty">Bộ môn</option>
                    <option value="team">Tổ/Nhóm</option>
                    <option value="other">Khác</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị cấp trên</label>
              <select
                value={formData.parent_id || ''}
                onChange={e => handleChange('parent_id', e.target.value)}
                disabled={isRoot}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">-- Không có (Root) --</option>
                {parentOptions.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả thêm</label>
            <textarea
              value={formData.description || ''}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Chức năng, nhiệm vụ..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thứ tự hiển thị (Sort order)</label>
              <input
                type="number"
                value={formData.sort_order || 0}
                onChange={e => handleChange('sort_order', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={e => handleChange('is_active', e.target.checked)}
                  disabled={isRoot}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className={`text-sm font-medium ${isRoot ? 'text-slate-400' : 'text-slate-700'}`}>Đang hoạt động</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <a
              href="#/admin/organization-units"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hủy
            </a>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
