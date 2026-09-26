/**
 * Admission Overview Dashboard
 * Displays recruitment overview, KPIs, charts, campaign progress table, data quality warnings,
 * and Google Sheets sync summary.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '../../common/SafeResponsiveContainer';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Filter,
  RotateCcw,
  ShieldAlert,
  FileSpreadsheet,
  Check,
  Calendar,
  Building,
  Target,
  ChevronRight,
  Info,
  Download,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useAuthorization } from '../../../context/AuthorizationContext';
import {
  admissionDashboardService,
  AdmissionDashboardFilters,
  AdmissionDashboardData,
} from '../../../services/admissionDashboardService';
import {
  exportAdmissionDashboardToExcel,
  exportCampaignsTableToExcel,
  exportProgramsTableToExcel,
} from '../../../utils/admissionExcelExport';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export const formatVietnamDate = (isoString?: string | null): string => {
  if (!isoString) return 'Chưa có dữ liệu';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Chưa có dữ liệu';
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formatter.format(d);
  } catch {
    return 'Chưa có dữ liệu';
  }
};

export const AdmissionOverviewDashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const { can, isReady, isLoading: isAuthLoading } = useAuthorization();
  const hasAccess = can('admissions.view');

  const [filters, setFilters] = useState<AdmissionDashboardFilters>({
    year: 2026,
    groupId: '',
    campaignId: '',
    status: 'all',
    dataMode: 'current',
  });

  const [data, setData] = useState<AdmissionDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<any | null>(null);

  const handleExportAllExcel = async () => {
    if (!data || isExporting) return;
    try {
      setIsExporting(true);
      const currentGroup = data.groups?.find((g: any) => g.id === filters.groupId);
      const currentCampaign = data.campaigns?.find((c: any) => c.id === filters.campaignId);
      const currentStaff = data.staffList?.find((s: any) => s.id === filters.assigneeId);

      await exportAdmissionDashboardToExcel(data, filters, {
        year: filters.year,
        groupName: currentGroup?.name,
        campaignName: currentCampaign?.name,
        assigneeName: currentStaff?.full_name,
      });
    } catch (err: any) {
      console.error('[AdmissionOverviewDashboard] Export error:', err);
      alert('Không thể xuất báo cáo Excel: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCampaignsExcel = async () => {
    if (!data || isExporting) return;
    try {
      setIsExporting(true);
      const currentGroup = data.groups?.find((g: any) => g.id === filters.groupId);
      await exportCampaignsTableToExcel(
        data.campaignProgress,
        filters.year,
        currentGroup ? `Nhóm ${currentGroup.name}` : undefined
      );
    } catch (err: any) {
      console.error('[AdmissionOverviewDashboard] Export campaigns error:', err);
      alert('Không thể xuất báo cáo đợt tuyển sinh: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportProgramsExcel = async () => {
    if (!data || isExporting) return;
    try {
      setIsExporting(true);
      const currentCampaign = data.campaigns?.find((c: any) => c.id === filters.campaignId);
      await exportProgramsTableToExcel(
        data.programItems,
        filters.year,
        currentCampaign?.name
      );
    } catch (err: any) {
      console.error('[AdmissionOverviewDashboard] Export programs error:', err);
      alert('Không thể xuất báo cáo ngành/lớp: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  const loadData = useCallback(async (currentFilters: AdmissionDashboardFilters) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await admissionDashboardService.getDashboardData(currentFilters);
      setData(res);
      // If year wasn't set or default changed
      if (!currentFilters.year && res.availableYears.length > 0) {
        setFilters(prev => ({ ...prev, year: res.availableYears[0] }));
      }
    } catch (err: any) {
      console.error('[AdmissionOverviewDashboard] Error loading dashboard:', err);
      setError(err.message || 'Không thể tải dữ liệu tổng quan tuyển sinh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadData(filters);
    }
  }, [filters.year, filters.groupId, filters.campaignId, filters.status, filters.dataMode, hasAccess, loadData]);

  if (isAuthLoading || !isReady) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-xs border border-slate-200 text-center my-8">
        <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-slate-500 text-sm font-medium">Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div id="admission-dashboard-no-access" className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-xs border border-slate-200 text-center my-8">
        <ShieldAlert className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Bạn không có quyền truy cập</h2>
        <p className="text-slate-600 max-w-md">
          Chức năng Dashboard tổng quan tuyển sinh yêu cầu quyền 'admissions.view'.
        </p>
      </div>
    );
  }

  const handleFilterChange = (key: keyof AdmissionDashboardFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      year: data?.availableYears[0] || 2026,
      groupId: '',
      campaignId: '',
      status: 'all',
      dataMode: 'current',
    });
  };

  const getFulfillmentColorClass = (rate: number) => {
    if (rate < 50) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (rate < 80) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (rate < 100) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const hasAnySource = data ? data.campaignProgress.some(cp => cp.dataSource) : false;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Mode Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-indigo-600" />
            <span>Dashboard tổng quan tuyển sinh</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Theo dõi kế hoạch, tiến độ và kết quả tuyển sinh theo năm, nhóm và đợt tuyển sinh.
          </p>
          <p id="admission-dashboard-last-updated" className="text-xs text-slate-500 mt-1.5 font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              Dữ liệu cập nhật đến ngày: <strong className="font-semibold text-slate-700">{formatVietnamDate(data?.lastUpdatedAt)}</strong>
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
            filters.dataMode === 'finalized_only' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <Info className="h-4 w-4" />
            <span>Chế độ: {filters.dataMode === 'finalized_only' ? 'Số liệu đã chốt' : 'Tiến độ hiện tại (Nháp + Đã chốt)'}</span>
          </div>
          <button
            type="button"
            id="export-admission-dashboard-excel"
            onClick={handleExportAllExcel}
            disabled={isExporting || isLoading || !data}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Xuất toàn bộ bảng thống kê và KPI tuyển sinh ra tệp Excel (.xlsx)"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Đang xuất file...' : 'Xuất Excel'}</span>
          </button>
          <button
            type="button"
            onClick={() => loadData(filters)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Year Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Năm tuyển sinh</label>
          <select
            value={filters.year}
            onChange={(e) => handleFilterChange('year', Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(data?.availableYears || [2026, 2027, 2028, 2029, 2030]).map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>

        {/* Group Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Nhóm tuyển sinh</label>
          <select
            value={filters.groupId || ''}
            onChange={(e) => handleFilterChange('groupId', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả nhóm</option>
            {(data?.groups || []).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Campaign Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Đợt tuyển sinh</label>
          <select
            value={filters.campaignId || ''}
            onChange={(e) => handleFilterChange('campaignId', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả các đợt</option>
            {(data?.campaigns || []).map(c => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        {/* Result Status Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Trạng thái kết quả</label>
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="finalized">Đã chốt</option>
          </select>
        </div>

        {/* Data Mode Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Chế độ dữ liệu</label>
          <select
            value={filters.dataMode || 'current'}
            onChange={(e) => handleFilterChange('dataMode', e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="current">Tiến độ hiện tại (Nháp + Đã chốt)</option>
            <option value="finalized_only">Số liệu đã chốt (Chỉ Đã chốt)</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5 flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Đặt lại bộ lọc</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-2xl shadow-xs border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Đang tổng hợp dữ liệu tổng quan...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Annual Plan */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-600">
                <Target className="h-16 w-16" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kế hoạch năm {filters.year}</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{formatNumber(data.kpis.annualPlan)}</h3>
              <p className="text-xs text-slate-500 mt-1">Tổng chỉ tiêu kế hoạch toàn năm</p>
            </div>

            {/* 2. Allocated Plan */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600">
                <Calendar className="h-16 w-16" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã phân bổ theo đợt</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{formatNumber(data.kpis.allocatedPlan)}</h3>
              <p className="text-xs text-slate-500 mt-1">Chỉ tiêu phân bổ cho các đợt</p>
            </div>

            {/* 3. Registered Count */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600">
                <Users className="h-16 w-16" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ đăng ký</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{formatNumber(data.kpis.registeredCount)}</h3>
              <p className="text-xs text-slate-500 mt-1">Tổng số hồ sơ tiếp nhận</p>
            </div>

            {/* 4. Paid Count */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600">
                <CheckCircle2 className="h-16 w-16" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã đóng học phí</p>
              <h3 className="text-3xl font-extrabold text-emerald-700 mt-2">{formatNumber(data.kpis.paidCount)}</h3>
              <p className="text-xs text-slate-500 mt-1">Hồ sơ hoàn thành học phí</p>
            </div>

            {/* 5. Conversion Rate */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ chuyển đổi</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{data.kpis.conversionRate}%</h3>
              </div>
              <p className="text-xs text-slate-500 mt-2">Đã đóng học phí / Đăng ký</p>
            </div>

            {/* 6. Plan Fulfillment Rate */}
            <div className={`p-5 rounded-2xl shadow-xs border flex flex-col justify-between ${getFulfillmentColorClass(data.kpis.fulfillmentRate)}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Tỷ lệ thực hiện kế hoạch</p>
                <h3 className="text-3xl font-extrabold mt-2">{data.kpis.fulfillmentRate}%</h3>
              </div>
              <p className="text-xs mt-2 opacity-80">Đã đóng học phí / Kế hoạch năm</p>
            </div>

            {/* 7. Remaining Count / Excess */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {data.kpis.isExcess ? 'Vượt kế hoạch' : 'Còn thiếu so với kế hoạch'}
                </p>
                <h3 className={`text-3xl font-extrabold mt-2 ${data.kpis.isExcess ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {formatNumber(data.kpis.isExcess ? data.kpis.excessCount : data.kpis.remainingCount)}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {data.kpis.isExcess ? 'Vượt chỉ tiêu năm' : 'Cần tuyển thêm để đạt kế hoạch'}
              </p>
            </div>

            {/* 8. Finalized Campaigns */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Số đợt đã chốt</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                  {data.kpis.finalizedCampaignsCount} <span className="text-sm font-normal text-slate-500">/ {data.kpis.totalCampaignsWithResults} đợt</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-2">Đợt có kết quả đã được chốt</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* A. Group Performance Bar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Kế hoạch và kết quả theo nhóm tuyển sinh</h3>
              {data.groupPerformance.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu nhóm tuyển sinh.</div>
              ) : (
                <div className="h-72 w-full">
                  <SafeResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.groupPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="groupName" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="annualPlan" name="Kế hoạch năm" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="registeredCount" name="Hồ sơ đăng ký" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paidCount" name="Đã đóng học phí" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              )}
            </div>

            {/* B. Campaign Progress Bar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Tiến độ theo đợt tuyển sinh (Top đợt gần nhất)</h3>
              {data.campaignProgress.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu đợt tuyển sinh.</div>
              ) : (
                <div className="h-72 w-full">
                  <SafeResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.campaignProgress.slice(0, 8)} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="campaignCode" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="allocatedPlan" name="Phân bổ đợt" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="registeredCount" name="Đăng ký" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paidCount" name="Đóng học phí" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* C. Campaign Results Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chi tiết kết quả theo đợt tuyển sinh</h3>
                <p className="text-sm text-slate-500 mt-0.5">Danh sách các đợt tuyển sinh và số liệu thực hiện</p>
              </div>
              <button
                type="button"
                id="export-campaigns-table-excel"
                onClick={handleExportCampaignsExcel}
                disabled={isExporting || !data || data.campaignProgress.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                title="Xuất bảng kết quả theo đợt tuyển sinh ra Excel"
              >
                <Download className="h-4 w-4" />
                <span>Xuất Excel</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4">STT</th>
                    <th className="p-4">Nhóm & Đợt</th>
                    <th className="p-4">Thời gian</th>
                    <th className="p-4 text-right">Phân bổ</th>
                    <th className="p-4 text-right">Đăng ký</th>
                    <th className="p-4 text-right">Đã đóng HP</th>
                    <th className="p-4 text-right">Tỷ lệ CĐ</th>
                    <th className="p-4 text-right">Tỷ lệ TH</th>
                    <th className="p-4 text-center">Trạng thái</th>
                    {hasAnySource && <th className="p-4">Nguồn</th>}
                    <th className="p-4">Cập nhật gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                  {data.campaignProgress.length === 0 ? (
                    <tr>
                      <td colSpan={hasAnySource ? 11 : 10} className="p-8 text-center text-slate-400">
                        Không có dữ liệu đợt tuyển sinh phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    data.campaignProgress.map((cp, idx) => (
                      <tr key={cp.campaignId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 text-slate-500 font-medium">{idx + 1}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{cp.campaignName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{cp.campaignCode}</span>
                            <span className="text-xs text-slate-500">({cp.groupName})</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {cp.startDate ? new Date(cp.startDate).toLocaleDateString('vi-VN') : '—'} → {cp.endDate ? new Date(cp.endDate).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="p-4 text-right font-semibold">{formatNumber(cp.allocatedPlan)}</td>
                        <td className="p-4 text-right font-semibold text-blue-600">{formatNumber(cp.registeredCount)}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">{formatNumber(cp.paidCount)}</td>
                        <td className="p-4 text-right font-medium">{cp.conversionRate}%</td>
                        <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getFulfillmentColorClass(cp.fulfillmentRate)}`}>
                            {cp.fulfillmentRate}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {cp.resultStatus === 'finalized' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Đã chốt</span>
                          ) : cp.resultStatus === 'draft' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Nháp</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Chưa có kết quả</span>
                          )}
                        </td>
                        {hasAnySource && (
                          <td className="p-4 text-xs text-slate-600">
                            {cp.dataSource === 'google_sheets' ? 'Google Sheets' : cp.dataSource === 'manual' ? 'Nhập thủ công' : '—'}
                          </td>
                        )}
                        <td className="p-4 text-xs text-slate-500">
                          {cp.updatedAt ? new Date(cp.updatedAt).toLocaleString('vi-VN') : '—'}
                          {cp.updatedBy ? <p className="text-[10px] text-slate-400">Bởi: {cp.updatedBy}</p> : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Program Results Breakdown (Chi tiết kết quả tuyển sinh theo ngành/lớp) */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden space-y-6 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chi tiết kết quả tuyển sinh theo ngành/lớp</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {filters.campaignId 
                    ? `Thống kê chi tiết theo ngành của đợt tuyển sinh đang chọn` 
                    : `Tổng hợp chi tiết kết quả tuyển sinh theo từng ngành/lớp (Toàn bộ các đợt)`}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                {filters.campaignId && (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg">
                    Đang lọc theo đợt
                  </span>
                )}
                <button
                  type="button"
                  id="export-programs-table-excel"
                  onClick={handleExportProgramsExcel}
                  disabled={isExporting || !data || data.programItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Xuất bảng kết quả theo ngành/lớp ra Excel"
                >
                  <Download className="h-4 w-4" />
                  <span>Xuất Excel</span>
                </button>
              </div>
            </div>

            {/* Program Chart */}
            {data.programItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800">Biểu đồ kết quả theo ngành/lớp</h4>
                <div className="h-72 w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <SafeResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.programItems} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="programCode" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip formatter={(val: any) => formatNumber(val)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="registeredCount" name="Hồ sơ đăng ký" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paidCount" name="Đã đóng học phí" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              </div>
            )}

            {/* Program Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4">STT</th>
                    <th className="p-4">Mã ngành</th>
                    <th className="p-4">Tên ngành / lớp</th>
                    <th className="p-4">Nhóm</th>
                    <th className="p-4 text-right">Đăng ký</th>
                    <th className="p-4 text-right">Đã đóng HP</th>
                    <th className="p-4 text-right">Tỷ lệ chuyển đổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                  {data.programItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Chưa có dữ liệu chi tiết kết quả theo ngành/lớp cho bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    data.programItems.map((prog, idx) => {
                      const convRate = prog.registeredCount > 0 ? Number(((prog.paidCount / prog.registeredCount) * 100).toFixed(1)) : 0;
                      return (
                        <tr key={prog.programId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 text-slate-500 font-medium">{idx + 1}</td>
                          <td className="p-4 font-mono font-bold text-slate-900">{prog.programCode}</td>
                          <td className="p-4 font-medium text-slate-900">{prog.programName}</td>
                          <td className="p-4 text-xs text-slate-600">{prog.groupName}</td>
                          <td className="p-4 text-right font-semibold text-blue-600">{formatNumber(prog.registeredCount)}</td>
                          <td className="p-4 text-right font-bold text-emerald-600">{formatNumber(prog.paidCount)}</td>
                          <td className="p-4 text-right font-medium">{convRate}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Quality Warnings */}
          {data.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Cảnh báo chất lượng dữ liệu ({data.warnings.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.warnings.map(w => (
                  <div key={w.id} className="bg-white/80 p-3 rounded-xl border border-amber-200 text-sm flex items-start gap-2.5">
                    <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${w.type === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className="font-semibold text-slate-900">{w.title}</p>
                      <p className="text-slate-600 text-xs mt-0.5">{w.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Sheets Sync Information Block */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Thông tin đồng bộ Google Sheets gần nhất</h4>
                {data.syncStatus ? (
                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Thời gian: <strong className="text-slate-800">{new Date(data.syncStatus.lastSyncedAt!).toLocaleString('vi-VN')}</strong></span>
                    <span>Người thực hiện: <strong className="text-slate-800">{data.syncStatus.syncedBy || 'Hệ thống'}</strong></span>
                    <span>Số sheet: <strong className="text-slate-800">{data.syncStatus.totalSheets}</strong></span>
                    <span>Đợt cập nhật: <strong className="text-slate-800">{data.syncStatus.campaignsUpdated}</strong></span>
                    <span>Trạng thái: <strong className={data.syncStatus.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}>{data.syncStatus.status}</strong></span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Chưa có dữ liệu đồng bộ từ Google Sheets.</p>
                )}
              </div>
            </div>
            {isAdmin && (
              <a
                href="#/admissions/sheets"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs shrink-0"
              >
                <span>Đi đến đồng bộ Google Sheets</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
