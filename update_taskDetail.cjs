const fs = require('fs');
let code = fs.readFileSync('src/components/tasks/TaskDetail.tsx', 'utf8');

const oldUpdateRenderer = `                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                            Tiến độ: {upd.progress}%
                          </span>
                          {upd.new_status && (
                            <span className="text-slate-500 text-[11px]">
                              Trạng thái: <strong>{upd.new_status}</strong>
                            </span>
                          )}
                        </div>

                        {upd.content && (
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pt-1">
                            {upd.content}
                          </p>
                        )}`;

const newUpdateRenderer = `                        <div className="flex flex-col gap-1 text-xs pt-1">
                          {upd.old_status === null && upd.update_type === 'general' ? null : (
                            <>
                              {upd.progress !== undefined && upd.progress !== upd.old_progress && (
                                <span className="font-semibold text-slate-700">
                                  Tiến độ: {upd.old_progress ?? 0}% → {upd.progress}%
                                </span>
                              )}
                              {upd.new_status && upd.new_status !== upd.old_status && (
                                <span className="font-semibold text-slate-700">
                                  Trạng thái: <span className="uppercase text-[10px]">{upd.old_status ?? 'Mới'}</span> → <span className="uppercase text-[10px]">{upd.new_status}</span>
                                </span>
                              )}
                            </>
                          )}
                          {upd.content && (
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">
                              {upd.content}
                            </p>
                          )}
                        </div>`;

code = code.replace(oldUpdateRenderer, newUpdateRenderer);
fs.writeFileSync('src/components/tasks/TaskDetail.tsx', code);
