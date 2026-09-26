const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

const summaryHtml = `
                    {/* Scoring Summary */}
                    {scoresMap[assignment.id] && (
                      <div className="rounded-xl bg-white border border-slate-200/80 shadow-2xs overflow-hidden mb-4">
                        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-indigo-500" />
                            Kết quả đánh giá
                          </h3>
                          {scoresMap[assignment.id].status === 'partial' && (
                            <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                              <AlertCircle className="w-3 h-3" />
                              Chưa phải kết quả cuối cùng.
                            </span>
                          )}
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">Điểm KPI tạm tính</div>
                            <div className="text-2xl font-bold text-indigo-600">
                              {formatScore(scoresMap[assignment.id].total_score)} <span className="text-sm font-medium text-slate-400">/ 100</span>
                            </div>
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
`;

content = content.replace('<div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">', summaryHtml);
fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
