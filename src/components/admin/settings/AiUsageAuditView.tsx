import React, { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { 
  Loader2, 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Copy, 
  Check 
} from 'lucide-react';

const getAccessToken = async (): Promise<string> => {
  const client = getSupabaseClient();
  if (!client) return '';
  const session = (await client.auth.getSession()).data.session;
  return session?.access_token || '';
};

export interface AiUsageLogAudit {
  id: string;
  request_id: string;
  correlation_id?: string;
  user_id?: string;
  task_type: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  total_tokens: number;
  is_estimated?: boolean;
  duration_ms: number;
  status: string;
  error_code?: string;
  estimated_cost?: number;
  created_at: string;
}

export const AiUsageAuditView: React.FC = () => {
  const [requests, setRequests] = useState<AiUsageLogAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<AiUsageLogAudit | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/ai-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error('Bạn không có quyền xem nhật ký kiểm toán AI (yêu cầu quyền ai.audit.view hoặc ai.usage.view).');
      }

      if (!res.ok) {
        let errMessage = 'Không thể tải dữ liệu nhật ký sử dụng AI từ máy chủ.';
        try {
          const body = await res.json();
          if (body?.error) errMessage = body.error;
        } catch {
          const text = await res.text().catch(() => '');
          if (text) errMessage = text;
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[AiUsageAuditView] Error loading logs:', err);
      // Clean up Supabase JSON dump if any
      let msg = err.message || 'Đã xảy ra lỗi không xác định khi tải dữ liệu.';
      if (msg.includes('schema cache') || msg.includes('PGRST')) {
        msg = 'Cơ sở dữ liệu đang cập nhật schema cache. Vui lòng thử lại sau vài giây.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'success' && req.status !== 'completed' && req.status !== 'succeeded') return false;
        if (statusFilter === 'failed' && req.status !== 'failed') return false;
        if (statusFilter === 'rate_limited' && req.status !== 'rate_limited') return false;
        if (statusFilter === 'started' && req.status !== 'started') return false;
      }

      if (providerFilter !== 'all' && req.provider.toLowerCase() !== providerFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTask = req.task_type?.toLowerCase().includes(query);
        const matchModel = req.model?.toLowerCase().includes(query);
        const matchReqId = req.request_id?.toLowerCase().includes(query);
        const matchErr = req.error_code?.toLowerCase().includes(query);
        if (!matchTask && !matchModel && !matchReqId && !matchErr) return false;
      }

      return true;
    });
  }, [requests, statusFilter, providerFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = requests.length;
    const successCount = requests.filter(r => r.status === 'completed' || r.status === 'succeeded').length;
    const failedCount = requests.filter(r => r.status === 'failed').length;
    const rateLimitedCount = requests.filter(r => r.status === 'rate_limited').length;
    const totalTokens = requests.reduce((acc, r) => acc + (Number(r.total_tokens) || 0), 0);
    const avgLatency = total > 0 ? Math.round(requests.reduce((acc, r) => acc + (Number(r.duration_ms) || 0), 0) / total) : 0;

    return { total, successCount, failedCount, rateLimitedCount, totalTokens, avgLatency };
  }, [requests]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Thành công
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Thất bại
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Bị giới hạn
          </span>
        );
      case 'started':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Đang chạy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Detail Modal / View
  if (selectedReq) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <button 
            onClick={() => setSelectedReq(null)} 
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            &larr; Quay lại danh sách nhật ký
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Mã bản ghi:</span>
            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">{selectedReq.id}</code>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-indigo-600" /> Chi tiết lượt gọi AI
            </h2>
            <p className="text-xs text-slate-500 mt-1">Thông tin vận hành và tài nguyên tiêu thụ của yêu cầu</p>
          </div>
          <div>{renderStatusBadge(selectedReq.status)}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thông tin định tuyến & Tác vụ</h3>
            <div>
              <span className="text-xs text-slate-500 block">Task Type / Nghiệp vụ:</span>
              <span className="text-sm font-semibold text-slate-800">{selectedReq.task_type}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Nhà cung cấp & Model:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 uppercase">{selectedReq.provider}</span>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">{selectedReq.model}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Thời gian tạo:</span>
              <span className="text-xs text-slate-700">{new Date(selectedReq.created_at).toLocaleString('vi-VN')}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hiệu năng & Tài nguyên</h3>
            <div>
              <span className="text-xs text-slate-500 block">Thời gian phản hồi (Latency):</span>
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <Clock className="w-4 h-4 text-slate-400" /> {selectedReq.duration_ms} ms
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Phân bổ Tokens:</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="bg-white p-2 rounded border border-slate-200 text-center">
                  <div className="text-[10px] text-slate-500">Input</div>
                  <div className="text-xs font-bold text-slate-800">{selectedReq.input_tokens.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200 text-center">
                  <div className="text-[10px] text-slate-500">Output</div>
                  <div className="text-xs font-bold text-slate-800">{selectedReq.output_tokens.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100 bg-indigo-50/30 text-center">
                  <div className="text-[10px] text-indigo-600 font-medium">Tổng Tokens</div>
                  <div className="text-xs font-bold text-indigo-700">{selectedReq.total_tokens.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trace IDs */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mã định danh truy vết (Trace IDs)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Request ID:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 font-mono break-all">{selectedReq.request_id}</code>
                <button 
                  onClick={() => handleCopy(selectedReq.request_id, 'req_id')} 
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Sao chép"
                >
                  {copiedId === 'req_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Correlation ID:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 font-mono break-all">{selectedReq.correlation_id || '(Không có)'}</code>
                {selectedReq.correlation_id && (
                  <button 
                    onClick={() => handleCopy(selectedReq.correlation_id || '', 'corr_id')} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Sao chép"
                  >
                    {copiedId === 'corr_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Info if Failed */}
        {selectedReq.error_code && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 space-y-2">
            <h3 className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Chi tiết lỗi (Error Information)
            </h3>
            <div className="text-xs text-red-700">
              <span className="font-semibold">Mã lỗi:</span> <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">{selectedReq.error_code}</code>
            </div>
          </div>
        )}

        {/* Privacy & Compliance Assurance */}
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800">
            <span className="font-semibold">Bảo mật & Quyền riêng tư:</span> Nhật ký kiểm toán AI được lưu trữ theo tiêu chuẩn không lưu nội dung Prompt, văn bản phản hồi, tin nhắn hội thoại hoặc khóa API (No PII / No Prompts stored).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Refresh */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" /> Nhật ký kiểm toán & Lượt dùng AI (Usage / Audit)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi tất cả lượt gọi AI, thời gian thực thi, số lượng Tokens và mã lỗi hệ thống
          </p>
        </div>
        <button 
          onClick={fetchRequests} 
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors self-start md:self-auto shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI & Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Tổng lượt gọi AI</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Trong 100 bản ghi gần nhất</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-emerald-600">Thành công</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.successCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tỷ lệ: {stats.total > 0 ? Math.round((stats.successCount / stats.total) * 100) : 0}%</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-red-600">Lỗi / Bị chặn</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.failedCount + stats.rateLimitedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lỗi: {stats.failedCount} | Rate limit: {stats.rateLimitedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-indigo-600">Tổng Tokens tiêu thụ</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{stats.totalTokens.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Độ trễ TB: {stats.avgLatency} ms</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">Không thể tải nhật ký kiểm toán AI</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo task, model, request ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="success">Thành công (completed)</option>
              <option value="failed">Thất bại (failed)</option>
              <option value="rate_limited">Bị giới hạn (rate_limited)</option>
              <option value="started">Đang chạy (started)</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả nhà cung cấp</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Thời gian</th>
                <th className="p-3.5">Nghiệp vụ / Task</th>
                <th className="p-3.5">Provider / Model</th>
                <th className="p-3.5">Độ trễ</th>
                <th className="p-3.5">Tokens</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Đang tải nhật ký kiểm toán AI...</span>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {searchQuery || statusFilter !== 'all' || providerFilter !== 'all' ? (
                      <div>Không tìm thấy lượt gọi AI phù hợp với bộ lọc.</div>
                    ) : (
                      <div>Chưa có lượt gọi AI nào được ghi nhận trong hệ thống.</div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3.5 font-medium text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {req.task_type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize font-semibold text-slate-800">{req.provider}</span>
                        <span className="text-slate-400">/</span>
                        <span className="font-mono text-slate-600">{req.model}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {req.duration_ms} ms
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                      {req.total_tokens ? req.total_tokens.toLocaleString() : '-'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {renderStatusBadge(req.status)}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button 
                        onClick={() => setSelectedReq(req)} 
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

