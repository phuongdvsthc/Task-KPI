import React, { useEffect, useState } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { getSupabaseClient } from '../../services/supabaseClient';

interface Props {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const AnnouncementPublishModal: React.FC<Props> = ({ taskId, isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && taskId) {
      const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error('Không thể kết nối Supabase');
          const { data, error: rpcErr } = await (supabase.rpc as any)('preview_announcement_audience', { p_task_id: taskId });
          if (rpcErr) throw rpcErr;
          setRecipients(data || []);
        } catch (err: any) {
          setError(err.message || 'Lỗi tải danh sách người nhận');
        } finally {
          setLoading(false);
        }
      };
      fetchPreview();
    }
  }, [isOpen, taskId]);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Không thể kết nối Supabase');
      
      const { data, error: rpcErr } = await (supabase.rpc as any)('publish_announcement', { p_task_id: taskId });
      if (rpcErr) throw rpcErr;
      
      let count = recipients.length;
      if (Array.isArray(data) && data.length > 0 && data?.[0]?.recipient_count !== undefined) {
        count = data?.[0]?.recipient_count;
      } else if (data && typeof data === 'object' && 'recipient_count' in data) {
        count = (data as any).recipient_count;
      }
      
      onSuccess(count);
    } catch (err: any) {
      console.error('[Development log] publish_announcement error:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint
      });
      setError(err.message || 'Lỗi phát hành thông báo');
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Xác nhận Phát hành</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Đang tải danh sách người nhận...</div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg">
                <Users className="w-5 h-5 shrink-0" />
                <p className="font-medium">Thông báo sẽ được gửi đến {recipients.length} nhân viên.</p>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Nhân viên</th>
                      <th className="px-4 py-2">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto block w-full table-fixed">
                    {recipients.map((r, i) => (
                      <tr key={r.user_id || i} className="table w-full table-fixed">
                        <td className="px-4 py-2 text-slate-800">
                          <div className="font-semibold">{r.full_name}</div>
                          <div className="text-[11px] text-slate-500">{r.employee_code}</div>
                        </td>
                        <td className="px-4 py-2 text-slate-600 truncate">{r.organization_name}</td>
                      </tr>
                    ))}
                    {recipients.length === 0 && (
                      <tr className="table w-full table-fixed">
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                          Chưa có người nhận hợp lệ cho thông báo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg"
          >
            Quay lại
          </button>
          <button
            onClick={handlePublish}
            disabled={loading || publishing || recipients.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
          >
            {publishing ? 'Đang phát hành...' : 'Phát hành'}
          </button>
        </div>
      </div>
    </div>
  );
};
