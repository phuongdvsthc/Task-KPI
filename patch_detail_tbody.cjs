const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');

// The block to replace is inside the mapping: `items.map(item => {`
// Let's replace the TD elements from Target to Thao tác.

const oldTbodyPattern = /<td className="px-4 py-4 text-xs text-slate-600">\s*\{item\.objective \? \([\s\S]*?<\/button>\s*\)\}\s*<\/td>\s*<\/tr>/m;

// Actually it's easier to find the whole tr block. Let's do it using regex:
// `<tr key={item.id}` until `</tr>`
// But there is `items.map(item => {` inside `<tbody>`.

const match = content.match(/<tbody className="divide-y divide-slate-100 bg-white">([\s\S]*?)<\/tbody>/);
if (!match) {
  console.log("Could not find tbody");
  process.exit(1);
}

let tbodyContent = match[1];

let newTbodyContent = `
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
                                {def.unit_code && def.measurement_type !== 'boolean' ? \` \${def.unit_code}\` : ''}
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
                            <span className={\`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium \${score.status === 'scored' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}\`}>
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
`;

content = content.replace(match[1], newTbodyContent);
fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
