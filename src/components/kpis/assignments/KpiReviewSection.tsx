import React from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Send, 
  Clock, 
  UserCheck, 
  Info,
  Lock
} from 'lucide-react';
import { KpiAssignment, KpiAssignmentReview } from '../../../types/kpi';
import { KpiAssignmentScoreResult } from '../../../services/kpiScoringService';
import { formatScore } from '../../../utils/kpiScoreFormatter';
import { formatReviewStatus } from '../../../utils/kpiReviewFormatter';

interface KpiReviewSectionProps {
  assignment: KpiAssignment;
  review: KpiAssignmentReview | null;
  assignmentScore: KpiAssignmentScoreResult | null;
  canManage: boolean;
  isProcessing: boolean;
  onStartReview: () => Promise<void>;
  onOpenReturnModal: () => void;
  onOpenApproveModal: () => void;
  onResubmitReview: () => Promise<void>;
  onOpenLockModal?: () => void;
}

export const KpiReviewSection: React.FC<KpiReviewSectionProps> = ({
  assignment,
  review,
  assignmentScore,
  canManage,
  isProcessing,
  onStartReview,
  onOpenReturnModal,
  onOpenApproveModal,
  onResubmitReview,
  onOpenLockModal
}) => {
  const reviewStatus = review?.status || 'not_started';
  const statusMeta = formatReviewStatus(reviewStatus);

  const isClosed = assignment.status === 'closed';
  const isLocked = assignment.status === 'locked';
  const isApproved = reviewStatus === 'approved';
  const isReturned = reviewStatus === 'returned';
  const isInReview = reviewStatus === 'in_review';
  const isNotStarted = reviewStatus === 'not_started';

  const isScoreComplete = assignmentScore?.status === 'complete' && 
    assignmentScore?.total_weight === 100 && 
    assignmentScore?.scored_weight === 100;

  const officialScore = review?.official_total_score ?? assignment.config?.official_result?.total_score ?? null;

  return (
    <div id="kpi-review-section" className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Section Header */}
      <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Đánh giá & Phê duyệt KPI
            </h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span>Trạng thái KPI: <strong className="text-slate-700 font-semibold">{assignment.status}</strong></span>
              <span>·</span>
              <span>Trạng thái đánh giá:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusMeta.bgClass} ${statusMeta.textClass} border ${statusMeta.borderClass}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Workflow Actions (Only for authorized managers) */}
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {isLocked ? (
              <span id="badge-kpi-locked" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 shadow-xs">
                <Lock className="h-3.5 w-3.5 text-slate-700" />
                Đã khóa kết quả
              </span>
            ) : isApproved ? (
              <button
                type="button"
                id="btn-lock-review"
                onClick={onOpenLockModal}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Lock className="h-3.5 w-3.5" />
                {isProcessing ? 'Đang xử lý...' : 'Khóa kết quả KPI'}
              </button>
            ) : isNotStarted ? (
              <button
                type="button"
                id="btn-start-review"
                onClick={onStartReview}
                disabled={!isClosed || isProcessing}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs ${
                  isClosed
                    ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed border border-slate-200'
                }`}
                title={!isClosed ? 'Chỉ có thể bắt đầu đánh giá khi KPI đã được đóng.' : undefined}
              >
                <Send className="h-3.5 w-3.5" />
                {isProcessing ? 'Đang xử lý...' : 'Bắt đầu đánh giá'}
              </button>
            ) : isInReview ? (
              <>
                <button
                  type="button"
                  id="btn-return-review"
                  onClick={onOpenReturnModal}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Trả lại
                </button>
                <button
                  type="button"
                  id="btn-approve-review"
                  onClick={onOpenApproveModal}
                  disabled={!isScoreComplete || isProcessing}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs ${
                    isScoreComplete
                      ? 'text-white bg-emerald-600 hover:bg-emerald-700'
                      : 'text-slate-400 bg-slate-100 cursor-not-allowed border border-slate-200'
                  }`}
                  title={!isScoreComplete ? 'Chưa đủ điều kiện phê duyệt vì một số KPI chưa có kết quả đầy đủ.' : undefined}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Phê duyệt
                </button>
              </>
            ) : isReturned ? (
              <button
                type="button"
                id="btn-resubmit-review"
                onClick={onResubmitReview}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                {isProcessing ? 'Đang gửi...' : 'Gửi lại đánh giá'}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* State-specific Banners */}
      <div className="p-6 space-y-5">
        {/* Not closed warning for not_started */}
        {isNotStarted && !isClosed && (
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-600">
            <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              Chỉ có thể bắt đầu đánh giá khi KPI đã được đóng. Hiện tại trạng thái KPI là <strong>{assignment.status}</strong>.
            </div>
          </div>
        )}

        {/* Partial scoring warning for in_review */}
        {isInReview && !isScoreComplete && (
          <div id="review-score-incomplete-warning" className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Chưa đủ điều kiện phê duyệt vì một số KPI chưa có kết quả đầy đủ.</strong> Vui lòng hoàn thiện dữ liệu đo lường của tất cả các tiêu chí trước khi phê duyệt.
            </div>
          </div>
        )}

        {/* Returned Info Banner */}
        {isReturned && (
          <div id="review-returned-banner" className="rounded-xl bg-amber-50/80 p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              Yêu cầu điều chỉnh kết quả KPI
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-amber-200/60 text-slate-800 font-medium">
              {review?.review_note || 'Không có ghi chú.'}
            </div>
            <div className="flex items-center gap-4 text-slate-500 pt-1 flex-wrap">
              {review?.reviewer_name && (
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                  Người yêu cầu: <strong className="text-slate-700">{review.reviewer_name}</strong>
                </span>
              )}
              {review?.returned_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Thời gian: <strong className="text-slate-700">{new Date(review.returned_at).toLocaleString('vi-VN')}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Approved / Locked State Banner & Snapshot Info */}
        {isApproved && (
          <div id={isLocked ? 'review-locked-banner' : 'review-approved-banner'} className={`rounded-xl p-4 border space-y-3 ${
            isLocked ? 'bg-slate-100/90 border-slate-300' : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className={`flex items-center gap-2 font-bold text-sm ${isLocked ? 'text-slate-900' : 'text-emerald-900'}`}>
                {isLocked ? (
                  <>
                    <Lock className="h-5 w-5 text-slate-800" />
                    Kết quả KPI đã được khóa chính thức (Locked)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Kết quả KPI đã được phê duyệt chính thức
                  </>
                )}
              </div>
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${
                isLocked
                  ? 'text-slate-800 bg-white border-slate-300'
                  : 'text-emerald-800 bg-white/80 border-emerald-200'
              }`}>
                <Lock className={`h-3.5 w-3.5 ${isLocked ? 'text-slate-700' : 'text-emerald-600'}`} />
                {isLocked ? 'Kết quả chính thức bất biến' : 'Snapshot kết quả bất biến'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                <div className="text-slate-500">Người phê duyệt</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {review?.reviewer_name || 'Cán bộ quản lý'}
                </div>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                <div className="text-slate-500">Thời gian phê duyệt</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {review?.approved_at ? new Date(review.approved_at).toLocaleString('vi-VN') : '-'}
                </div>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                <div className="text-slate-500">Ghi chú phê duyệt</div>
                <div className="text-sm font-medium text-slate-800 mt-0.5 truncate">
                  {review?.review_note || 'Không có ghi chú'}
                </div>
              </div>
            </div>

            {isLocked && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs border-t border-slate-200/80">
                <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500">Người khóa</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {assignment.config?.locked_by_name || 'Quản trị viên'}
                  </div>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500">Thời gian khóa</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {assignment.locked_at ? new Date(assignment.locked_at).toLocaleString('vi-VN') : '-'}
                  </div>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500">Ghi chú khóa</div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5 truncate">
                    {assignment.config?.lock_note || 'Không có ghi chú'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score & Weight Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          {/* Approved Score vs Live Score */}
          {isApproved ? (
            <div className="space-y-1 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <div className="text-xs font-semibold text-emerald-800">Điểm đã phê duyệt</div>
              <div className="text-2xl font-bold text-emerald-700">
                {officialScore !== null ? formatScore(officialScore) : (assignmentScore ? formatScore(assignmentScore.total_score) : '-')}
                <span className="text-sm font-medium text-emerald-600/70"> / 100</span>
              </div>
              {assignmentScore && officialScore !== null && Math.abs(officialScore - assignmentScore.total_score) > 0.001 && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Điểm live hiện tại: <strong>{formatScore(assignmentScore.total_score)}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs font-semibold text-slate-500">Điểm KPI tạm tính</div>
              <div className="text-2xl font-bold text-indigo-600">
                {assignmentScore ? formatScore(assignmentScore.total_score) : '-'}
                <span className="text-sm font-medium text-slate-400"> / 100</span>
              </div>
              <div className="text-[11px] text-slate-400">Chưa phê duyệt</div>
            </div>
          )}

          <div className="space-y-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Tổng trọng số</div>
            <div className="text-xl font-bold text-slate-900">
              {assignmentScore ? assignmentScore.total_weight : 100}%
            </div>
            <div className="text-[11px] text-slate-400">Chuẩn hóa 100%</div>
          </div>

          <div className="space-y-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Đã tính</div>
            <div className="text-xl font-bold text-emerald-600">
              {assignmentScore ? assignmentScore.scored_weight : 0}%
            </div>
            <div className="text-[11px] text-slate-400">Trọng số hoàn tất</div>
          </div>

          <div className="space-y-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Chưa tính</div>
            <div className="text-xl font-bold text-amber-500">
              {assignmentScore ? assignmentScore.unscored_weight : 0}%
            </div>
            <div className="text-[11px] text-slate-400">Trọng số chưa đo</div>
          </div>
        </div>
      </div>
    </div>
  );
};
