import React, { useState, useEffect } from 'react';
import { X, Search, Clock, FileText, Activity, AlertCircle } from 'lucide-react';
import { kpiActualService } from '../../../services/kpiActualService';

function formatDate(isoStr: string, includeTime = false) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (includeTime) {
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }
  return `${dd}/${mm}/${yyyy}`;
}

interface Props {
  assignmentItemId: string;
  onClose: () => void;
}

export const KpiActualTraceDrawer: React.FC<Props> = ({ assignmentItemId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<any>(null);

  useEffect(() => {
    loadTrace();
  }, [assignmentItemId]);

  const loadTrace = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await kpiActualService.getActualTrace(assignmentItemId);
    if (err) setError(err.message);
    else setTraceData(data);
    setLoading(false);
  };

  const renderContent = () => {
    if (loading) return <div className="p-6 text-slate-500">Đang tải dữ liệu nguồn...</div>;
    if (error) return <div className="p-6 text-red-500">Lỗi: {error}</div>;
    if (!traceData) return null;

    if (traceData.status === 'no_binding') {
      return <div className="p-6 text-slate-500 italic">Chưa cấu hình nguồn dữ liệu cho tiêu chí này.</div>;
    }
    if (traceData.status === 'invalid_config') {
       return <div className="p-6 text-red-500 italic">Cấu hình nguồn không hợp lệ.</div>;
    }
    if (traceData.status === 'unsupported_source') {
       return <div className="p-6 text-amber-500 italic">Nguồn này chưa được hỗ trợ trích xuất chi tiết.</div>;
    }
    if (traceData.status === 'no_data') {
       return <div className="p-6 text-slate-500 italic">Chưa có dữ liệu từ nguồn {traceData.source_type}.</div>;
    }

    if (traceData.source_type === 'manual') {
      return (
        <div className="p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Lịch sử cập nhật (Nhập thủ công)
          </h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {traceData.history?.map((entry: any, idx: number) => (
              <div key={entry.entry_id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-indigo-50 text-slate-500 group-[.is-active]:text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                   {idx === 0 ? <Activity className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-slate-900 text-sm">{entry.entered_by_name || 'Người dùng'}</div>
                    <time className="font-mono text-xs text-indigo-500">{formatDate(entry.entered_at, true)}</time>
                  </div>
                  <div className="text-slate-600 text-sm mt-2">
                    <span className="font-semibold text-slate-800">Giá trị: </span>
                    {entry.value_numeric ?? entry.value_text ?? (entry.value_boolean ? 'Đạt' : 'Không đạt')}
                  </div>
                  {entry.note && (
                    <div className="text-slate-500 text-sm mt-1 italic border-l-2 border-slate-200 pl-2">
                      {entry.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (traceData.source_type === 'metric') {
      return (
        <div className="p-6">
          <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Thông tin truy vấn Metric</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Metric:</span> <span className="font-semibold text-slate-700">{traceData.metric_name} ({traceData.metric_code})</span></div>
              <div><span className="text-slate-500">Phép tính:</span> <span className="font-semibold text-slate-700 uppercase">{traceData.aggregation_method}</span></div>
              <div><span className="text-slate-500">Kỳ đánh giá:</span> <span className="font-semibold text-slate-700">{formatDate(traceData.date_from)} - {formatDate(traceData.date_to)}</span></div>
              <div><span className="text-slate-500">Tổng số bản ghi:</span> <span className="font-semibold text-indigo-600">{traceData.total_record_count}</span></div>
            </div>
          </div>
          
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Chi tiết bản ghi {traceData.truncated && <span className="text-amber-500 text-xs font-normal">(Chỉ hiển thị 100 bản ghi mới nhất)</span>}
          </h3>
          
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Ngày (Period Start)</th>
                  <th className="px-4 py-3">Giá trị</th>
                  <th className="px-4 py-3">Người/Đơn vị phụ trách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {traceData.details?.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(d.period_start)}</td>
                    <td className="px-4 py-2 font-bold text-indigo-600">{d.value}</td>
                    <td className="px-4 py-2 text-slate-600">{d.user_name || d.org_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (traceData.source_type === 'task') {
      return (
         <div className="p-6">
          <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Thông tin truy vấn Task</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Tiêu chí đo:</span> <span className="font-semibold text-slate-700">{traceData.measure}</span></div>
              <div><span className="text-slate-500">Kỳ đánh giá:</span> <span className="font-semibold text-slate-700">{formatDate(traceData.date_from)} - {formatDate(traceData.date_to)}</span></div>
              <div><span className="text-slate-500">Tổng số công việc:</span> <span className="font-semibold text-indigo-600">{traceData.total_record_count}</span></div>
            </div>
          </div>
          
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Chi tiết công việc {traceData.truncated && <span className="text-amber-500 text-xs font-normal">(Chỉ hiển thị 100 công việc mới nhất)</span>}
          </h3>
          
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Công việc</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3">Hạn chót</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {traceData.details?.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-900 font-medium">{d.title}</td>
                    <td className="px-4 py-2 text-center">
                       <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                         {d.status}
                       </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{d.due_date ? formatDate(d.due_date, true) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (traceData.source_type === 'calculated_metric') {
       return (
          <div className="p-6">
            <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg flex items-start gap-3">
               <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
               <div>
                  <h4 className="font-bold text-sm">Chỉ tiêu tổng hợp (Calculated Metric)</h4>
                  <p className="text-sm mt-1">{traceData.message}</p>
               </div>
            </div>
          </div>
       );
    }

    return null;
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-500" />
            Kiểm tra nguồn dữ liệu (Trace)
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
           {renderContent()}
        </div>
      </div>
    </>
  );
};
