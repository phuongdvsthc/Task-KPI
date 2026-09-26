const fs = require('fs');
let code = fs.readFileSync('src/components/tasks/TaskList.tsx', 'utf8');

code = code.replace(
  `                          <button
                            type="button"
                            onClick={() => setTaskForProgressUpdate(t)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Cập nhật tiến độ"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>`,
  `                          {systemRole !== 'executive' && systemRole !== 'viewer' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTaskForProgressUpdate(t); }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Cập nhật tiến độ"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                          )}`
);

fs.writeFileSync('src/components/tasks/TaskList.tsx', code);
