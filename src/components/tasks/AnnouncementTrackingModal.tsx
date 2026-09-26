import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { X, CheckCircle2, Circle, AlertCircle, RefreshCw, UserCheck, Eye } from 'lucide-react';
import { getSupabaseClient } from '../../services/supabaseClient';
import { taskService } from '../../services/taskService';
import { AnnouncementRecipientStatus, AnnouncementDeliveryDashboard } from '../../types/task';

interface Props {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementTrackingModal: React.FC<Props> = ({ taskId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [task, setTask] = useState<{
    title?: string;
    content_version: number;
    acknowledgement_required: boolean;
  } | null>(null);

  const [recipients, setRecipients] = useState<AnnouncementRecipientStatus[]>([]);
  const [filter, setFilter] = useState<'all' | 'viewed' | 'unviewed' | 'acked' | 'unacked'>('all');

  const fetchData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Primary approach: Use backend API /api/announcements/:id/delivery
      // This is the source of truth with complete joins and manager permissions
      try {
        const dashboard: AnnouncementDeliveryDashboard = await taskService.getAnnouncementDeliveryDashboard(taskId);
        if (dashboard && Array.isArray(dashboard.recipients)) {
          setTask({
            title: dashboard.title,
            content_version: dashboard.content_version || 1,
            acknowledgement_required: !!dashboard.acknowledgement_required,
          });
          setRecipients(dashboard.recipients);
          setLoading(false);
          return;
        }
      } catch (apiErr: any) {
        console.warn('[AnnouncementTrackingModal] API delivery fetch error, falling back to direct query:', apiErr);
      }

      // 2. Direct Supabase Query Fallback
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Không thể kết nối cơ sở dữ liệu Supabase');
      
      // Get Task
      const { data: taskData, error: taskErr } = await (supabase.from('tasks') as any)
        .select('title, content_version, acknowledgement_required')
        .eq('id', taskId)
        .single();
      
      if (taskErr) throw taskErr;
      setTask({
        title: taskData.title,
        content_version: taskData.content_version || 1,
        acknowledgement_required: !!taskData.acknowledgement_required,
      });

      // Get Assignees
      const { data: assigneesData, error: assigneesErr } = await (supabase.from('task_assignees') as any)
        .select(`
          user_id,
          last_viewed_version,
          first_viewed_at,
          last_viewed_at,
          acknowledged_version,
          acknowledged_at,
          organization_unit_id_snapshot,
          profiles:user_id (id, full_name, email, employee_code, job_title, avatar_url),
          organization_units:organization_unit_id_snapshot (id, name)
        `)
        .eq('task_id', taskId)
        .eq('assignment_role', 'recipient')
        .eq('is_active', true);

      if (assigneesErr) throw assigneesErr;

      // Extract user IDs where profile resolution failed to batch fetch
      const rawAssignees = assigneesData || [];
      const missingProfileUserIds = rawAssignees
        .filter((a: any) => !a.profiles || (Array.isArray(a.profiles) && a.profiles.length === 0))
        .map((a: any) => a.user_id);

      const extraProfilesMap = new Map<string, any>();
      if (missingProfileUserIds.length > 0) {
        const { data: extraProfiles } = await (supabase.from('profiles') as any)
          .select('id, full_name, email, employee_code, job_title, avatar_url')
          .in('id', missingProfileUserIds);
        (extraProfiles || []).forEach((p: any) => extraProfilesMap.set(p.id, p));
      }

      const cv = taskData.content_version || 1;
      const mappedRecipients: AnnouncementRecipientStatus[] = rawAssignees.map((r: any) => {
        const profileObj = Array.isArray(r.profiles) ? r.profiles[0] : (r.profiles || extraProfilesMap.get(r.user_id) || {});
        const unitObj = Array.isArray(r.organization_units) ? r.organization_units[0] : (r.organization_units || {});

        const isViewed = r.last_viewed_version === cv;
        const isAcked = r.acknowledged_version === cv;

        return {
          user_id: r.user_id,
          full_name: profileObj.full_name || profileObj.email || 'Không rõ',
          email: profileObj.email || '',
          employee_code: profileObj.employee_code || '',
          job_title: profileObj.job_title || '',
          avatar_url: profileObj.avatar_url || '',
          organization_unit_id: r.organization_unit_id_snapshot,
          unit_name: unitObj.name || '---',
          organization_name: unitObj.name || '---',
          is_viewed_current: isViewed,
          first_viewed_at: r.first_viewed_at || null,
          last_viewed_at: r.last_viewed_at || null,
          last_viewed_version: r.last_viewed_version || null,
          is_acknowledged_current: isAcked,
          acknowledged_at: r.acknowledged_at || null,
          acknowledged_version: r.acknowledged_version || null,
        };
      });

      setRecipients(mappedRecipients);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu theo dõi');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchData();
    }
  }, [isOpen, taskId, fetchData]);

  const stats = useMemo(() => {
    if (!task) return { total: 0, viewed: 0, unviewed: 0, acked: 0, unacked: 0 };
    const cv = task.content_version;
    const total = recipients.length;
    const viewed = recipients.filter(r => r.is_viewed_current || r.last_viewed_version === cv).length;
    const acked = recipients.filter(r => r.is_acknowledged_current || r.acknowledged_version === cv).length;
    
    return {
      total,
      viewed,
      unviewed: Math.max(0, total - viewed),
      acked,
      unacked: Math.max(0, total - acked),
    };
  }, [recipients, task]);

  const filteredRecipients = useMemo(() => {
    if (!task) return recipients;
    const cv = task.content_version;
    return recipients.filter(r => {
      const isViewed = r.is_viewed_current || r.last_viewed_version === cv;
      const isAcked = r.is_acknowledged_current || r.acknowledged_version === cv;
      if (filter === 'viewed') return isViewed;
      if (filter === 'unviewed') return !isViewed;
      if (filter === 'acked') return isAcked;
      if (filter === 'unacked') return !isAcked;
      return true;
    });
  }, [recipients, task, filter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">Theo dõi Phát hành Thông báo</h3>
            {task?.title && (
              <span className="text-xs text-slate-500 max-w-xs truncate" title={task.title}>
                - {task.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto bg-slate-50">
          {loading && recipients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Đang tải dữ liệu người nhận...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Đã gửi</div>
                  <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Đã xem</div>
                  <div className="text-2xl font-bold text-blue-600">{stats.viewed}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Chưa xem</div>
                  <div className="text-2xl font-bold text-rose-500">{stats.unviewed}</div>
                </div>
                {task?.acknowledgement_required && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Đã xác nhận</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {stats.acked} <span className="text-sm font-medium text-slate-400">/ {stats.total}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilter('viewed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      filter === 'viewed' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Đã xem ({stats.viewed})
                  </button>
                  <button
                    onClick={() => setFilter('unviewed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      filter === 'unviewed' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Chưa xem ({stats.unviewed})
                  </button>
                  {task?.acknowledgement_required && (
                    <>
                      <button
                        onClick={() => setFilter('acked')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          filter === 'acked' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        Đã xác nhận ({stats.acked})
                      </button>
                      <button
                        onClick={() => setFilter('unacked')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          filter === 'unacked' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        Chưa xác nhận ({stats.unacked})
                      </button>
                    </>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5">Người nhận</th>
                        <th className="px-4 py-2.5">Đơn vị</th>
                        <th className="px-4 py-2.5 text-center">Trạng thái Xem</th>
                        {task?.acknowledgement_required && (
                          <th className="px-4 py-2.5 text-center">Trạng thái Xác nhận</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredRecipients.map((r, i) => {
                        const isViewed = r.is_viewed_current || r.last_viewed_version === task?.content_version;
                        const isAcked = r.is_acknowledged_current || r.acknowledged_version === task?.content_version;
                        
                        // Extract full name with fallback to email, never generic 'Không rõ' if name or email exists
                        const displayName = r.full_name && r.full_name !== 'Không rõ' 
                          ? r.full_name 
                          : (r.email || 'Không rõ');
                        const displayUnit = r.unit_name || r.organization_name || '---';
                        
                        return (
                          <tr key={r.user_id || i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800">{displayName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                {r.employee_code && (
                                  <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">
                                    {r.employee_code}
                                  </span>
                                )}
                                {r.job_title && <span>{r.job_title}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{displayUnit}</td>
                            <td className="px-4 py-3 text-center">
                              {isViewed ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã xem
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                                  <Circle className="w-3.5 h-3.5" /> Chưa xem
                                </span>
                              )}
                            </td>
                            {task?.acknowledgement_required && (
                              <td className="px-4 py-3 text-center">
                                {isAcked ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                                    <Circle className="w-3.5 h-3.5" /> Chưa xác nhận
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {filteredRecipients.length === 0 && (
                        <tr>
                          <td colSpan={task?.acknowledgement_required ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                            Không có người nhận nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
