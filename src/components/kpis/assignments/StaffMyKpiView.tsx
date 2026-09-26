import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Clock, 
  Building2,
  ChevronDown,
  ChevronUp,
  Calculator,
  Lock
} from 'lucide-react';
import { StaffKpiAiSummary } from "./StaffKpiAiSummary";
import { useAuth } from '../../../context/AuthContext';
import { kpiAssignmentService } from '../../../services/kpi-assignment.service';
import { kpiActualService, KpiActualResolverResult } from '../../../services/kpiActualService';
import { kpiScoringService, KpiScoringResult, KpiAssignmentScoreResult } from '../../../services/kpiScoringService';
import { kpiReviewService } from '../../../services/kpiReviewService';
import { KpiScoreTraceDrawer } from './KpiScoreTraceDrawer';
import { formatPercent, formatScore, formatScoreStatus } from '../../../utils/kpiScoreFormatter';
import { formatReviewStatus } from '../../../utils/kpiReviewFormatter';
import { 
  KpiAssignment, 
  KpiAssignmentItem, 
  KpiAssignmentStatus,
  KpiAssignmentReview
} from '../../../types/kpi';
import { formatTargetConfig } from '../../../utils/kpiTargetFormatter';
import { KpiManualActualModal } from './KpiManualActualModal';
import { KpiActualTraceDrawer } from './KpiActualTraceDrawer';

export const StaffMyKpiView: React.FC = () => {
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, KpiAssignmentItem[]>>({});
  const [actualsMap, setActualsMap] = useState<Record<string, Record<string, KpiActualResolverResult>>>({});
  const [scoresMap, setScoresMap] = useState<Record<string, KpiAssignmentScoreResult>>({});
  const [itemScoresMap, setItemScoresMap] = useState<Record<string, Record<string, KpiScoringResult>>>({});
  const [reviewsMap, setReviewsMap] = useState<Record<string, KpiAssignmentReview>>({});
  const [scoreTraceItemId, setScoreTraceItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [manualActualModal, setManualActualModal] = useState<{
    isOpen: boolean;
    bindingId: string;
    measurementType: string;
    requireNote: boolean;
    assignmentId: string;
  } | null>(null);

  const [traceDrawerItemId, setTraceDrawerItemId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadMyAssignments();
    }
  }, [user?.id]);

  const loadMyAssignments = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await kpiAssignmentService.getMyAssignments(user.id);
      if (fetchErr) throw fetchErr;

      const list = data || [];
      setAssignments(list);

      // Section 8: Log one Staff assignment for verification
      if (list.length > 0) {
        const first = list[0];
        console.log('[KPI B3] assignmentId:', first.id);
        console.log('[KPI B3] periodId:', first.periodId || first.period_id);
        console.log('[KPI B3] periodName:', first.periodName || first.period?.name);
        console.log('[KPI B3] templateId:', first.templateId || first.template_id);
        console.log('[KPI B3] templateName:', first.templateName || first.template?.name);
        console.log('[KPI B3] templateVersionId:', first.templateVersionId || first.template_version_id);
        console.log('[KPI B3] templateVersionNo:', first.templateVersionNo ?? first.template_version?.version_no);
      }

      if (list.length > 0) {
        setExpandedId(list[0].id);
        // Load items for the first assignment
        loadItemsForAssignment(list[0].id);
      }
    } catch (err: any) {
      console.error('Error loading staff KPIs:', err);
      setError(err.message || 'Không thể tải danh sách KPI của bạn');
    } finally {
      setLoading(false);
    }
  };

  const loadItemsForAssignment = async (assignmentId: string) => {
    if (itemsMap[assignmentId]) return;
    try {
      const [itemsRes, actualsRes, scoreRes, reviewRes] = await Promise.all([
        kpiAssignmentService.getAssignmentItems(assignmentId),
        kpiActualService.resolveAssignmentActuals(assignmentId),
        kpiScoringService.resolveAssignmentScore(assignmentId),
        kpiReviewService.getReviewByAssignment(assignmentId)
      ]);
      
      if (itemsRes.error) throw itemsRes.error;
      
      setItemsMap(prev => ({ ...prev, [assignmentId]: itemsRes.data || [] }));
      
      if (actualsRes.data) {
        const actMap = actualsRes.data.reduce((acc, curr) => {
          acc[curr.assignment_item_id] = curr;
          return acc;
        }, {} as Record<string, KpiActualResolverResult>);
        setActualsMap(prev => ({ ...prev, [assignmentId]: actMap }));
      }
      if (scoreRes.data) {
        setScoresMap(prev => ({ ...prev, [assignmentId]: scoreRes.data as KpiAssignmentScoreResult }));
        const sMap = scoreRes.data.items.reduce((acc, curr) => {
          acc[curr.assignment_item_id] = curr;
          return acc;
        }, {} as Record<string, KpiScoringResult>);
        setItemScoresMap(prev => ({ ...prev, [assignmentId]: sMap }));
      }
      if (reviewRes.data) {
        setReviewsMap(prev => ({ ...prev, [assignmentId]: reviewRes.data as KpiAssignmentReview }));
      }
    } catch (err) {
      console.error('Error loading assignment items:', err);
    }
  };

  const toggleExpand = (assignmentId: string) => {
    if (expandedId === assignmentId) {
      setExpandedId(null);
    } else {
      setExpandedId(assignmentId);
      loadItemsForAssignment(assignmentId);
    }
  };

  const getStatusBadge = (status: KpiAssignmentStatus) => {
    switch (status) {
      case 'assigned':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Đã giao</span>;
      case 'active':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Đang áp dụng</span>;
      case 'closed':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-700">Đã kết thúc</span>;
      case 'locked':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-900 text-white flex items-center gap-1"><Lock className="w-3 h-3" /> Đã khóa</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">KPI của tôi</h2>
        <p className="text-xs text-slate-500 mt-1">
          Theo dõi các bộ chỉ tiêu KPI cá nhân đã được giao và áp dụng theo kỳ đánh giá
        </p>
      </div>

      {/* Notice Banner */}
      <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 p-4 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
        <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Lưu ý:</strong> Kết quả thực hiện sẽ được bổ sung ở bước tiếp theo (v0.4.3). Hiện tại bạn có thể theo dõi các chỉ tiêu và trọng số KPI được giao cho mình.
        </div>
      </div>

      <StaffKpiAiSummary
        assignments={assignments}
        onDrillDownAssignment={(assignmentId) => {
          if (expandedId !== assignmentId) {
            setExpandedId(assignmentId);
            loadItemsForAssignment(assignmentId);
          }
        }}
      />
      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm">Đang nạp danh sách KPI của bạn...</span>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 border border-slate-200/80 shadow-2xs text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <User className="h-6 w-6" />
          </div>
          <div className="text-base font-bold text-slate-800">Chưa có KPI nào được giao cho bạn</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Khi cán bộ quản lý hoàn tất giao chỉ tiêu KPI cho bạn, thông tin chi tiết sẽ hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(assignment => {
            const isExpanded = expandedId === assignment.id;
            const items = itemsMap[assignment.id] || [];
            const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);

            // Normalized relation fallbacks with explicit warnings if missing
            const templateDisplayName = assignment.templateName || assignment.template?.name || 'Bộ KPI chưa xác định';
            if (!assignment.templateName && !assignment.template?.name) {
              console.warn('[StaffMyKpiView] Missing template relation for assignment:', assignment.id, 'template_id:', assignment.template_id);
            }

            const periodDisplayName = assignment.periodName || assignment.period?.name || 'Kỳ đánh giá chưa xác định';
            if (!assignment.periodName && !assignment.period?.name) {
              console.warn('[StaffMyKpiView] Missing period relation for assignment:', assignment.id, 'period_id:', assignment.period_id);
            }

            const versionNo = assignment.templateVersionNo ?? assignment.template_version?.version_no ?? null;
            if (versionNo === null) {
              console.warn('[StaffMyKpiView] Missing template version relation for assignment:', assignment.id, 'template_version_id:', assignment.template_version_id);
            }

            const snapshotUnitName = assignment.assigneeUnitSnapshotName || assignment.assignee_unit_snapshot?.name || assignment.assigneeOrganizationName || null;
            const effectiveFromDisplay = assignment.effectiveFrom || assignment.effective_from || assignment.period?.start_date || '-';
            const effectiveToDisplay = assignment.effectiveTo || assignment.effective_to || assignment.period?.end_date || '-';

            return (
              <div
                key={assignment.id}
                className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden transition-all"
              >
                {/* Assignment Summary Bar */}
                <div
                  onClick={() => toggleExpand(assignment.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          {templateDisplayName}
                        </h3>
                        {getStatusBadge(assignment.status)}
                        {reviewsMap[assignment.id] && reviewsMap[assignment.id].status !== 'not_started' && (
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                            formatReviewStatus(reviewsMap[assignment.id].status).bgClass
                          } ${
                            formatReviewStatus(reviewsMap[assignment.id].status).textClass
                          } ${
                            formatReviewStatus(reviewsMap[assignment.id].status).borderClass
                          }`}>
                            {formatReviewStatus(reviewsMap[assignment.id].status).label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Kỳ: <strong className="text-slate-700 font-semibold">{periodDisplayName}</strong>
                          {assignment.period?.code && (
                            <span className="text-slate-400 text-[11px] font-mono">({assignment.period.code})</span>
                          )}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600 font-medium">
                          {versionNo !== null ? `Phiên bản v${versionNo}` : 'Phiên bản chưa xác định'}
                        </span>
                        {snapshotUnitName && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              {snapshotUnitName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Hiệu lực</div>
                      <div className="text-xs font-semibold text-slate-700">
                        {effectiveFromDisplay} → {effectiveToDisplay}
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details & Items Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4">
                    {assignment.notes && (
                      <div className="rounded-xl bg-white p-3 border border-slate-200 text-xs text-slate-600">
                        <strong className="text-slate-800">Ghi chú từ người giao:</strong> {assignment.notes}
                      </div>
                    )}

                    
                    {/* Review & Lock Status Banner for Staff */}
                    {assignment.status === 'locked' ? (
                      <div id={`locked-banner-${assignment.id}`} className="rounded-xl bg-slate-900 text-white p-4 text-xs space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                            <Lock className="w-4 h-4 text-emerald-400" />
                            Kết quả KPI chính thức đã được khóa (Locked)
                          </div>
                          <span className="text-slate-300 text-[11px] bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                            Snapshot kết quả bất biến
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-slate-300 pt-1">
                          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Điểm chính thức</span>
                            <strong className="text-emerald-400 font-bold text-base">
                              {formatScore(reviewsMap[assignment.id]?.official_total_score ?? assignment.config?.official_result?.total_score ?? scoresMap[assignment.id]?.total_score ?? 0)}
                              <span className="text-xs font-normal text-slate-400"> / 100</span>
                            </strong>
                          </div>
                          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Thời gian khóa</span>
                            <strong className="text-white font-medium text-xs">
                              {assignment.locked_at ? new Date(assignment.locked_at).toLocaleString('vi-VN') : '—'}
                            </strong>
                          </div>
                          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                            <span className="text-slate-400 block text-[11px]">Người khóa</span>
                            <strong className="text-white font-medium text-xs">
                              {assignment.config?.locked_by_name || 'Quản trị viên'}
                            </strong>
                          </div>
                        </div>
                        {assignment.config?.lock_note && (
                          <div className="pt-2 border-t border-slate-800 text-slate-300">
                            <span className="text-slate-400 font-medium">Ghi chú khóa:</span> {assignment.config.lock_note}
                          </div>
                        )}
                      </div>
                    ) : reviewsMap[assignment.id] ? (
                      <>
                        {reviewsMap[assignment.id].status === 'approved' && (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-4 text-xs text-emerald-900 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              Kết quả KPI đã được phê duyệt chính thức
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                              <div>
                                <span className="text-slate-400">Người phê duyệt:</span>{' '}
                                <strong className="text-slate-800 font-semibold">{reviewsMap[assignment.id].reviewer_name || 'Cán bộ quản lý'}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400">Thời gian phê duyệt:</span>{' '}
                                <strong className="text-slate-800 font-semibold">
                                  {reviewsMap[assignment.id].approved_at ? new Date(reviewsMap[assignment.id].approved_at!).toLocaleString('vi-VN') : '—'}
                                </strong>
                              </div>
                            </div>
                            {reviewsMap[assignment.id].review_note && (
                              <div className="pt-1.5 border-t border-emerald-200/60 text-slate-700">
                                <span className="font-semibold text-slate-800">Nhận xét của người phê duyệt:</span> {reviewsMap[assignment.id].review_note}
                              </div>
                            )}
                          </div>
                        )}

                        {reviewsMap[assignment.id].status === 'returned' && (
                          <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-4 text-xs text-amber-900 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              Yêu cầu điều chỉnh kết quả KPI
                            </div>
                            <p className="text-amber-800">
                              Cán bộ quản lý đã trả lại kết quả đánh giá để rà soát hoặc điều chỉnh số liệu thực tế.
                            </p>
                            {reviewsMap[assignment.id].review_note && (
                              <div className="p-3 bg-white rounded-lg border border-amber-200 text-slate-700">
                                <span className="font-semibold text-slate-800">Lý do trả lại:</span> {reviewsMap[assignment.id].review_note}
                              </div>
                            )}
                          </div>
                        )}

                        {reviewsMap[assignment.id].status === 'in_review' && (
                          <div className="rounded-xl bg-blue-50 border border-blue-200/80 p-3.5 text-xs text-blue-900 flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>KPI đang trong quá trình đánh giá và thẩm định bởi cán bộ quản lý.</span>
                          </div>
                        )}
                      </>
                    ) : null}

                    {/* Scoring Summary */}
                    {scoresMap[assignment.id] && (
                      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden mb-4">
                        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-indigo-500" />
                            {reviewsMap[assignment.id]?.status === 'approved' ? 'Kết quả KPI chính thức' : 'Kết quả đánh giá'}
                          </h3>
                          {reviewsMap[assignment.id]?.status === 'approved' ? (
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              Đã phê duyệt chính thức
                            </span>
                          ) : scoresMap[assignment.id].status === 'partial' ? (
                            <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                              <AlertCircle className="w-3 h-3" />
                              Chưa phải kết quả cuối cùng.
                            </span>
                          ) : null}
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">
                              {reviewsMap[assignment.id]?.status === 'approved' ? 'Điểm đã phê duyệt' : 'Điểm KPI tạm tính'}
                            </div>
                            <div className={`text-2xl font-bold ${
                              reviewsMap[assignment.id]?.status === 'approved' ? 'text-emerald-600' : 'text-indigo-600'
                            }`}>
                              {formatScore(
                                reviewsMap[assignment.id]?.status === 'approved' && reviewsMap[assignment.id]?.official_total_score !== undefined && reviewsMap[assignment.id]?.official_total_score !== null
                                  ? reviewsMap[assignment.id].official_total_score!
                                  : scoresMap[assignment.id].total_score
                              )}{' '}
                              <span className="text-sm font-medium text-slate-400">/ 100</span>
                            </div>
                            {reviewsMap[assignment.id]?.status === 'approved' && 
                             reviewsMap[assignment.id]?.official_total_score !== undefined && 
                             reviewsMap[assignment.id]?.official_total_score !== scoresMap[assignment.id].total_score && (
                              <div className="text-[10px] text-slate-400">
                                Điểm live hiện tại: {formatScore(scoresMap[assignment.id].total_score)}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">Tổng trọng số</div>
                            <div className="text-lg font-bold text-slate-900">{scoresMap[assignment.id].total_weight}%</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">Đã tính</div>
                            <div className="text-lg font-bold text-emerald-600">{scoresMap[assignment.id].scored_weight}%</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">Chưa tính</div>
                            <div className="text-lg font-bold text-amber-500">{scoresMap[assignment.id].unscored_weight}%</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">

                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Danh sách tiêu chí KPI ({items.length})
                        </div>
                        <div className="text-xs font-bold text-indigo-600">
                          Tổng trọng số: {totalWeight}%
                        </div>
                      </div>

                      {items.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Đang tải danh sách tiêu chí...
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Tiêu chí KPI</th>
                                <th className="px-3 py-3 text-center">Trọng số</th>
                                <th className="px-3 py-3">Target</th>
                                <th className="px-3 py-3">Actual</th>
                                <th className="px-3 py-3 text-center">Hoàn thành</th>
                                <th className="px-3 py-3 text-center">Điểm</th>
                                <th className="px-3 py-3">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {items.map(item => {
                                const def = item.definition || item.definition_snapshot || {};
                                const actual = (actualsMap[assignment.id] || {})[item.id];
                                const score = (itemScoresMap[assignment.id] || {})[item.id];
                                const primaryBinding = (item as any).bindings?.find((b: any) => b.binding_key === 'primary' && b.is_active);
                                const isManual = actual?.source_type === 'manual' || primaryBinding?.source_type === 'manual';
                                const inputRole = primaryBinding?.source_config?.input_role || 'assignee';
                                const hasInputPermission = isManual && 
                                  (assignment.status === 'assigned' || assignment.status === 'active') && 
                                  reviewsMap[assignment.id]?.status !== 'approved' && 
                                  inputRole !== 'manager';

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-3.5">
                                      <div className="font-bold text-slate-900 text-sm">{def.name || 'Tiêu chí KPI'}</div>
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">
                                          {def.code || 'CODE'}
                                        </span>
                                        <span>•</span>
                                        <span>{def.measurement_type}</span>
                                        {def.unit_code && <span>({def.unit_code})</span>}
                                      </div>
                                    </td>

                                    <td className="px-3 py-3.5 text-center">
                                      <span className="font-semibold text-slate-700">{item.weight}%</span>
                                    </td>

                                    <td className="px-3 py-3.5 text-slate-600 font-medium">
                                      {formatTargetConfig(item.target_config, def.measurement_type, def.direction, def.unit_code)}
                                    </td>

                                    <td className="px-3 py-3.5 text-slate-600">
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
                                                  requireNote: primaryBinding.source_config?.require_note === true,
                                                  assignmentId: assignment.id
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

                                    <td className="px-3 py-3.5 text-center">
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

                                    <td className="px-3 py-3.5 text-center">
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

                                    <td className="px-3 py-3.5">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {manualActualModal?.isOpen && (
        <KpiManualActualModal
          bindingId={manualActualModal.bindingId}
          measurementType={manualActualModal.measurementType}
          requireNote={manualActualModal.requireNote}
          onClose={() => setManualActualModal(null)}
          onSuccess={() => {
            const asmId = manualActualModal.assignmentId;
            setManualActualModal(null);
            loadItemsForAssignment(asmId);
          }}
        />
      )}

      {scoreTraceItemId && (() => {
        // Find the score item across all loaded assignments
        let item: any = null;
        for (const asmId of Object.keys(itemScoresMap)) {
          if (itemScoresMap[asmId][scoreTraceItemId]) {
            item = itemScoresMap[asmId][scoreTraceItemId];
            break;
          }
        }
        if (!item) return null;
        return (
          <KpiScoreTraceDrawer
            scoreItem={item}
            onClose={() => setScoreTraceItemId(null)}
          />
        );
      })()}

      {traceDrawerItemId && (
        <KpiActualTraceDrawer
          assignmentItemId={traceDrawerItemId}
          onClose={() => setTraceDrawerItemId(null)}
        />
      )}
    </div>
  );
};
