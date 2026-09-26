const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

const match = content.match(/<tbody className="divide-y divide-slate-100 bg-white">([\s\S]*?)<\/tbody>/);
if (!match) {
  console.log("Could not find tbody");
  process.exit(1);
}

let newTbodyContent = `
                              {items.map(item => {
                                const def = item.definition || item.definition_snapshot || {};
                                const actual = (actualsMap[assignment.id] || {})[item.id];
                                const score = (itemScoresMap[assignment.id] || {})[item.id];
                                const primaryBinding = (item as any).bindings?.find((b: any) => b.binding_key === 'primary' && b.is_active);
                                const isManual = actual?.source_type === 'manual' || primaryBinding?.source_type === 'manual';
                                const inputRole = primaryBinding?.source_config?.input_role || 'assignee';
                                const hasInputPermission = isManual && (assignment.status === 'assigned' || assignment.status === 'active') && inputRole !== 'manager';

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
fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
