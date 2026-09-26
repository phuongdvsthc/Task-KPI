const fs = require('fs');

// KpiUnitBreakdownTable.tsx
let unitContent = fs.readFileSync('src/components/kpis/dashboard/KpiUnitBreakdownTable.tsx', 'utf8');
if (!unitContent.includes('onUnitClick?: (unitId: string) => void;')) {
    unitContent = unitContent.replace(/interface KpiUnitBreakdownTableProps {/, 'interface KpiUnitBreakdownTableProps {\n  onUnitClick?: (unitId: string) => void;');
    unitContent = unitContent.replace(/labels = {([^}]*)}/, 'labels = {$1},\n  onUnitClick');
    unitContent = unitContent.replace(/<span className="font-medium text-slate-800">/, '<span className="font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => onUnitClick && onUnitClick(row.unit_id)}>');
    fs.writeFileSync('src/components/kpis/dashboard/KpiUnitBreakdownTable.tsx', unitContent);
}

// KpiPortfolioTable.tsx
let kpiContent = fs.readFileSync('src/components/kpis/dashboard/KpiPortfolioTable.tsx', 'utf8');
if (!kpiContent.includes('onKpiClick?: (kpiKey: string) => void;')) {
    kpiContent = kpiContent.replace(/interface KpiPortfolioTableProps {/, 'interface KpiPortfolioTableProps {\n  onKpiClick?: (kpiKey: string) => void;');
    kpiContent = kpiContent.replace(/resultMode\n}\)/, 'resultMode,\n  onKpiClick\n})');
    kpiContent = kpiContent.replace(/<span className="font-semibold text-slate-800">/, '<span className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => onKpiClick && onKpiClick(row.kpi_key || "")}>');
    fs.writeFileSync('src/components/kpis/dashboard/KpiPortfolioTable.tsx', kpiContent);
}
