const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', 'utf8');

// Update Table Headers
content = content.replace(
  /<th className="px-4 py-3">Tiêu chí KPI<\/th>\s*<th className="px-3 py-3">Mục tiêu liên kết<\/th>\s*<th className="px-3 py-3 text-center">Trọng số<\/th>\s*<th className="px-3 py-3">Chỉ tiêu \(Target\)<\/th>\s*<th className="px-3 py-3">Thực hiện \(Actual\)<\/th>\s*<th className="px-3 py-3">Cách tính điểm<\/th>\s*<th className="px-3 py-3 text-center">Bắt buộc<\/th>/,
  `<th className="px-4 py-3">Tiêu chí KPI</th>
                                <th className="px-3 py-3 text-center">Trọng số</th>
                                <th className="px-3 py-3">Target</th>
                                <th className="px-3 py-3">Actual</th>
                                <th className="px-3 py-3 text-center">Hoàn thành</th>
                                <th className="px-3 py-3 text-center">Điểm</th>
                                <th className="px-3 py-3">Trạng thái</th>`
);

fs.writeFileSync('src/components/kpis/assignments/StaffMyKpiView.tsx', content);
