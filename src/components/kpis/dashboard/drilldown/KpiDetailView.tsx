import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Target, BarChart3, AlertCircle, Loader2, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { kpiDashboardService } from '../../../../services/kpiDashboardService';
import { KpiDashboardFilters, KpiDashboardKpiBreakdown, KpiDashboardKpiUnitBreakdown, KpiDashboardAssignmentItem } from '../../../../types/kpi';

interface KpiDetailViewProps {
  kpiKey: string;
  filters: KpiDashboardFilters;
  onBack: () => void;
  onNavigateToAssignment?: (assignmentId: string) => void;
}

export const KpiDetailView: React.FC<KpiDetailViewProps> = ({ kpiKey, filters, onBack, onNavigateToAssignment }) => {
  const { profile } = useAuth();
  
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard({ ...filters, kpiKey: kpiKey }, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<KpiDashboardKpiBreakdown | null>(null);
  const [unitDist, setUnitDist] = useState<KpiDashboardKpiUnitBreakdown[]>([]);
  const [assignments, setAssignments] = useState<KpiDashboardAssignmentItem[]>([]);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadSummaryAndUnits();
    setPage(1);
    loadAssignments(1);
  }, [filters, kpiKey]);

  const loadSummaryAndUnits = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryReq = kpiDashboardService.getKpiBreakdown({ ...filters, kpiKey });
      const unitDistReq = kpiDashboardService.getKpiUnitBreakdown({ ...filters, kpiKey });
      
      const [sumRes, unitRes] = await Promise.all([summaryReq, unitDistReq]);
      
      if (sumRes.error) throw sumRes.error;
      if (unitRes.error) throw new Error(typeof unitRes.error === 'string' ? unitRes.error : 'Unknown error');
      
      // KpiBreakdown should return an array of 1
      const sumItem = (sumRes.data || []).length > 0 ? sumRes.data![0] : null;
      setSummary(sumItem);
      
      setUnitDist(unitRes.data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu KPI.');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async (pageNum: number) => {
    setLoadingAssignments(true);
    try {
      const offset = (pageNum - 1) * PAGE_SIZE;
      const res = await kpiDashboardService.getAssignments({ ...filters, kpiKey, limit: PAGE_SIZE + 1, offset });
      if (res.error) throw res.error;
      
      const data = res.data || [];
      if (data.length > PAGE_SIZE) {
        setHasMore(true);
        setAssignments(data.slice(0, PAGE_SIZE));
      } else {
        setHasMore(false);
        setAssignments(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleNextPage = () => {
    const next = page + 1;
    setPage(next);
    loadAssignments(next);
  };
  const handlePrevPage = () => {
    if (page > 1) {
      const prev = page - 1;
      setPage(prev);
      loadAssignments(prev);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Chi tiết KPI</h1>
        </div>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <p>{error || 'Không tìm thấy KPI.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-800">{summary.kpi_name}</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500 rounded border border-slate-200">
                Chỉ xem
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{summary.kpi_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span>Kỳ: <strong className="text-slate-800">{filters.periodId}</strong></span>
          </div>
          <div className="px-3 py-1 bg-slate-100 rounded-full font-medium text-slate-700">
            {filters.resultMode === 'official' ? 'Chính thức' : filters.resultMode === 'live' ? 'Tạm tính' : 'Tất cả kết quả'}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Số lượt giao</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{summary.assignment_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Số dòng KPI</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{summary.item_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Đã có điểm</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.scored_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Một phần</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.partial_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chưa có điểm</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{summary.unscored_count || 0}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Tạm tính (Live)</p>
            <p className="text-sm text-indigo-500 mt-1">{summary.live_count || 0} kết quả</p>
          </div>
          <div className="text-right">
             <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Điểm trung bình</p>
             <p className="text-2xl font-bold text-indigo-700">{summary.live_average_score !== null ? summary.live_average_score.toFixed(1) : '—'}</p>
          </div>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Chính thức (Official)</p>
            <p className="text-sm text-emerald-500 mt-1">{summary.official_count || 0} kết quả</p>
          </div>
          <div className="text-right">
             <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Điểm trung bình</p>
             <p className="text-2xl font-bold text-emerald-700">{summary.official_average_score !== null ? summary.official_average_score.toFixed(1) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Unit Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            Phân bổ theo Đơn vị
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Đơn vị</th>
                <th className="p-4 text-center">Số lượt giao</th>
                <th className="p-4 text-center">Đã có điểm</th>
                <th className="p-4 text-center">Một phần</th>
                <th className="p-4 text-center">Chưa có điểm</th>
                <th className="p-4 text-right">Điểm tạm tính TB</th>
                <th className="p-4 text-right">Điểm chính thức TB</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {unitDist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Chưa có dữ liệu đơn vị cho KPI này.
                  </td>
                </tr>
              ) : (
                unitDist.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{u.unit_name}</td>
                    <td className="p-4 text-center text-slate-600">{u.assignment_count}</td>
                    <td className="p-4 text-center text-emerald-600">{u.scored_count}</td>
                    <td className="p-4 text-center text-amber-600">{u.partial_count}</td>
                    <td className="p-4 text-center text-slate-500">{u.unscored_count}</td>
                    <td className="p-4 text-right font-medium text-indigo-600">
                      {u.live_average_score !== null ? u.live_average_score.toFixed(1) : '—'}
                    </td>
                    <td className="p-4 text-right font-medium text-emerald-600">
                      {u.official_average_score !== null ? u.official_average_score.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            Danh sách giao KPI
          </h2>
          {loadingAssignments && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Đối tượng</th>
                <th className="p-4">Đơn vị</th>
                <th className="p-4">Loại</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Kết quả</th>
                <th className="p-4 text-right">Điểm tổng</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {assignments.length === 0 && !loadingAssignments ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Chưa có KPI này trong phạm vi đang chọn.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">
                      {a.assignee_type === 'individual' ? a.assignee_name : a.assignee_organization_unit_name}
                    </td>
                    <td className="p-4 text-slate-600">
                      {a.assignee_type === 'individual' ? (a.assignee_unit_name || a.assignee_organization_unit_name) : a.assignee_organization_unit_name}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                        {a.assignee_type === 'individual' ? 'Cá nhân' : 'Đơn vị'}
                      </span>
                    </td>
                    <td className="p-4">
                      {a.status === 'locked' ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium">Chính thức</span>
                      ) : (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">Đang TH</span>
                      )}
                    </td>
                    <td className="p-4">
                      {a.result_status === 'complete' ? (
                        <span className="text-emerald-600 font-medium text-xs border border-emerald-200 bg-emerald-50 px-2 py-1 rounded">Hoàn thành</span>
                      ) : a.result_status === 'partial' ? (
                        <span className="text-amber-600 font-medium text-xs border border-amber-200 bg-amber-50 px-2 py-1 rounded">Một phần</span>
                      ) : (
                        <span className="text-slate-500 font-medium text-xs border border-slate-200 bg-slate-50 px-2 py-1 rounded">Chưa có điểm</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-800">
                      {a.total_score !== null ? a.total_score.toFixed(1) : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => onNavigateToAssignment && onNavigateToAssignment(a.id)}
                        className="text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
          <button
            onClick={handlePrevPage}
            disabled={page === 1 || loadingAssignments}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium disabled:opacity-50 disabled:bg-slate-50 transition-colors"
          >
            Trang trước
          </button>
          <span className="text-slate-600 font-medium">Trang {page}</span>
          <button
            onClick={handleNextPage}
            disabled={!hasMore || loadingAssignments}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium disabled:opacity-50 disabled:bg-slate-50 transition-colors"
          >
            Trang tiếp
          </button>
        </div>
      </div>
    </div>
  );
};
