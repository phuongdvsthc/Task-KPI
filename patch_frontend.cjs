const fs = require('fs');

// types/kpi.ts
let types = fs.readFileSync('src/types/kpi.ts', 'utf8');
const interfaceDef = `
export interface KpiDashboardKpiUnitBreakdown {
  unit_id: string;
  unit_name: string;
  assignment_count: number;
  item_count: number;
  scored_count: number;
  partial_count: number;
  unscored_count: number;
  live_count: number;
  official_count: number;
  live_average_score: number | null;
  official_average_score: number | null;
}
`;
if (!types.includes("KpiDashboardKpiUnitBreakdown")) {
    types = types + "\n" + interfaceDef;
    fs.writeFileSync('src/types/kpi.ts', types);
}

// kpiDashboardService.ts
let service = fs.readFileSync('src/services/kpiDashboardService.ts', 'utf8');
const methodDef = `
  async getKpiUnitBreakdown(filters: KpiDashboardFilters): Promise<{ data: KpiDashboardKpiUnitBreakdown[], error: string | null }> {
    try {
      const token = await getAuthToken();
      const params = normalizeDashboardFilters(filters);
      const res = await fetch(\`/api/kpi/dashboard/kpi-unit-breakdown?\${params.toString()}\`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: \`Bearer \${token}\` } : {})
        }
      });
      
      if (!res.ok) {
        if (res.status === 404) return { data: [], error: null };
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || \`Failed to fetch KPI unit breakdown: status \${res.status}\`);
      }
      
      const json = await res.json();
      return { data: Array.isArray(json) ? json : [], error: null };
    } catch (err: any) {
      console.error('[kpiDashboardService] getKpiUnitBreakdown error:', err);
      return { data: [], error: err.message || 'Lỗi kết nối máy chủ' };
    }
  }
`;

if (!service.includes("getKpiUnitBreakdown(")) {
    service = service.replace(
        "export const kpiDashboardService = {",
        "import { KpiDashboardKpiUnitBreakdown } from '../types/kpi';\nexport const kpiDashboardService = {"
    );
    service = service.replace(
        "export const kpiDashboardService = {",
        "export const kpiDashboardService = {\n" + methodDef
    );
    fs.writeFileSync('src/services/kpiDashboardService.ts', service);
}

