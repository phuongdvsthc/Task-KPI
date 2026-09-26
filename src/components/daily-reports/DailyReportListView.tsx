import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, FileText, AlertCircle, RefreshCw, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dailyReportService } from '../../services/daily-report.service';
import { DailyReport } from '../../types/daily-report';

export const DailyReportListView: React.FC = () => {
  const { user, systemRole, isLoading: isAuthLoading } = useAuth();
  const navigate = (path: string) => { window.location.hash = `#${path}`; };
  
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      setError(null);

      // For Staff: load reports where daily_reports.user_id = current user id
      // Does not filter by organization_unit_id for personal history
      let data: DailyReport[] = [];
      data = await dailyReportService.getMyDailyReports(user.id);
      
      setReports(data || []);
    } catch (err: any) {
      console.error('[DailyReportListView] Failed to load daily reports:', err);
      setError(err.message || 'Không thể tải danh sách báo cáo hằng ngày.');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (user) {
      fetchReports();
    } else {
      setIsLoading(false);
    }
  }, [user, isAuthLoading, fetchReports]);

  const getSourceLabel = (report: DailyReport) => {
    return report.report_sources?.name || report.report_source?.name || report.source_channel || '—';
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Đi làm':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Làm online':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Nghỉ phép':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Công tác':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Trực sự kiện':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (isAuthLoading || (isLoading && reports.length === 0 && !error)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm font-medium text-slate-500">Đang tải danh sách báo cáo hằng ngày...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-indigo-600" />
            Báo cáo hằng ngày
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi và quản lý lịch sử báo cáo công việc và chỉ số hoạt động cá nhân
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {systemRole === 'staff' && (
            <button
              onClick={() => navigate('/daily-reports/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Tạo báo cáo
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-xs">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-red-100 p-2.5 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-red-800 mb-1">Lỗi tải danh sách báo cáo</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={fetchReports}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto mb-3.5 inline-flex items-center justify-center rounded-full bg-slate-100 p-3 text-slate-400">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Chưa có báo cáo nào</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
            Bạn chưa tạo báo cáo hằng ngày nào trong hệ thống. Hãy tạo báo cáo đầu tiên để ghi nhận chỉ số công việc.
          </p>
          {systemRole === 'staff' && (
            <button
              onClick={() => navigate('/daily-reports/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Tạo báo cáo đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kênh / Nguồn</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nội dung công việc</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {report.report_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                      {getSourceLabel(report)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusBadgeClass(report.work_status)}`}>
                        {report.work_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={report.work_summary || ''}>
                      {report.work_summary || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {systemRole === 'staff' && (
                        <button
                          onClick={() => navigate(`/daily-reports/${report.id}/edit`)}
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-900 font-medium transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                          Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Tổng cộng: <strong>{reports.length}</strong> báo cáo</span>
          </div>
        </div>
      )}
    </div>
  );
};

