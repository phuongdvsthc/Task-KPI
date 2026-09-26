import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Users, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { safeParseResponseJson } from '../../lib/api';

interface OrgUnit {
  id: string;
  name: string;
  code: string;
}

interface ReportSourceAssignment {
  id?: string;
  organization_unit_id: string;
  is_active: boolean;
  sort_order: number;
}

interface ReportSource {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  report_source_unit_assignments?: ReportSourceAssignment[];
}

export const ReportSourceAdminView: React.FC = () => {
  const { user } = useAuth();
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSource, setCurrentSource] = useState<Partial<ReportSource> | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<ReportSourceAssignment[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  
  const getToken = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const fetchSources = async () => {
    const token = await getToken();
    try {
      if (token) {
        const res = await fetch('/api/admin/report-sources', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const parsed = await safeParseResponseJson<any>(res);
          if (parsed.ok && parsed.data) {
            setSources(parsed.data);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load sources from API, falling back to direct query', e);
    }

    // Direct fallback
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await (supabase.from('report_sources') as any)
        .select(`
          *,
          report_source_unit_assignments (
            id,
            organization_unit_id,
            is_active,
            sort_order,
            organization_units (
              id,
              name,
              code
            )
          )
        `)
        .order('sort_order', { ascending: true });
      if (data) setSources(data);
    }
  };

  const fetchOrgs = async () => {
    const token = await getToken();
    try {
      if (token) {
        const res = await fetch('/api/admin/organization-units', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const parsed = await safeParseResponseJson<any>(res);
          if (parsed.ok && parsed.data) {
            setOrgUnits(parsed.data);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load org units from API, falling back', e);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from('organization_units').select('*').order('sort_order', { ascending: true });
      if (data) setOrgUnits(data);
    }
  };

  useEffect(() => {
    Promise.all([fetchSources(), fetchOrgs()]).finally(() => setIsLoading(false));
  }, [user]);

  const handleEdit = (source: ReportSource) => {
    setCurrentSource(source);
    setSelectedAssignments(source.report_source_unit_assignments || []);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setCurrentSource({
      is_active: true,
      sort_order: 0,
    });
    setSelectedAssignments([]);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSource) return;
    setSaveError(null);
    
    try {
      const token = await getToken();
      const isNew = !currentSource.id;
      const url = isNew ? '/api/admin/report-sources' : `/api/admin/report-sources/${currentSource.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const payload = {
        ...currentSource,
        assignments: selectedAssignments
      };
      
      if (token) {
        const res = await fetch(url, {
          method,
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          setIsEditing(false);
          fetchSources();
          return;
        } else {
          const errData = await res.json().catch(() => null);
          setSaveError(errData?.error || 'Có lỗi xảy ra khi lưu trên máy chủ.');
        }
      }
    } catch (e: any) {
      console.error('Save failed', e);
      setSaveError(e.message || 'Có lỗi kết nối khi lưu.');
    }
  };

  const toggleOrgSelection = (orgId: string) => {
    const exists = selectedAssignments.find(a => a.organization_unit_id === orgId);
    if (exists) {
      setSelectedAssignments(prev => prev.filter(a => a.organization_unit_id !== orgId));
    } else {
      setSelectedAssignments(prev => [...prev, { organization_unit_id: orgId, is_active: true, sort_order: 0 }]);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10 text-slate-500">Đang tải dữ liệu...</div>;
  }

  if (isEditing && currentSource) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {currentSource.id ? 'Cập nhật Kênh/Nguồn' : 'Thêm mới Kênh/Nguồn'}
          </h2>
          <button 
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-slate-500 hover:text-slate-700"
          >
            Đóng
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã (Code) *</label>
              <input 
                required
                type="text" 
                value={currentSource.code || ''} 
                onChange={e => setCurrentSource({...currentSource, code: e.target.value})}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên Kênh/Nguồn *</label>
              <input 
                required
                type="text" 
                value={currentSource.name || ''} 
                onChange={e => setCurrentSource({...currentSource, name: e.target.value})}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phân loại (Category)</label>
              <input 
                type="text" 
                value={currentSource.category || ''} 
                onChange={e => setCurrentSource({...currentSource, category: e.target.value})}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thứ tự hiển thị (Sort Order)</label>
              <input 
                type="number" 
                value={currentSource.sort_order || 0} 
                onChange={e => setCurrentSource({...currentSource, sort_order: parseInt(e.target.value)})}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả chi tiết</label>
            <textarea 
              rows={3}
              value={currentSource.description || ''} 
              onChange={e => setCurrentSource({...currentSource, description: e.target.value})}
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={currentSource.is_active}
                onChange={e => setCurrentSource({...currentSource, is_active: e.target.checked})}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Trạng thái kích hoạt (Active)</span>
            </label>
          </div>
          
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Áp dụng cho các Đơn vị (Organization Units)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {orgUnits.map(org => {
                const isSelected = selectedAssignments.some(a => a.organization_unit_id === org.id);
                return (
                  <div 
                    key={org.id}
                    onClick={() => toggleOrgSelection(org.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{org.name}</div>
                      <div className="text-xs text-slate-500">{org.code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedAssignments.length === 0 && (
              <p className="text-sm text-red-500 mt-2">Vui lòng chọn ít nhất 1 đơn vị áp dụng.</p>
            )}
          </div>
          
          <div className="border-t border-slate-200 pt-5 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Kênh / Nguồn báo cáo
        </h2>
        <button 
          onClick={handleAddNew}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thêm mới
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kênh / Nguồn</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mã (Code)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn vị áp dụng</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sources.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  Chưa có Kênh/Nguồn nào được thiết lập.
                </td>
              </tr>
            ) : (
              sources.map(source => (
                <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{source.name}</div>
                    {source.category && <div className="text-xs text-slate-500">{source.category}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                    {source.code}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {source.report_source_unit_assignments && source.report_source_unit_assignments.length > 0 ? (
                        source.report_source_unit_assignments.map((assignment, idx) => {
                          const org = orgUnits.find(o => o.id === assignment.organization_unit_id);
                          return org ? (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {org.code}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-xs text-amber-600 italic">Chưa áp dụng</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {source.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <XCircle className="w-3 h-3" />
                        Tạm ẩn
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleEdit(source)}
                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
