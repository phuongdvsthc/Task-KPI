import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';

const getAccessToken = async (): Promise<string> => {
  const client = getSupabaseClient();
  if (!client) return '';
  const session = (await client.auth.getSession()).data.session;
  return session?.access_token || '';
};

interface PromptDefinition {
  id: string;
  prompt_key: string;
  name: string;
  description: string;
  feature_group: string;
  enabled: boolean;
  ai_prompt_versions: any[];
}

export const AiPromptRegistryView: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state: 'list', 'edit_def', 'versions', 'edit_version'
  const [viewState, setViewState] = useState<'list' | 'edit_def' | 'versions' | 'edit_version'>('list');
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    if (viewState === 'list') {
      fetchPrompts();
    }
  }, [viewState]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/prompt-registry', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPrompts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modal state for creating new prompt
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGroup, setNewGroup] = useState('general');
  const [newSysPrompt, setNewSysPrompt] = useState('');
  const [newUserTpl, setNewUserTpl] = useState('');
  const [newOutputMode, setNewOutputMode] = useState('text');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newKey.trim() || !newName.trim()) {
      setCreateError('Vui lòng nhập đầy đủ Key và Tên prompt.');
      return;
    }

    setCreating(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/prompt-registry', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
            prompt_key: newKey.trim(),
            name: newName.trim(),
            description: newDesc.trim(),
            feature_group: newGroup.trim(),
            system_prompt: newSysPrompt,
            user_prompt_template: newUserTpl,
            output_mode: newOutputMode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Không thể tạo prompt.');
      }

      // Success: close modal, reset form, refresh list
      setShowCreateModal(false);
      setNewKey('');
      setNewName('');
      setNewDesc('');
      setNewGroup('general');
      setNewSysPrompt('');
      setNewUserTpl('');
      setNewOutputMode('text');
      fetchPrompts();
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi kết nối khi tạo prompt.');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompt-registry/${id}/status`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ enabled: !current })
      });
      if (!res.ok) throw new Error(await res.text());
      fetchPrompts();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const openVersions = (id: string) => {
    setSelectedDefId(id);
    setViewState('versions');
  };

  if (viewState === 'versions' && selectedDefId) {
    return <PromptVersionsView defId={selectedDefId} onBack={() => setViewState('list')} />;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-slate-800">Prompt Registry</h3>
        <button onClick={() => { setShowCreateModal(true); setCreateError(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
          Tạo Prompt
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded mb-4">{error}</div>}

      {/* Create Prompt Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h4 className="text-lg font-medium text-slate-800">Tạo Prompt Mới</h4>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prompt Key <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. system.custom_task" 
                    value={newKey} 
                    onChange={e => setNewKey(e.target.value)} 
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Key định danh duy nhất (dùng trong code).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên Prompt <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. Custom Task Prompt" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm tính năng (Feature Group)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. general, admissions, kpi" 
                    value={newGroup} 
                    onChange={e => setNewGroup(e.target.value)} 
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Output Mode</label>
                  <select 
                    value={newOutputMode} 
                    onChange={e => setNewOutputMode(e.target.value)} 
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="structured">Structured (JSON)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <input 
                  type="text" 
                  placeholder="Mô tả mục đích sử dụng prompt này..." 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)} 
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt (Phiên bản v1)</label>
                <textarea 
                  placeholder="Nhập System Prompt ban đầu..." 
                  value={newSysPrompt} 
                  onChange={e => setNewSysPrompt(e.target.value)} 
                  rows={3}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User Prompt Template (Phiên bản v1)</label>
                <textarea 
                  placeholder="Nhập User Prompt Template (có thể chứa biến {{variable}})..." 
                  value={newUserTpl} 
                  onChange={e => setNewUserTpl(e.target.value)} 
                  rows={3}
                  className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={creating} 
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Lưu & Tạo Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm">
              <th className="p-3 text-slate-600 font-semibold">Key</th>
              <th className="p-3 text-slate-600 font-semibold">Tên</th>
              <th className="p-3 text-slate-600 font-semibold">Trạng thái</th>
              <th className="p-3 text-slate-600 font-semibold">Active Version</th>
              <th className="p-3 text-slate-600 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Đang tải...</td></tr>
            ) : prompts.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Chưa có prompt nào.</td></tr>
            ) : prompts.map(p => {
              const activeV = p.ai_prompt_versions?.find(v => v.status === 'active');
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-sm text-slate-800">{p.prompt_key}</td>
                  <td className="p-3 text-sm text-slate-600">{p.name}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                      {p.enabled ? 'Đang bật' : 'Đã tắt'}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-600">
                    {activeV ? `v${activeV.version_number}` : <span className="text-slate-400">Không có</span>}
                  </td>
                  <td className="p-3 text-sm text-right space-x-2">
                    <button onClick={() => toggleStatus(p.id, p.enabled)} className="text-slate-500 hover:text-indigo-600">
                      {p.enabled ? 'Tắt' : 'Bật'}
                    </button>
                    <button onClick={() => openVersions(p.id)} className="text-indigo-600 hover:text-indigo-800">
                      Versions
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PromptVersionsView: React.FC<{ defId: string; onBack: () => void }> = ({ defId, onBack }) => {
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingVersion, setEditingVersion] = useState<any | null>(null);
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [creatingDraft, setCreatingDraft] = useState(false);

    useEffect(() => {
        if (!editingVersion) fetchVersions();
    }, [defId, editingVersion]);

    const fetchVersions = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = await getAccessToken();
            const res = await fetch(`/api/admin/prompt-registry/${defId}/versions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Không thể tải danh sách phiên bản.');
            }
            setVersions(await res.json());
        } catch (e: any) {
            setActionError(e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const createDraft = async () => {
        if (creatingDraft || activatingId) return;
        setCreatingDraft(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const token = await getAccessToken();
            const res = await fetch(`/api/admin/prompt-registry/${defId}/versions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Không thể tạo bản nháp mới.');
            }
            const newVer = await res.json();
            setActionSuccess(`Đã tạo bản nháp v${newVer.version_number} thành công.`);
            fetchVersions(true);
        } catch (e: any) {
            setActionError(e.message);
        } finally {
            setCreatingDraft(false);
        }
    };

    const activateVersion = async (vId: string) => {
        if (activatingId || creatingDraft) return;
        setActivatingId(vId);
        setActionError(null);
        setActionSuccess(null);

        const target = versions.find(v => v.id === vId);

        try {
            const token = await getAccessToken();
            const res = await fetch(`/api/admin/prompt-registry/versions/${vId}/activate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const resData = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(resData?.message || resData?.error || 'Không thể kích hoạt phiên bản.');
            }

            // Immediately update state without needing full page reload
            setVersions(prev => prev.map(v => {
                if (v.id === vId) {
                    return { ...v, status: 'active', activated_at: resData?.activated_at || new Date().toISOString() };
                }
                if (v.status === 'active') {
                    return { ...v, status: 'retired' };
                }
                return v;
            }));

            setActionSuccess(`Đã kích hoạt phiên bản v${target?.version_number || resData?.version_number || ''} thành công.`);
            // Sync with backend in background
            fetchVersions(true);
        } catch (e: any) {
            setActionError(e.message || 'Lỗi khi kích hoạt phiên bản.');
        } finally {
            setActivatingId(null);
        }
    };

    if (editingVersion) {
        return (
            <PromptEditor 
                version={editingVersion} 
                onBack={() => setEditingVersion(null)} 
                onSaved={() => { setEditingVersion(null); fetchVersions(); }}
            />
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <button 
                    onClick={onBack} 
                    className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center space-x-1"
                >
                    <span>&larr;</span>
                    <span>Quay lại danh sách</span>
                </button>
                <button 
                    onClick={createDraft} 
                    disabled={creatingDraft || !!activatingId}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                >
                    {creatingDraft ? 'Đang tạo...' : '+ Tạo Bản Nháp Mới'}
                </button>
            </div>

            {actionError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200 flex justify-between items-center">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
                </div>
            )}

            {actionSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200 flex justify-between items-center">
                    <span>{actionSuccess}</span>
                    <button onClick={() => setActionSuccess(null)} className="text-green-400 hover:text-green-600 font-bold">&times;</button>
                </div>
            )}
            
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                  <th className="p-3 text-slate-600 font-semibold">Phiên bản</th>
                  <th className="p-3 text-slate-600 font-semibold">Trạng thái</th>
                  <th className="p-3 text-slate-600 font-semibold">Thời gian tạo</th>
                  <th className="p-3 text-slate-600 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">Đang tải phiên bản...</td></tr>
                  ) : versions.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">Chưa có phiên bản nào.</td></tr>
                  ) : versions.map(v => (
                      <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium text-slate-800">v{v.version_number}</td>
                          <td className="p-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  v.status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' : 
                                  v.status === 'draft' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                                  'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                  {v.status === 'active' ? 'ACTIVE (Đang dùng)' : v.status === 'draft' ? 'DRAFT (Bản nháp)' : 'RETIRED (Lưu trữ)'}
                              </span>
                          </td>
                          <td className="p-3 text-sm text-slate-500">{new Date(v.created_at).toLocaleString()}</td>
                          <td className="p-3 text-sm text-right space-x-3">
                              {v.status === 'draft' && (
                                  <button 
                                      onClick={() => activateVersion(v.id)} 
                                      disabled={activatingId !== null}
                                      className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                  >
                                      {activatingId === v.id ? 'Đang kích hoạt...' : 'Kích hoạt'}
                                  </button>
                              )}
                              <button 
                                  onClick={() => setEditingVersion(v)} 
                                  className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                              >
                                  {v.status === 'draft' ? 'Chỉnh sửa' : 'Chi tiết'}
                              </button>
                          </td>
                      </tr>
                  ))}
              </tbody>
            </table>
        </div>
    );
};

const PromptEditor: React.FC<{ version: any; onBack: () => void; onSaved?: () => void }> = ({ version, onBack, onSaved }) => {
    const isDraft = version.status === 'draft';
    const [sys, setSys] = useState(version.system_prompt || '');
    const [userTpl, setUserTpl] = useState(version.user_prompt_template || '');
    const [mode, setMode] = useState(version.output_mode || 'text');
    const [schema, setSchema] = useState(version.response_schema ? JSON.stringify(version.response_schema, null, 2) : '');
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [editorSuccess, setEditorSuccess] = useState<string | null>(null);

    const save = async () => {
        setSaving(true);
        setEditorError(null);
        setEditorSuccess(null);
        try {
            const token = await getAccessToken();
            let parsedSchema = null;
            if (schema && schema.trim()) {
                try { 
                    parsedSchema = JSON.parse(schema); 
                } catch (e) { 
                    throw new Error('Response Schema không hợp lệ (phải là định dạng JSON).'); 
                }
            }
            const res = await fetch(`/api/admin/prompt-registry/versions/${version.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({
                    system_prompt: sys,
                    user_prompt_template: userTpl,
                    output_mode: mode,
                    response_schema: parsedSchema
                })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Lưu bản nháp thất bại.');
            }
            setEditorSuccess('Đã lưu bản nháp thành công!');
            if (onSaved) {
                setTimeout(() => onSaved(), 500);
            }
        } catch (e: any) {
            setEditorError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200 space-y-4">
             <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
                    &larr; Quay lại phiên bản
                </button>
                <div className="text-sm font-semibold text-slate-700">
                    v{version.version_number} ({version.status.toUpperCase()})
                </div>
            </div>

            {editorError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                    {editorError}
                </div>
            )}

            {editorSuccess && (
                <div className="p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">
                    {editorSuccess}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                <textarea 
                    value={sys} onChange={e => setSys(e.target.value)} disabled={!isDraft}
                    className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows={4} 
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User Prompt Template</label>
                <textarea 
                    value={userTpl} onChange={e => setUserTpl(e.target.value)} disabled={!isDraft}
                    className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows={4} 
                />
            </div>

            <div className="flex space-x-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Output Mode</label>
                    <select value={mode} onChange={e => setMode(e.target.value)} disabled={!isDraft} className="w-full border border-slate-300 rounded p-2 text-sm">
                        <option value="text">Text</option>
                        <option value="structured">Structured (JSON)</option>
                    </select>
                </div>
            </div>

            {mode === 'structured' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Response Schema (JSON)</label>
                    <textarea 
                        value={schema} onChange={e => setSchema(e.target.value)} disabled={!isDraft}
                        className="w-full border border-slate-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows={6} 
                    />
                </div>
            )}

            {isDraft && (
                <div className="pt-4 flex justify-end">
                    <button 
                        onClick={save} 
                        disabled={saving} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? 'Đang lưu...' : 'Lưu Bản Nháp'}
                    </button>
                </div>
            )}
        </div>
    );
};
