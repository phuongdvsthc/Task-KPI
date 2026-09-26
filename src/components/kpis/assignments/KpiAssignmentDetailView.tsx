import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Play, 
  Trash2, 
  XCircle, 
  Calendar, 
  User, 
  Building2, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  Edit3, 
  Clock, 
  Info,
  CheckCircle2,
  Calculator
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { kpiAssignmentService } from '../../../services/kpi-assignment.service';
import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';
import { kpiScoringService, KpiScoringResult, KpiAssignmentScoreResult } from '../../../services/kpiScoringService';
import { kpiReviewService } from '../../../services/kpiReviewService';
import { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';
import { formatPercent, formatScore, formatScoreStatus } from '../../../utils/kpiScoreFormatter';
import { KpiManualActualModal } from './KpiManualActualModal';
import { KpiActualTraceDrawer } from './KpiActualTraceDrawer';
import { 
  KpiAssignment, 
  KpiAssignmentItem, 
  KpiAssignmentStatus,
  KpiAssignmentReview
} from '../../../types/kpi';
import { formatTargetConfig } from '../../../utils/kpiTargetFormatter';
import { KpiAssignmentTargetEditModal } from './KpiAssignmentTargetEditModal';
import { KpiReviewSection } from './KpiReviewSection';
import { KpiReviewReturnModal } from './KpiReviewReturnModal';
import { KpiReviewApproveModal } from './KpiReviewApproveModal';
import { KpiLockModal } from './KpiLockModal';

interface KpiAssignmentDetailViewProps {
  assignmentId: string;
  onBack: () => void;
  onRefreshList?: () => void;
}

export const KpiAssignmentDetailView: React.FC<KpiAssignmentDetailViewProps> = ({
  assignmentId,
  onBack,
  onRefreshList,
}) => {
  const { user, systemRole } = useAuth();

  const [assignment, setAssignment] = useState<KpiAssignment | null>(null);
  const [items, setItems] = useState<KpiAssignmentItem[]>([]);
  const [actuals, setActuals] = useState<Record<string, KpiActualResolverResult>>({});
  const [assignmentScore, setAssignmentScore] = useState<KpiAssignmentScoreResult | null>(null);
  const [itemScores, setItemScores] = useState<Record<string, KpiScoringResult>>({});
  const [review, setReview] = useState<KpiAssignmentReview | null>(null);
  const [scoreTraceItemId, setScoreTraceItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [editingItem, setEditingItem] = useState<KpiAssignmentItem | null>(null);
  const [showAssignConfirmModal, setShowAssignConfirmModal] = useState<boolean>(false);
  const [showActivateConfirmModal, setShowActivateConfirmModal] = useState<boolean>(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showLockModal, setShowLockModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isReviewProcessing, setIsReviewProcessing] = useState<boolean>(false);
  
  const [manualActualModal, setManualActualModal] = useState<{
    isOpen: boolean;
    bindingId: string;
    measurementType: string;
    requireNote: boolean;
  } | null>(null);

  const [traceDrawerItemId, setTraceDrawerItemId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, itemsRes, actualsRes, scoreRes, reviewRes] = await Promise.all([
        kpiAssignmentService.getAssignmentDetail(assignmentId),
        kpiAssignmentService.getAssignmentItems(assignmentId),
        kpiActualService.resolveAssignmentActuals(assignmentId),
        kpiScoringService.resolveAssignmentScore(assignmentId),
        kpiReviewService.getReviewByAssignment(assignmentId)
      ]);

      if (detailRes.error) throw detailRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setAssignment(detailRes.data);
      setItems(itemsRes.data || []);
      
      if (actualsRes.data) {
        const actualsMap = actualsRes.data.reduce((acc, curr) => {
          acc[curr.assignment_item_id] = curr;
          return acc;
        }, {} as Record<string, KpiActualResolverResult>);
        setActuals(actualsMap);
      }
      if (scoreRes.data) {
        setAssignmentScore(scoreRes.data);
        const sMap = scoreRes.data.items.reduce((acc, curr) => {
          acc[curr.assignment_item_id] = curr;
          return acc;
        }, {} as Record<string, KpiScoringResult>);
        setItemScores(sMap);
      }
      if (reviewRes.data) {
        setReview(reviewRes.data);
      } else {
        setReview(null);
      }
    } catch (err: any) {
      console.error('[KpiAssignmentDetail] Load error:', err);
      setError(err.message || 'Không thể tải thông tin chi tiết giao KPI');
    } finally {
      setLoading(false);
    }
  };

  const canManage = systemRole === 'admin' || systemRole === 'manager' || assignment?.created_by === user?.id || assignment?.assigned_by === user?.id;

  const handleStartReview = async () => {
    if (!assignment) return;
    setError(null);
    setSuccessMessage(null);
    setIsReviewProcessing(true);
    try {
      const { data, error: sErr } = await kpiReviewService.startReview(assignment.id);
      if (sErr) throw sErr;
      setSuccessMessage('Đã bắt đầu tiến trình đánh giá KPI.');
      await loadData();
    } catch (err: any) {
      console.error('[handleStartReview] Error:', err);
      setError(kpiReviewService.mapReviewError(err));
    } finally {
      setIsReviewProcessing(false);
    }
  };

  const handleReturnReview = async (note: string) => {
    if (!review?.id) return;
    setError(null);
    setSuccessMessage(null);
    setIsReviewProcessing(true);
    try {
      const { data, error: rErr } = await kpiReviewService.returnReview(review.id, note);
      if (rErr) throw rErr;
      setShowReturnModal(false);
      setSuccessMessage('Đã gửi yêu cầu điều chỉnh kết quả KPI.');
      await loadData();
    } catch (err: any) {
      console.error('[handleReturnReview] Error:', err);
      setError(kpiReviewService.mapReviewError(err));
    } finally {
      setIsReviewProcessing(false);
    }
  };

  const handleResubmitReview = async () => {
    if (!review?.id) return;
    setError(null);
    setSuccessMessage(null);
    setIsReviewProcessing(true);
    try {
      const { data, error: rErr } = await kpiReviewService.resubmitReview(review.id);
      if (rErr) throw rErr;
      setSuccessMessage('Đã gửi lại đánh giá thành công.');
      await loadData();
    } catch (err: any) {
      console.error('[handleResubmitReview] Error:', err);
      setError(kpiReviewService.mapReviewError(err));
    } finally {
      setIsReviewProcessing(false);
    }
  };

  const handleApproveReview = async (note?: string) => {
    if (!review?.id) return;
    setError(null);
    setSuccessMessage(null);
    setIsReviewProcessing(true);
    try {
      const { data, error: aErr } = await kpiReviewService.approveReview(review.id, note);
      if (aErr) throw aErr;
      setShowApproveModal(false);
      setSuccessMessage('Đã phê duyệt kết quả KPI thành công.');
      await loadData();
    } catch (err: any) {
      console.error('[handleApproveReview] Error:', err);
      setError(kpiReviewService.mapReviewError(err));
    } finally {
      setIsReviewProcessing(false);
    }
  };

  const handleLockReview = async (note?: string) => {
    if (!review?.id) return;
    setError(null);
    setSuccessMessage(null);
    setIsReviewProcessing(true);
    try {
      const { data, error: lErr } = await kpiReviewService.lockAssignmentReview(review.id, note);
      if (lErr) throw lErr;
      setShowLockModal(false);
      setSuccessMessage('Đã khóa kết quả KPI chính thức thành công. Kết quả này là bất biến.');
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('[handleLockReview] Error:', err);
      setError(kpiReviewService.mapReviewError(err));
    } finally {
      setIsReviewProcessing(false);
    }
  };

  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.0001;
  const isDraft = assignment?.status === 'draft';
  const isAssigned = assignment?.status === 'assigned';
  const isActive = assignment?.status === 'active';
  const isCancelled = assignment?.status === 'cancelled';

  // Action: Giao KPI (Draft -> Assigned)
  const handleAssignKpi = async () => {
    if (!assignment) return;
    setError(null);

    // Validation
    if (items.length === 0) {
      setError('Bộ KPI chưa có tiêu chí nào. Không thể giao.');
      setShowAssignConfirmModal(false);
      return;
    }
    if (!isWeightValid) {
      setError(`Tổng trọng số các tiêu chí phải đạt đúng 100% (Hiện tại: ${totalWeight}%).`);
      setShowAssignConfirmModal(false);
      return;
    }

    setIsProcessing(true);
    try {
      const { error: assignErr } = await kpiAssignmentService.assignKpi(assignment.id);
      if (assignErr) throw assignErr;

      setShowAssignConfirmModal(false);
      setSuccessMessage('Đã giao bộ KPI thành công! Các tiêu chí đã được khóa cố định.');
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('Assign KPI error:', err);
      setError(err.message || 'Lỗi khi giao KPI');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Áp dụng KPI (Assigned -> Active)
  const handleActivateKpi = async () => {
    if (!assignment) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { error: actErr } = await kpiAssignmentService.activateKpi(assignment.id);
      if (actErr) throw actErr;

      setShowActivateConfirmModal(false);
      setSuccessMessage('Đã chuyển sang trạng thái Áp dụng KPI.');
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('Activate KPI error:', err);
      setError(err.message || 'Lỗi khi áp dụng KPI');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Hủy KPI (-> Cancelled)
  const handleCancelKpi = async () => {
    if (!assignment) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { error: cancelErr } = await kpiAssignmentService.cancelKpi(assignment.id);
      if (cancelErr) throw cancelErr;

      setShowCancelConfirmModal(false);
      setSuccessMessage('Bộ KPI đã được chuyển sang trạng thái Hủy.');
      await loadData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error('Cancel KPI error:', err);
      setError(err.message || 'Lỗi khi hủy KPI');
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Xóa bản nháp (Draft only)
  const handleDeleteDraft = async () => {
    if (!assignment) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { error: delErr } = await kpiAssignmentService.deleteDraftAssignment(assignment.id);
      if (delErr) throw delErr;

      setShowDeleteConfirmModal(false);
      if (onRefreshList) onRefreshList();
      onBack();
    } catch (err: any) {
      console.error('Delete draft error:', err);
      setError(err.message || 'Lỗi khi xóa bản nháp KPI');
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status?: KpiAssignmentStatus) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">Bản nháp</span>;
      case 'assigned':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Đã giao</span>;
      case 'active':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Đang áp dụng</span>;
      case 'closed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-700">Đã kết thúc</span>;
      case 'locked':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Đã khóa</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Đã hủy</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status || '-'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span className="text-sm">Đang tải chi tiết bộ KPI...</span>
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-600 font-semibold">{error}</div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>
      </div>
    );
  }

  if (!assignment) return null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">
                {assignment?.assignee_type === 'individual'
                  ? assignment?.assignee_user?.full_name || assignment?.assigneeName || 'Cá nhân'
                  : assignment?.assignee_unit?.name || assignment?.assigneeName || 'Đơn vị'}
              </h2>
              {getStatusBadge(assignment?.status)}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Mẫu: <strong className="text-slate-700">{assignment?.template?.name}</strong></span>
              <span>•</span>
              <span>Phiên bản v{assignment?.template_version?.version_no}</span>
              <span>•</span>
              <span>Kỳ: <strong className="text-slate-700">{assignment?.period?.name}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons depending on status */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(true)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Xóa bản nháp
              </button>
              <button
                type="button"
                onClick={() => setShowAssignConfirmModal(true)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Send className="h-4 w-4" />
                Giao KPI
              </button>
            </>
          )}

          {isAssigned && (
            <>
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(true)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Hủy KPI
              </button>
              <button
                type="button"
                onClick={() => setShowActivateConfirmModal(true)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <Play className="h-4 w-4" />
                Áp dụng KPI
              </button>
            </>
          )}

          {isActive && (
            <button
              type="button"
              onClick={() => setShowCancelConfirmModal(true)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Hủy KPI
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800 text-sm">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Overview Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            Đối tượng nhận KPI
          </div>
          <div className="text-sm font-bold text-slate-900">
            {assignment?.assignee_type === 'individual'
              ? assignment.assignee_user?.full_name || assignment.assigneeName || '-'
              : assignment?.assignee_unit?.name || assignment.assigneeName || '-'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {assignment?.assignee_type === 'individual'
              ? (assignment.assignee_user?.employee_code || assignment.assigneeEmployeeCode
                  ? `${assignment.assignee_user?.employee_code || assignment.assigneeEmployeeCode}${assignment.assignee_user?.email || assignment.assigneeEmail ? ` • ${assignment.assignee_user?.email || assignment.assigneeEmail}` : ''}`
                  : assignment.assignee_user?.email || assignment.assigneeEmail || '-')
              : assignment?.assignee_unit?.code || '-'}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            Đơn vị thời điểm giao (Snapshot)
          </div>
          <div className="text-sm font-bold text-slate-900">
            {assignment?.assignee_unit_snapshot?.name || assignment?.assigneeOrganizationName || assignment?.assignee_unit?.name || 'Toàn trường'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {assignment?.assignee_unit_snapshot?.code || assignment?.assignee_unit?.code || '-'}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Thời gian hiệu lực
          </div>
          <div className="text-sm font-bold text-slate-900">
            {assignment?.effective_from || assignment?.period?.start_date || '-'}
          </div>
          <div className="text-xs text-slate-500">
            đến {assignment?.effective_to || assignment?.period?.end_date || '-'}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-2xs space-y-1">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Người giao & Thời gian
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {assignment?.assigner?.full_name || assignment?.creator?.full_name || '-'}
          </div>
          <div className="text-xs text-slate-500">
            {assignment?.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString('vi-VN') : 'Chưa giao'}
          </div>
        </div>
      </div>

      {/* Notes banner if present */}
      {assignment?.notes && (
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-800">Ghi chú:</strong> {assignment.notes}
          </div>
        </div>
      )}

      
      {/* KPI Review & Scoring Section */}
      {assignment && (
        <KpiReviewSection
          assignment={assignment}
          review={review}
          assignmentScore={assignmentScore}
          canManage={canManage}
          isProcessing={isReviewProcessing}
          onStartReview={handleStartReview}
          onOpenReturnModal={() => setShowReturnModal(true)}
          onOpenApproveModal={() => setShowApproveModal(true)}
          onResubmitReview={handleResubmitReview}
          onOpenLockModal={() => setShowLockModal(true)}
        />
      )}

      {/* Items Section */}

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">
              Danh sách tiêu chí KPI ({items.length})
            </h3>
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
              isWeightValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              Tổng trọng số: {totalWeight}%
            </span>
          </div>

          {!isDraft && (
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Tiêu chí đã khóa cố định</span>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Chưa có tiêu chí nào trong bộ KPI này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Tiêu chí KPI</th>
                  <th className="px-4 py-3.5 text-center">Trọng số</th>
                  <th className="px-4 py-3.5">Target</th>
                  <th className="px-4 py-3.5">Actual</th>
                  <th className="px-4 py-3.5 text-center">Hoàn thành</th>
                  <th className="px-4 py-3.5 text-center">Điểm</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  {isDraft && (
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map(item => {
                  const def = item.definition || item.definition_snapshot || {};
                  const actual = actuals[item.id];
                  const score = itemScores[item.id];
                  const isManual = actual?.source_type === 'manual' || (item as any).bindings?.some((b: any) => b.binding_key === 'primary' && b.source_type === 'manual');
                  const primaryBinding = (item as any).bindings?.find((b: any) => b.binding_key === 'primary' && b.is_active);
                  const inputRole = primaryBinding?.source_config?.input_role || 'assignee';
                  const isAssignee = assignment.assignee_type === 'individual' && assignment.assignee_user_id === user?.id;
                  const hasInputPermission = isManual && (assignment.status === 'assigned' || assignment.status === 'active') && !(isAssignee && inputRole === 'manager');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{def.name || 'Tiêu chí KPI'}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-600">
                            {def.code || 'CODE'}
                          </span>
                          <span>•</span>
                          <span>{def.measurement_type}</span>
                          {def.unit_code && <span>({def.unit_code})</span>}
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        <span className="font-semibold text-slate-700">{item.weight}%</span>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600 font-medium">
                        {formatTargetConfig(item.target_config, def.measurement_type, def.direction, def.unit_code)}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        {actual ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            {actual.status === 'resolved' ? (
                              <span className="font-bold text-slate-800 text-sm">
                                {actual.value_numeric !== null ? Number(actual.value_numeric).toLocaleString('vi-VN') : actual.value_boolean !== null ? (actual.value_boolean ? 'Đạt' : 'Không đạt') : actual.value_text || '-'}
                                {def.unit_code && def.measurement_type !== 'boolean' ? ` ${def.unit_code}` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-xs">Lỗi: {actual.status}</span>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {actual.status === 'resolved' && (
                                <button
                                  onClick={() => setTraceDrawerItemId(item.id)}
                                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                >
                                  Xem nguồn dữ liệu
                                </button>
                              )}

                              {hasInputPermission && primaryBinding && (
                                <button
                                  onClick={() => setManualActualModal({
                                    isOpen: true,
                                    bindingId: primaryBinding.id,
                                    measurementType: def.measurement_type,
                                    requireNote: primaryBinding.source_config?.require_note === true
                                  })}
                                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline transition-colors"
                                >
                                  {actual.status === 'resolved' ? 'Cập nhật Actual' : 'Nhập Actual'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Đang tải...</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {score ? (
                          score.status === 'scored' ? (
                            <span className="font-bold text-slate-700 text-sm">{formatPercent(score.achievement_percent)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )
                        ) : (
                          <span className="text-slate-400 italic">Đang tải...</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {score ? (
                          score.status === 'scored' ? (
                            <span className="font-bold text-indigo-700 text-sm">{formatScore(score.weighted_score)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )
                        ) : (
                          <span className="text-slate-400 italic">Đang tải...</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {score ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium ${score.status === 'scored' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {formatScoreStatus(score.status, score.reason)}
                            </span>
                            {score.status === 'scored' && (
                              <button
                                onClick={() => setScoreTraceItemId(item.id)}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors mt-1"
                              >
                                Xem cách tính
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Đang tải...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Target Override Modal */}
      {editingItem && (
        <KpiAssignmentTargetEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            setSuccessMessage('Đã cập nhật chỉ tiêu tiêu chí thành công.');
            loadData();
          }}
        />
      )}

      {/* CONFIRMATION MODAL: GIAO KPI (Draft -> Assigned) */}
      {showAssignConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Giao bộ KPI?</h3>
                <p className="text-xs text-slate-500">Xác nhận chuyển trạng thái sang Đã giao</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Sau khi giao, các tiêu chí và chỉ tiêu của bộ KPI sẽ được khóa cố định. Hãy kiểm tra kỹ trước khi tiếp tục.
            </p>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
              <div>Đối tượng: <strong>{assignment?.assignee_user?.full_name || assignment?.assignee_unit?.name || assignment?.assigneeName || '-'}</strong></div>
              <div>Tổng số tiêu chí: <strong>{items.length}</strong></div>
              <div>Tổng trọng số: <strong>{totalWeight}%</strong></div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignConfirmModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAssignKpi}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận giao KPI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: ÁP DỤNG KPI (Assigned -> Active) */}
      {showActivateConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Áp dụng KPI?</h3>
                <p className="text-xs text-slate-500">Chuyển trạng thái sang Đang áp dụng</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Bộ KPI sẽ bắt đầu được tính toán và theo dõi thực hiện trong kỳ đánh giá.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowActivateConfirmModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleActivateKpi}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
              >
                {isProcessing ? 'Đang xử lý...' : 'Áp dụng KPI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: HỦY KPI */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hủy bộ KPI này?</h3>
                <p className="text-xs text-slate-500">Chuyển trạng thái sang Đã hủy</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Dữ liệu lịch sử giao KPI vẫn sẽ được bảo lưu trong hệ thống nhưng sẽ không còn hiệu lực thực hiện.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleCancelKpi}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: XÓA BẢN NHÁP */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xóa bản nháp KPI?</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa bản nháp giao KPI này không? Bản ghi sẽ bị gỡ bỏ khỏi hệ thống.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
              >
                {isProcessing ? 'Đang xóa...' : 'Xóa bản nháp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualActualModal?.isOpen && (
        <KpiManualActualModal
          bindingId={manualActualModal.bindingId}
          measurementType={manualActualModal.measurementType}
          requireNote={manualActualModal.requireNote}
          onClose={() => setManualActualModal(null)}
          onSuccess={() => {
            setManualActualModal(null);
            loadData();
          }}
        />
      )}

      {scoreTraceItemId && itemScores[scoreTraceItemId] && (
        <KpiScoreTraceDrawer
          scoreItem={itemScores[scoreTraceItemId]}
          onClose={() => setScoreTraceItemId(null)}
        />
      )}

      {traceDrawerItemId && (
        <KpiActualTraceDrawer
          assignmentItemId={traceDrawerItemId}
          onClose={() => setTraceDrawerItemId(null)}
        />
      )}

      {/* Review Workflow Modals */}
      <KpiReviewReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturnReview}
        isProcessing={isReviewProcessing}
      />

      <KpiReviewApproveModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApproveReview}
        isProcessing={isReviewProcessing}
        currentScore={assignmentScore?.total_score || 0}
      />

      <KpiLockModal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        onConfirm={handleLockReview}
        isProcessing={isReviewProcessing}
        officialScore={review?.official_total_score ?? assignment?.config?.official_result?.total_score ?? null}
        reviewerName={review?.reviewer_name}
        approvedAt={review?.approved_at}
      />
    </div>
  );
};
