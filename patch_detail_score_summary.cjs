const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');

const summaryHtml = `
      {/* Scoring Summary */}
      {assignmentScore && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-500" />
              Kết quả đánh giá
            </h3>
            {assignmentScore.status === 'partial' && (
              <span className="text-xs font-medium text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/50">
                <AlertCircle className="w-3.5 h-3.5" />
                Một số KPI chưa có dữ liệu nên điểm hiện tại chưa phải kết quả cuối cùng.
              </span>
            )}
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-500">Điểm KPI tạm tính</div>
              <div className="text-3xl font-bold text-indigo-600">
                {formatScore(assignmentScore.total_score)} <span className="text-base font-medium text-slate-400">/ 100</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-500">Tổng trọng số</div>
              <div className="text-xl font-bold text-slate-900">{assignmentScore.total_weight}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-500">Đã tính</div>
              <div className="text-xl font-bold text-emerald-600">{assignmentScore.scored_weight}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-500">Chưa tính</div>
              <div className="text-xl font-bold text-amber-500">{assignmentScore.unscored_weight}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Items Section */}
`;

content = content.replace("{/* Items Section */}", summaryHtml);
fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
