const fs = require('fs');

function fix(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add header
    content = content.replace(
        /<th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Trạng thái KPI<\/th>/,
        `<th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">T/gian áp dụng</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Trạng thái KPI</th>`
    );
    
    // Add data cell
    content = content.replace(
        /<td className="px-4 py-3 text-sm text-slate-600">\s*\{item\.assignee_type === 'individual' \? \(item\.assignee_unit_name \|\| item\.unit_name \|\| '—'\) : '—'\}\s*<\/td>\s*<td className="px-4 py-3">/,
        `<td className="px-4 py-3 text-sm text-slate-600">
                          {item.assignee_type === 'individual' ? (item.assignee_unit_name || item.unit_name || '—') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-500 whitespace-nowrap">
                          {item.effective_from ? new Date(item.effective_from).toLocaleDateString('vi-VN') : '—'}<br/>
                          {item.effective_to ? new Date(item.effective_to).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-4 py-3">`
    );
    
    fs.writeFileSync(filePath, content);
}

fix('src/components/kpis/dashboard/drilldown/KpiUnitDetailView.tsx');
