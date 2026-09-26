const fs = require('fs');

let content = fs.readFileSync('src/services/kpiDashboardService.ts', 'utf8');

const exportFunc = `
  async exportDashboard(filters: KpiDashboardFilters, format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> {
    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);
      params.append('format', format);

      const res = await fetch(\`/api/kpi/dashboard/export?\${params.toString()}\`, {
        headers: {
          ...(token ? { Authorization: \`Bearer \${token}\` } : {})
        }
      });

      if (!res.ok) {
        let msg = 'Export failed';
        try {
          const err = await res.json();
          if (err.error) msg = err.message || err.error;
        } catch {
           if (res.status === 404) msg = 'Không có dữ liệu phù hợp để xuất.';
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = \`KPI_Export_\${new Date().toISOString().split('T')[0]}.\${format}\`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      throw err;
    }
  },
`;

content = content.replace(
    /export const kpiDashboardService = \{/,
    `export const kpiDashboardService = {\n${exportFunc}`
);

fs.writeFileSync('src/services/kpiDashboardService.ts', content);
