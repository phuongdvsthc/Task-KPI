import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Building2, 
  Eye, 
  Trash2, 
  Layers, 
  RefreshCw, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { kpiService } from '../../../services/kpi.service';
import { kpiAssignmentService } from '../../../services/kpi-assignment.service';
import { 
  KpiAssignment, 
  KpiPeriod, 
  KpiAssigneeType, 
  KpiAssignmentStatus 
} from '../../../types/kpi';
import { KpiAssignmentWizardModal } from './KpiAssignmentWizardModal';
import { KpiAssignmentDetailView } from './KpiAssignmentDetailView';

export const KpiAssignmentListView: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [periods, setPeriods] = useState<KpiPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<KpiAssignmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<KpiAssigneeType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Navigation
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Delete draft state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [periodFilter, statusFilter, typeFilter]);

  const loadPeriods = async () => {
    try {
      const { data } = await kpiService.getPeriods(undefined);
      setPeriods(data || []);
    } catch (err) {
      console.error('Error loading periods:', err);
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await kpiAssignmentService.listAssignments({
        periodId: periodFilter,
        status: statusFilter,
        assigneeType: typeFilter,
        search: searchQuery,
      });

      if (fetchError) throw fetchError;
      setAssignments(data || []);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
      setError(err.message || 'Không thể tải danh sách KPI đã giao');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAssignments();
  };

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản nháp giao KPI này?')) return;
    setDeletingId(id);
    try {
      const { error: delErr } = await kpiAssignmentService.deleteDraftAssignment(id);
      if (delErr) throw delErr;
      await loadAssignments();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa bản nháp');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: KpiAssignmentStatus) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">Bản nháp</span>;
      case 'assigned':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Đã giao</span>;
      case 'active':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Đang áp dụng</span>;
      case 'closed':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-700">Đã kết thúc</span>;
      case 'locked':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Đã khóa</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Đã hủy</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // If detail view is open, render detail view component
  if (selectedAssignmentId) {
    return (
      <KpiAssignmentDetailView
        assignmentId={selectedAssignmentId}
        onBack={() => setSelectedAssignmentId(null)}
        onRefreshList={loadAssignments}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Giao KPI (KPI Assignments)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Giao chỉ tiêu KPI từ các Mẫu đã xuất bản cho cá nhân hoặc đơn vị theo kỳ đánh giá
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Giao KPI</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Period Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kỳ đánh giá
            </label>
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả kỳ đánh giá</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="assigned">Đã giao (Assigned)</option>
              <option value="active">Đang áp dụng (Active)</option>
              <option value="closed">Đã kết thúc (Closed)</option>
              <option value="locked">Đã khóa (Locked)</option>
              <option value="cancelled">Đã hủy (Cancelled)</option>
            </select>
          </div>

          {/* Assignee Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Loại đối tượng
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="individual">Cá nhân (Staff)</option>
              <option value="organization">Đơn vị (Khoa/Phòng)</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tìm kiếm
            </label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Tên nhân sự, đơn vị, mẫu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              />
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </form>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button
            onClick={loadAssignments}
            className="text-xs font-semibold text-red-700 hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Thử lại
          </button>
        </div>
      )}

      {/* Assignments Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-sm">Đang tải danh sách giao KPI...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Layers className="h-6 w-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">Chưa có KPI nào được giao</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Nhấn nút "+ Giao KPI" phía trên để tạo đợt giao KPI mới cho nhân sự hoặc đơn vị từ các Mẫu đã xuất bản.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Kỳ đánh giá</th>
                  <th className="px-4 py-3.5">Mẫu KPI & Phiên bản</th>
                  <th className="px-4 py-3.5">Đối tượng nhận</th>
                  <th className="px-4 py-3.5">Đơn vị (Snapshot)</th>
                  <th className="px-4 py-3.5">Hiệu lực</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {assignments.map(item => {
                  const isIndividual = item.assignee_type === 'individual';
                  const assigneeName = isIndividual
                    ? item.assignee_user?.full_name || item.assigneeName || 'Cá nhân'
                    : item.assignee_unit?.name || item.assigneeName || 'Đơn vị';
                  const assigneeSub = isIndividual
                    ? item.assignee_user?.employee_code || item.assigneeEmployeeCode || item.assignee_user?.email || item.assigneeEmail
                    : item.assignee_unit?.code;
                  const unitSnapshotName = item.assignee_unit_snapshot?.name || item.assigneeOrganizationName || item.assignee_unit?.name || '-';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedAssignmentId(item.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{item.period?.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.period?.code}</div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{item.template?.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{item.template?.code}</span>
                          <span>•</span>
                          <span className="text-indigo-600 font-semibold">v{item.template_version?.version_no}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isIndividual ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {isIndividual ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{assigneeName}</div>
                            {assigneeSub && <div className="text-xs text-slate-500 font-mono">{assigneeSub}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{unitSnapshotName}</span>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-500">
                        <div>{item.effective_from || item.period?.start_date || '-'}</div>
                        <div>đến {item.effective_to || item.period?.end_date || '-'}</div>
                      </td>

                      <td className="px-4 py-4">
                        {getStatusBadge(item.status)}
                      </td>

                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedAssignmentId(item.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {item.status === 'draft' && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDraft(item.id, e)}
                              disabled={deletingId === item.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Xóa bản nháp"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      {isWizardOpen && (
        <KpiAssignmentWizardModal
          onClose={() => setIsWizardOpen(false)}
          onSuccess={() => {
            setIsWizardOpen(false);
            loadAssignments();
          }}
        />
      )}
    </div>
  );
};
