const fs = require('fs');

function inject(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Insert Download icon import
    if (!content.includes('Download')) {
        content = content.replace(/LayoutDashboard([^}]*)} from 'lucide-react'/, 'LayoutDashboard, Download$1} from \'lucide-react\'');
    }

    // Insert isExporting state and handleExport function
    if (!content.includes('const [isExporting, setIsExporting]')) {
        const stateInsertPos = content.indexOf('const [periods, setPeriods]');
        if (stateInsertPos !== -1) {
            const func = `
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard(filters, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  `;
            content = content.slice(0, stateInsertPos) + func + content.slice(stateInsertPos);
        } else {
            // fallback for drilldowns
            const fallbackPos = content.indexOf('const [loading, setLoading]');
            if (fallbackPos !== -1) {
                const func = `
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard({ ...filters, unitId: unitId }, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  `;
                // Wait, kpiKey drilldown needs kpiKey instead of unitId. Let's do it dynamically.
                let idPayload = '{ ...filters }';
                if (filePath.includes('Unit')) {
                    idPayload = '{ ...filters, unitId: unitId }';
                } else if (filePath.includes('KpiDetail')) {
                    idPayload = '{ ...filters, kpiKey: kpiKey }';
                }

                const genFunc = `
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await kpiDashboardService.exportDashboard(${idPayload}, format);
    } catch (err) {
      alert('Không thể xuất dữ liệu KPI. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };
  `;
                content = content.slice(0, fallbackPos) + genFunc + content.slice(fallbackPos);
            }
        }
    }

    // Insert UI buttons
    const uiRegex = /<div className="flex items-center gap-2">\s*<button\s*id="(kpi-dashboard-refresh-button|kpi-unit-detail-refresh|kpi-detail-refresh)"/;
    
    if (uiRegex.test(content)) {
        const buttonsUI = `
        <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Xuất Excel"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{isExporting ? 'Đang tạo file...' : 'Excel'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            title="Xuất CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{isExporting ? 'Đang tạo file...' : 'CSV'}</span>
          </button>
          <button
            id="$1"`;
        
        content = content.replace(uiRegex, `<div className="flex items-center gap-2">${buttonsUI}`);
    }

    fs.writeFileSync(filePath, content);
}

const files = [
    'src/components/kpis/dashboard/KpiManagerDashboardView.tsx',
    'src/components/kpis/dashboard/KpiExecutiveDashboardView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiUnitDetailView.tsx',
    'src/components/kpis/dashboard/drilldown/KpiDetailView.tsx'
];

files.forEach(inject);
