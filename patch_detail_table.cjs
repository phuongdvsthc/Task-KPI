const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', 'utf8');

// Update Table Headers
content = content.replace(
  /<th className="px-5 py-3\.5">Tiêu chí KPI<\/th>\s*<th className="px-4 py-3\.5">Mục tiêu liên kết<\/th>\s*<th className="px-4 py-3\.5 text-center">Trọng số<\/th>\s*<th className="px-4 py-3\.5">Chỉ tiêu \(Target\)<\/th>\s*<th className="px-4 py-3\.5">Thực hiện \(Actual\)<\/th>\s*<th className="px-4 py-3\.5">Cách tính điểm<\/th>\s*<th className="px-4 py-3\.5 text-center">Bắt buộc<\/th>/,
  `<th className="px-5 py-3.5">Tiêu chí KPI</th>
                  <th className="px-4 py-3.5 text-center">Trọng số</th>
                  <th className="px-4 py-3.5">Target</th>
                  <th className="px-4 py-3.5">Actual</th>
                  <th className="px-4 py-3.5 text-center">Hoàn thành</th>
                  <th className="px-4 py-3.5 text-center">Điểm</th>
                  <th className="px-4 py-3.5">Trạng thái</th>`
);

fs.writeFileSync('src/components/kpis/assignments/KpiAssignmentDetailView.tsx', content);
