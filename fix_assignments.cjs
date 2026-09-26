const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

const assignmentsTable = `          {/* SECTION 5: Assignments List */}
          <div
            id="kpi-dashboard-assignments-section"
            className="rounded-xl border border-slate-200 bg-white shadow-xs"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">Danh sách KPI được giao</h2>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Đơn vị</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Người nhận</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Chỉ tiêu (Target)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tình trạng</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {assignmentsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : assignmentsError ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-red-500 font-medium">
                        {assignmentsError}
                      </td>
                    </tr>
                  ) : assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                        Không có dữ liệu KPI
                      </td>
                    </tr>
                  ) : (
                    assignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-800">{item.assignee_unit_name || item.assignee_unit_id}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-800">{item.assignee_name || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.target_value}</td>
                        <td className="px-4 py-3">
                          {item.status === 'official' ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Chính thức</span>
                          ) : item.status === 'live' ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Tạm tính</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">{item.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { window.location.hash = \`#/kpis/dashboard/assignment/\${item.id}\`; }}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium transition-colors"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {!assignmentsLoading && !assignmentsError && assignmentTotal > assignmentPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Hiển thị {(assignmentPage - 1) * assignmentPageSize + 1} - {Math.min(assignmentPage * assignmentPageSize, assignmentTotal)} trong {assignmentTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssignmentPage(p => Math.max(1, p - 1))}
                    disabled={assignmentPage === 1}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAssignmentPage(p => p + 1)}
                    disabled={assignmentPage * assignmentPageSize >= assignmentTotal}
                    className="p-1.5 rounded bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>`;

content = content.replace(/\{\/\* SECTION 5: KPI Portfolio \/ Breakdown \*\/\}(.|\n)*?\{\/\* SECTION 6: Charts \*\/\}/g, assignmentsTable + '\n\n          {/* SECTION 6: Charts */}');

fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);
