import React from 'react';
import { X, Calculator, Info, TrendingUp, TrendingDown, Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { KpiScoringResult } from '../../../services/kpiScoringService';
import { formatPercent, formatScore, formatScoreStatus } from '../../../utils/kpiScoreFormatter';

interface Props {
  scoreItem: KpiScoringResult;
  onClose: () => void;
}

export function KpiScoreTraceDrawer({ scoreItem, onClose }: Props) {
  const { trace, status, reason } = scoreItem;
  const direction = trace?.direction || 'higher_is_better';
  const method = trace?.scoring_method || 'linear';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Calculator className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Chi tiết cách tính điểm</h2>
            <p className="text-xs text-slate-500 font-medium">Bảng giải trình công thức</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="p-6 space-y-6">
          {/* Status Alert */}
          {status !== 'scored' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-800">Không thể tính điểm</h4>
                <p className="text-xs text-amber-600 mt-1">{formatScoreStatus(status, reason)}</p>
              </div>
            </div>
          )}

          {/* Config Overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500" />
              Cấu hình đánh giá
            </h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <span className="block text-xs font-medium text-slate-500 mb-1">Phương pháp</span>
                <span className="font-semibold text-slate-700 uppercase">{method}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 mb-1">Hướng kỳ vọng</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  {direction === 'higher_is_better' ? (
                    <><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Càng cao càng tốt</>
                  ) : direction === 'lower_is_better' ? (
                    <><TrendingDown className="w-3.5 h-3.5 text-indigo-500" /> Càng thấp càng tốt</>
                  ) : direction === 'exact_target' ? (
                    <><Target className="w-3.5 h-3.5 text-amber-500" /> Chính xác bằng Target</>
                  ) : (
                    direction
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 mb-1">Trọng số</span>
                <span className="font-semibold text-indigo-600">{formatPercent(scoreItem.weight_percent)}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 mb-1">Giới hạn (Cap)</span>
                <span className="font-semibold text-slate-700">{formatPercent(trace?.cap_percent)}</span>
              </div>
            </div>
          </div>

          {/* Value comparison */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                Đối chiếu Giá trị
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1 text-center">Chỉ tiêu (Target)</div>
                <div className="text-lg font-bold text-slate-800 text-center">
                  {trace?.target_numeric ?? (trace?.target_boolean ? 'Đạt' : trace?.target_boolean === false ? 'Không đạt' : '-')}
                </div>
              </div>
              <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <div className="text-xs font-medium text-indigo-600/70 mb-1 text-center">Thực hiện (Actual)</div>
                <div className="text-lg font-bold text-indigo-700 text-center">
                  {trace?.actual_numeric ?? (trace?.actual_boolean ? 'Đạt' : trace?.actual_boolean === false ? 'Không đạt' : scoreItem.actual ?? '-')}
                </div>
              </div>
            </div>
          </div>

          {/* Calculation Steps */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Kết quả Tính toán
              </h3>
            </div>
            <div className="p-5 space-y-4">
              
              {method === 'boolean' ? (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Điểm Đạt (Pass Score)</span>
                    <span className="font-semibold text-slate-800">{trace?.pass_score}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Điểm Không Đạt (Fail Score)</span>
                    <span className="font-semibold text-slate-800">{trace?.fail_score}</span>
                  </div>
                </>
              ) : method === 'bands' ? (
                <div className="pb-3 border-b border-slate-100">
                  <span className="text-sm text-slate-600 block mb-2">Mức hoàn thành: <span className="font-semibold text-slate-800">{formatPercent(scoreItem.achievement_percent)}</span></span>
                  <div className="text-sm text-slate-600 flex justify-between items-center">
                    <span>Khung (Band) áp dụng:</span>
                    {trace?.matched_band && trace.matched_band !== 'none' ? (
                      <span className="font-semibold text-emerald-600">≥ {trace.matched_band.min_percent}% → Điểm {trace.matched_band.score}</span>
                    ) : (
                      <span className="font-semibold text-amber-600">Không đạt mốc nào</span>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Tỷ lệ hoàn thành thô</span>
                    <span className="font-semibold text-slate-800">{formatPercent(scoreItem.raw_achievement_percent)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Tỷ lệ hoàn thành (Capped)</span>
                    <span className="font-semibold text-indigo-600">{formatPercent(scoreItem.achievement_percent)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Điểm thô (Raw Score)</span>
                <span className="font-semibold text-slate-800">{formatScore(scoreItem.raw_score)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-900">Điểm quy đổi (Weighted Score)</span>
                <span className="text-xl font-bold text-indigo-600">{formatScore(scoreItem.weighted_score)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
