import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Users, 
  Building2, 
  Award, 
  Target, 
  RefreshCw, 
  Loader2, 
  Search, 
  Filter, 
  CheckCircle2, 
  TrendingUp, 
  GraduationCap 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { KpiPeriod, KpiDashboardFilters, KpiDashboardUnitBreakdown, KpiDashboardAssignmentItem } from '../../../types/kpi';
import { kpiDashboardService } from '../../../services/kpiDashboardService';

interface TeacherDepartmentKpiProgressDashboardProps {
  onSelectAssignment?: (assignmentId: string) => void;
}

export const TeacherDepartmentKpiProgressDashboard: React.FC<TeacherDepartmentKpiProgressDashboardProps> = ({ onSelectAssignment }) => {
  const [periods, setPeriods] = useState<KpiPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<KpiDashboardFilters>({
    periodId: '',
    assigneeType: 'all',
    assignmentStatus: 'all',
    resultMode: 'all',
  });

  const [unitBreakdown, setUnitBreakdown] = useState<KpiDashboardUnitBreakdown[]>([]);
  const [assignments, setAssignments] = useState<KpiDashboardAssignmentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'teachers'>('overview');

  // Load periods on mount
  useEffect(() => {
    let isMounted = true;
    const fetchPeriods = async () => {
      setPeriodsLoading(true);
      const { data, error: err } = await kpiDashboardService.getPeriods();
      if (!isMounted) return;
      if (err) {
        setError(err.message || 'Không thể tải danh sách kỳ KPI');
      } else {
        const periodList = data || [];
        setPeriods(periodList);
        if (periodList.length > 0) {
          const active = periodList.find(p => p.status === 'active') || periodList[0];
          setFilters(prev => ({ ...prev, periodId: active.id }));
        }
      }
      setPeriodsLoading(false);
    };
    fetchPeriods();
    return () => { isMounted = false; };
  }, []);

  // Load dashboard data when periodId or assigneeType changes
  const loadData = useCallback(async () => {
    if (!filters.periodId) return;
    setLoading(true);
    setError(null);
    try {
      const [unitRes, assignRes] = await Promise.all([
        kpiDashboardService.getUnitBreakdown(filters),
        kpiDashboardService.getAssignments({ ...filters, limit: 100 })
      ]);

      if (unitRes.error) {
        console.warn('Unit breakdown warning:', unitRes.error);
      }
      if (assignRes.error) {
        throw assignRes.error;
      }

      setUnitBreakdown(unitRes.data || []);
      setAssignments(assignRes.data || []);
    } catch (err: any) {
      console.error('Failed to load KPI progress dashboard:', err);
      setError(err.message || 'Không thể tải dữ liệu bảng điều khiển KPI.');
    } finally {
      setLoading(false);
    }
  }, [filters.periodId, filters.assigneeType, filters.assignmentStatus, filters.resultMode]);

  useEffect(() => {
    if (filters.periodId) {
      loadData();
    }
  }, [filters.periodId, filters.assigneeType, filters.assignmentStatus, filters.resultMode, loadData]);

  // Separate assignments into Teachers (individual) and Departments (organization)
  const teacherAssignments = assignments.filter(a => a.assignee_type === 'individual');
  const departmentAssignments = assignments.filter(a => a.assignee_type === 'organization');

  // Filtered lists for search
  const filteredAssignments = assignments.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (a.assignee_name || '').toLowerCase();
    const unitName = (a.unit_name || '').toLowerCase();
    const templateName = (a.template_name || '').toLowerCase();
    return name.includes(q) || unitName.includes(q) || templateName.includes(q);
  });

  // Calculate summary metrics
  const totalCount = assignments.length;
  const teacherCount = teacherAssignments.length;
  const departmentCount = departmentAssignments.length;

  const avgTeacherScore = teacherCount > 0
    ? teacherAssignments.reduce((acc, curr) => acc + (curr.total_score ?? 0), 0) / teacherCount
    : 0;

  const avgDepartmentScore = departmentCount > 0
    ? departmentAssignments.reduce((acc, curr) => acc + (curr.total_score ?? 0), 0) / departmentCount
    : 0;

  // Chart data for Departments (Units)
  const departmentChartData = unitBreakdown.map(u => ({
    name: u.unit_name || 'Đơn vị',
    diemChinhThuc: u.official_average_score !== null ? Number(u.official_average_score) : 0,
    diemTamTinh: u.live_average_score !== null ? Number(u.live_average_score) : 0,
    soLuong: u.assignment_count || 0,
  }));

  // Chart data for Top Teachers (Staff)
  const teacherChartData = teacherAssignments.slice(0, 15).map(t => ({
    name: t.assignee_name || 'Giáo viên',
    donVi: t.unit_name || '—',
    diem: t.total_score !== null ? Number(t.total_score) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <BarChart3 className="h-4 w-4" />
            <span>Hệ thống Quản lý KPI & Đánh giá</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tiến độ KPI Giáo viên & Bộ phận
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi trực quan kết quả, điểm số và tiến độ thực hiện KPI của toàn bộ giáo viên và các đơn vị/bộ phận.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <span className="text-xs font-semibold text-slate-600 uppercase">Kỳ KPI:</span>
            <select
              value={filters.periodId}
              onChange={(e) => setFilters(prev => ({ ...prev, periodId: e.target.value }))}
              disabled={periodsLoading}
              className="bg-transparent text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              {periods.length === 0 && <option value="">Đang tải kỳ KPI...</option>}
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.period_type})
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Type Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <span className="text-xs font-semibold text-slate-600 uppercase">Đối tượng:</span>
            <select
              value={filters.assigneeType || 'all'}
              onChange={(e) => setFilters(prev => ({ ...prev, assigneeType: e.target.value as any }))}
              className="bg-transparent text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả (Giáo viên & Bộ phận)</option>
              <option value="individual">Chỉ Giáo viên (Cá nhân)</option>
              <option value="organization">Chỉ Bộ phận (Đơn vị)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng KPI Giao</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Đang theo dõi trong kỳ</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Giáo viên ({teacherCount})</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {avgTeacherScore.toFixed(1)} <span className="text-xs font-medium text-slate-500">đ/100</span>
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Điểm trung bình cá nhân</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bộ phận ({departmentCount})</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {avgDepartmentScore.toFixed(1)} <span className="text-xs font-medium text-slate-500">đ/100</span>
            </h3>
            <p className="text-xs text-blue-600 font-medium mt-1">Điểm trung bình đơn vị</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ hoàn thành</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalCount > 0 ? `${Math.round((assignments.filter(a => (a.total_score ?? 0) >= 80).length / totalCount) * 100)}%` : '0%'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Đạt loại Giỏi / Xuất sắc</p>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Biểu đồ tổng quan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'departments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tiến độ Bộ phận ({departmentCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'teachers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tiến độ Giáo viên ({teacherCount})
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Đang tổng hợp dữ liệu tiến độ KPI...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {(activeTab === 'overview' || activeTab === 'departments') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Biểu đồ tiến độ KPI theo Bộ phận / Đơn vị</h2>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-lg">
                  {unitBreakdown.length} đơn vị
                </span>
              </div>

              <div className="h-[350px] w-full">
                {departmentChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Chưa có dữ liệu đơn vị cho kỳ này.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentChartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: any, name: any) => [
                          `${value} điểm`, 
                          name === 'diemChinhThuc' ? 'Điểm chính thức' : 'Điểm tạm tính'
                        ]}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="diemTamTinh" name="Điểm tạm tính" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      <Bar dataKey="diemChinhThuc" name="Điểm chính thức" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {(activeTab === 'overview' || activeTab === 'teachers') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Biểu đồ tiến độ KPI Giáo viên (Top cá nhân)</h2>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-lg">
                  {teacherAssignments.length} giáo viên
                </span>
              </div>

              <div className="h-[380px] w-full">
                {teacherChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Chưa có dữ liệu giáo viên cho kỳ này.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teacherChartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(val: any) => [`${val} điểm`, 'Điểm KPI']}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return `${label} (${item?.donVi || '—'})`;
                        }}
                      />
                      <Bar dataKey="diem" name="Điểm KPI giáo viên" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Danh sách chi tiết chỉ tiêu & tiến độ</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tìm kiếm và xem chi tiết điểm số của từng giáo viên và bộ phận</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên, đơn vị..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">STT</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Loại</th>
                    <th className="py-3 px-4">Đơn vị / Phòng ban</th>
                    <th className="py-3 px-4">Mẫu KPI</th>
                    <th className="py-3 px-4 text-right">Điểm số / Tiến độ</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        Không tìm thấy dữ liệu phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map((item, index) => {
                      const score = item.total_score ?? 0;
                      const isTeacher = item.assignee_type === 'individual';
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => onSelectAssignment?.(item.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 text-slate-500 text-xs font-medium">{index + 1}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.assignee_name || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isTeacher ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {isTeacher ? 'Giáo viên' : 'Bộ phận'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.unit_name || '—'}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{item.template_name || '—'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-900 text-xs w-10 text-right">{score.toFixed(1)}đ</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              item.status === 'locked' ? 'bg-indigo-100 text-indigo-800' :
                              item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {item.status === 'locked' ? 'Đã chốt (Khóa)' : item.status === 'active' ? 'Đang thực hiện' : item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
