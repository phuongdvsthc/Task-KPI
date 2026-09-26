import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Building2, Calendar, Target, CheckCircle2, ListFilter, Filter, BarChart2, Inbox, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { kpiDashboardService } from '../../../../services/kpiDashboardService';
import { organizationService } from '../../../../services/organizationService';
import { 
  KpiDashboardFilters, 
  KpiDashboardSummary, 
  KpiDashboardKpiBreakdown, 
  KpiDashboardAssignmentItem,
  KpiAssignmentStatus
} from '../../../../types/kpi';
import { OrganizationUnit } from '../../../../types/database';

interface KpiUnitDetailViewProps {
  unitId: string;
  onBack: () => void;
  filters: KpiDashboardFilters;
}

export const KpiUnitDetailView: React.FC<KpiUnitDetailViewProps> = ({ unitId, onBack, filters }) => {
  
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard({ ...filters, unitId: unitId }, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<OrganizationUnit | null>(null);
  
  const [summary, setSummary] = useState<KpiDashboardSummary | null>(null);
  const [kpiBreakdown, setKpiBreakdown] = useState<KpiDashboardKpiBreakdown[]>([]);
  
  const [assignments, setAssignments] = useState<KpiDashboardAssignmentItem[]>([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const assignmentPageSize = 20;

  const loadUnitInfo = useCallback(async () => {
    try {
      const u = await organizationService.getUnitById(unitId);
      setUnit(u);
    } catch (err) {
      console.error('Error loading unit:', err);
    }
  }, [unitId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters = { ...filters, unitId };
      const [sumRes, kpiRes] = await Promise.all([
        kpiDashboardService.getSummary(activeFilters),
        kpiDashboardService.getKpiBreakdown(activeFilters)
      ]);

      if (sumRes.error) throw sumRes.error;
      
      setSummary(sumRes.data);
      setKpiBreakdown(kpiRes.data || []);
      
    } catch (err: any) {
      console.error('Error loading unit drilldown:', err);
      setError('Không thể tải dữ liệu KPI của đơn vị này. Có thể bạn không có quyền truy cập.');
    } finally {
      setLoading(false);
    }
  }, [unitId, filters]);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const activeFilters: KpiDashboardFilters = { 
        ...filters, 
        unitId,
        limit: assignmentPageSize,
        offset: (assignmentPage - 1) * assignmentPageSize
      };
      const res = await kpiDashboardService.getAssignments(activeFilters);
      if (res.error) throw res.error;
      setAssignments(res.data || []);
      setTotalAssignments(res.totalCount || 0);
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [unitId, filters, assignmentPage]);

  useEffect(() => {
    loadUnitInfo();
  }, [loadUnitInfo]);

  useEffect(() => {
    setAssignmentPage(1);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const activeAdvancedFilterCount = [
    filters.assigneeType !== 'all',
    filters.reviewStatus !== 'all',
    filters.completionStatus !== 'all',
    !!filters.effectiveFrom,
    !!filters.effectiveTo
  ].filter(Boolean).length;

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
        <div className="text-red-600 font-semibold">{error}</div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-800">Chi tiết KPI theo đơn vị</h1>
            </div>
            {unit ? (
              <p className="text-lg font-medium text-slate-700 mt-1">{unit.name}</p>
            ) : (
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mt-1" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{summary?.period_name || '...'}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 text-slate-400" />
            <span>
              {filters.resultMode === 'official' ? 'Chính thức' : filters.resultMode === 'live' ? 'Tạm tính' : 'Tất cả kết quả'}
            </span>
          </div>
          {activeAdvancedFilterCount > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5 text-indigo-600">
                <Filter className="h-4 w-4" />
                <span className="font-semibold">{activeAdvancedFilterCount} bộ lọc</span>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
          <p>Đang tải dữ liệu đơn vị...</p>
        </div>
      ) : summary ? (
        <>
          {/* SECTION 2: Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-600">Tổng KPI được giao</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.assignment_count}</p>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <ListFilter className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-600">Đang thực hiện</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.active_count}</p>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-600">Đã khóa</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.locked_count}</p>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <Inbox className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-600">Chưa đủ dữ liệu</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{summary.unscored_count + summary.partial_count}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">Điểm trung bình (Tạm tính)</h3>
              <p className="text-3xl font-bold text-indigo-700">
                {summary.live_average_score !== null ? summary.live_average_score : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Dựa trên {summary.live_scored_count} KPI đã có điểm</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">Điểm trung bình (Chính thức)</h3>
              <p className="text-3xl font-bold text-blue-700">
                {summary.official_average_score !== null ? summary.official_average_score : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Dựa trên {summary.official_scored_count} KPI đã chốt</p>
            </div>
          </div>

          {/* SECTION 3: KPI Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Phân bổ chỉ tiêu (KPI Breakdown)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">KPI</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Số lượt giao</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Đã có điểm</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Một phần</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Chưa có điểm</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Điểm tạm tính TB</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Điểm chính thức TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpiBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Chưa có KPI phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    kpiBreakdown.map((row) => (
                      <tr key={row.kpi_key} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{row.kpi_name}</div>
                          {row.kpi_code && <div className="text-xs text-slate-500 mt-0.5">{row.kpi_code}</div>}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">{row.assignment_count}</td>
                        <td className="px-4 py-3 text-center text-sm text-emerald-600">{row.scored_count}</td>
                        <td className="px-4 py-3 text-center text-sm text-amber-600">{row.partial_count}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-400">{row.unscored_count}</td>
                        <td className="px-4 py-3 text-right font-medium text-indigo-700">
                          {row.live_average_score !== null ? row.live_average_score : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-700">
                          {row.official_average_score !== null ? row.official_average_score : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: Assignment List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Danh sách KPI được giao</h2>
              {assignmentsLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Đối tượng</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Loại ĐT</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Đơn vị (LS)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">T/gian áp dụng</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Trạng thái KPI</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">TT Đánh giá</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Kết quả</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Điểm</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignmentsLoading && assignments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : assignments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Chưa có KPI được giao trong phạm vi đang chọn.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-slate-800">
                            {item.assignee_type === 'individual' ? item.assignee_name : item.assignee_organization_unit_name || item.assignee_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.assignee_type === 'individual' ? 'Cá nhân' : 'Đơn vị'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.assignee_type === 'individual' ? (item.assignee_unit_name || item.unit_name || '—') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-500 whitespace-nowrap">
                          {item.effective_from ? new Date(item.effective_from).toLocaleDateString('vi-VN') : '—'}<br/>
                          {item.effective_to ? new Date(item.effective_to).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            item.assignment_status === 'locked' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            item.assignment_status === 'closed' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                            item.assignment_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {item.assignment_status === 'locked' ? 'Đã khóa' : item.assignment_status === 'closed' ? 'Đã đóng' : item.assignment_status === 'active' ? 'Đang TH' : item.assignment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.review_status === 'approved' ? 'Đã duyệt' : 
                           item.review_status === 'in_review' ? 'Đang xem xét' : 
                           item.review_status === 'returned' ? 'Yêu cầu làm lại' : 'Chưa đánh giá'}
                        </td>
                        <td className="px-4 py-3">
                           <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            item.result_mode === 'official' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {item.result_mode === 'official' ? 'Chính thức' : 'Tạm tính'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-slate-800">
                            {item.total_score !== null && item.total_score !== undefined ? item.total_score : '—'}
                          </div>
                          {item.result_status && item.result_status !== 'complete' && (
                            <div className="text-[10px] text-amber-600 font-medium mt-0.5">{item.result_status === 'partial' ? 'Một phần' : 'Chưa có điểm'}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { 
                              const base = window.location.hash.startsWith('#/kpis/executive-dashboard') ? '#/kpis/executive-dashboard' : '#/kpis/dashboard';
                              window.location.hash = `${base}/unit/${unitId}/assignment/${item.id}`; 
                            }}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium transition-colors"
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
            
            {totalAssignments > assignmentPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Hiển thị {(assignmentPage - 1) * assignmentPageSize + 1} - {Math.min(assignmentPage * assignmentPageSize, totalAssignments)} trong {totalAssignments}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssignmentPage(p => Math.max(1, p - 1))}
                    disabled={assignmentPage === 1 || assignmentsLoading}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAssignmentPage(p => p + 1)}
                    disabled={assignmentPage * assignmentPageSize >= totalAssignments || assignmentsLoading}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
