import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { dashboardApiClient, ReportingOptionsResponse } from '../../services/dashboardApiClient';
import { RefreshCw, AlertCircle, CheckSquare, FileText, BarChart2, Award, Clock, AlertTriangle, CheckCircle2, Calendar, FileCheck, Users, Building2, TrendingUp, Target, Eye } from 'lucide-react';
import { UnifiedDashboardResponse } from '../../services/dashboardReportingService';
import { TrendCharts } from '../executive/TrendCharts';
import { UnitComparisonCharts } from './UnitComparisonCharts';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';

const formatCount = (val: any) => (val === undefined || val === null) ? 'Chưa có dữ liệu' : Number(val).toLocaleString('vi-VN');
const formatPercent = (val: any) => (val === undefined || val === null) ? 'Chưa có dữ liệu' : `${Number(val).toFixed(1)}%`;

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  state?: 'neutral' | 'success' | 'warning' | 'danger';
  accessibleLabel?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon: Icon, state = 'neutral', accessibleLabel }) => {
  const stateStyles = {
    neutral: 'bg-white border-slate-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-rose-50 border-rose-200',
  };
  return (
    <div 
      className={`p-4 rounded-xl border ${stateStyles[state]}`}
      aria-label={accessibleLabel || label}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />}
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

export const ExecutiveDashboardView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [options, setOptions] = useState<ReportingOptionsResponse | null>(null);
  const [data, setData] = useState<UnifiedDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportingUnitId, setReportingUnitId] = useState<string | null>(null);
  const [comparisonUnitIds, setComparisonUnitIds] = useState<string[]>([]);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const comparisonAbortControllerRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const opts = await dashboardApiClient.getReportingOptions();
      setOptions(opts);
      const dashboard = await dashboardApiClient.getStaffDashboard({
          ...(reportingUnitId ? { organization_unit_id: reportingUnitId } : {})
      }, controller.signal);
      setData(dashboard);
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setLoading(false);
    }
  }, [reportingUnitId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadComparisonData = useCallback(async () => {
    if (comparisonUnitIds.length < 2) return;

    if (comparisonAbortControllerRef.current) {
        comparisonAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    comparisonAbortControllerRef.current = controller;

    setComparisonLoading(true);
    try {
        const compData = await dashboardApiClient.getUnitComparison({
            comparison_unit_ids: comparisonUnitIds,
            date_from: '2026-01-01', // Should use date filters if available
            date_to: '2026-12-31'
        }, controller.signal);
        setComparisonData(compData);
    } catch (e: any) {
        if (e.name !== 'AbortError') console.error(e);
    } finally {
        setComparisonLoading(false);
    }
  }, [comparisonUnitIds]);

  useEffect(() => { loadComparisonData(); }, [loadComparisonData]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (comparisonAbortControllerRef.current) comparisonAbortControllerRef.current.abort();
    };
  }, []);

  const organizationUnits = options?.organization_units || [];
  const selectedUnit = organizationUnits.find(u => u.id === reportingUnitId);
  const scopeLabel = selectedUnit ? `Phạm vi: ${selectedUnit.name}` : 'Phạm vi: Toàn trường';

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        {isAdmin && (
          <div id="admin-readonly-executive-banner" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium shadow-2xs">
            <Eye className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Chế độ xem báo cáo:</strong> Quản trị viên đang xem dữ liệu toàn trường ở chế độ chỉ đọc.
            </span>
          </div>
        )}
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2 text-indigo-600" />
          <span>Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 p-6">
        {isAdmin && (
          <div id="admin-readonly-executive-banner" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium shadow-2xs">
            <Eye className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Chế độ xem báo cáo:</strong> Quản trị viên đang xem dữ liệu toàn trường ở chế độ chỉ đọc.
            </span>
          </div>
        )}
        <div className="p-6 text-slate-500">Chưa có dữ liệu.</div>
      </div>
    );
  }

  const { operations, metrics, kpis } = data.summary || { operations: { tasks: null, daily_reports: null }, metrics: null, kpis: null };
  const { tasks, daily_reports: dailyReports } = operations || {};

  return (
    <div className="space-y-6 p-6">
      {/* Admin Read-only Reporting Mode Banner */}
      {isAdmin && (
        <div id="admin-readonly-executive-banner" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium shadow-2xs">
          <Eye className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Chế độ xem báo cáo:</strong> Quản trị viên đang xem dữ liệu toàn trường ở chế độ chỉ đọc.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tổng quan toàn trường</h1>
          <p className="text-slate-500">Theo dõi công việc, báo cáo, chỉ số và KPI toàn trường.</p>
          <div className="mt-2 font-semibold text-indigo-700">{scopeLabel}</div>
        </div>
        <div className="flex items-center gap-2">
            <select className="p-2 border rounded-lg" onChange={(e) => setReportingUnitId(e.target.value || null)}>
                <option value="">Toàn trường</option>
                {organizationUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={loadData} className="p-2 border rounded-lg"><RefreshCw size={20} /></button>
        </div>
      </div>
      
      <section>
        <h2 className="text-lg font-semibold mb-3">Tình hình công việc</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard label="Tổng công việc" value={formatCount(tasks?.total_tasks)} icon={CheckSquare} />
            <SummaryCard label="Đã hoàn thành" value={formatCount(tasks?.completed_tasks)} icon={CheckCircle2} state="success" />
            <SummaryCard label="Đang thực hiện" value={formatCount(tasks?.in_progress_tasks)} icon={Clock} />
            <SummaryCard label="Quá hạn" value={formatCount(tasks?.overdue_tasks)} icon={AlertTriangle} state="danger" />
            <SummaryCard label="Tỷ lệ hoàn thành" value={formatPercent(tasks?.completion_rate)} icon={Award} state="success" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Tình hình báo cáo hằng ngày</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Lượt ngày cần báo cáo" value={formatCount(dailyReports?.expected_reporting_days)} icon={Calendar} />
            <SummaryCard label="Lượt ngày đã báo cáo" value={formatCount(dailyReports?.submitted_reports)} icon={FileCheck} state="success" />
            <SummaryCard label="Lượt ngày còn thiếu" value={formatCount(dailyReports?.missing_reports)} icon={AlertCircle} state="warning" />
            <SummaryCard label="Tỷ lệ hoàn thành báo cáo" value={formatPercent(dailyReports?.reporting_completion_rate)} icon={Award} state="success" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Dữ liệu chỉ số công việc</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Số chỉ số có dữ liệu" value={formatCount(metrics?.metric_definition_count)} icon={BarChart2} />
            <SummaryCard label="Lượt ghi nhận" value={formatCount(metrics?.metric_entry_count)} icon={TrendingUp} />
            <SummaryCard label="Nhân viên có dữ liệu" value={formatCount(metrics?.employee_count)} icon={Users} />
            <SummaryCard label="Nguồn có dữ liệu" value={formatCount(metrics?.source_count)} icon={Building2} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">KPI toàn trường</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="KPI được giao" value={formatCount(kpis?.assignment_count)} icon={Target} />
            <SummaryCard label="KPI đạt" value={formatCount(kpis?.achieved_count)} icon={Award} state="success" />
            <SummaryCard label="KPI chờ đánh giá" value={formatCount(kpis?.pending_review_count)} icon={Clock} state="warning" />
            <SummaryCard label="Tỷ lệ hoàn thành" value={formatPercent(kpis?.completion_rate)} icon={Award} state="success" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">So sánh đơn vị</h2>
        <p className="text-sm text-slate-500 mb-2">Đối chiếu tình hình công việc, báo cáo và KPI giữa các đơn vị đã chọn.</p>
        
        {comparisonUnitIds.length === 0 && <p className="text-slate-500">Chọn ít nhất hai đơn vị để xem bảng so sánh.</p>}
        {comparisonUnitIds.length === 1 && <p className="text-slate-500">Hãy chọn thêm một đơn vị để thực hiện so sánh.</p>}
        {comparisonUnitIds.length >= 2 && (
            comparisonLoading ? <p>Đang tải...</p> : (
                <>
                    <UnitComparisonCharts data={comparisonData} />
                    <div className="overflow-x-auto mt-6">
                        <table className="w-full text-sm" aria-label="Bảng so sánh hiệu suất giữa các đơn vị">
                            <caption className="sr-only">Bảng so sánh số liệu công việc hoàn thành, quá hạn, thiếu báo cáo và kpi đạt giữa các đơn vị</caption>
                            <thead className="bg-slate-50 border-b">
                            <tr>
                                <th scope="col" className="p-2 text-left">Đơn vị</th>
                                <th scope="col" className="p-2 text-right">Công việc hoàn thành</th>
                                <th scope="col" className="p-2 text-right">Công việc quá hạn</th>
                                <th scope="col" className="p-2 text-right">Báo cáo thiếu</th>
                                <th scope="col" className="p-2 text-right">KPI đạt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonData.map(row => (
                                <tr key={row.organization_unit.id} className="border-b">
                                    <td className="p-2">{row.organization_unit.name}</td>
                                    <td className="p-2 text-right">{formatCount(row.tasks.completed_tasks)}</td>
                                    <td className="p-2 text-right">{formatCount(row.tasks.overdue_tasks)}</td>
                                    <td className="p-2 text-right">{formatCount(row.daily_reports.missing_reports)}</td>
                                    <td className="p-2 text-right">{formatCount(row.kpis.achieved)}</td>
                                </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </>
            )
        )}
      </section>
    </div>
  );
};
