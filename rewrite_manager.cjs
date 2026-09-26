const fs = require('fs');
let content = fs.readFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', 'utf8');

// 1. Rename component
content = content.replace(/KpiExecutiveDashboardView/g, 'KpiManagerDashboardView');

// 2. Change props to include onNavigateToAssignments
content = content.replace(/export const KpiManagerDashboardView: React\.FC = \(\) => {/, 
`interface KpiManagerDashboardViewProps {\n  onNavigateToAssignments?: () => void;\n}\n\nexport const KpiManagerDashboardView: React.FC<KpiManagerDashboardViewProps> = ({ onNavigateToAssignments }) => {`);

// 3. Change title
content = content.replace(/Bảng điều khiển KPI Toàn trường/g, 'Bảng điều khiển Quản lý KPI');
content = content.replace(/Tổng quan toàn bộ KPI của tổ chức/g, 'Tổng quan tiến độ và kết quả KPI của đơn vị');

// 4. Scope units to managerReportService
content = content.replace(/import { organizationService } from '..\/..\/..\/services\/organizationService';/g, "import { managerReportService } from '../../../services/manager-report.service';\nimport { ManagerScopeOrgUnit } from '../../../types/manager-report';");
content = content.replace(/const \[orgUnits, setOrgUnits\] = useState<OrganizationUnit\[\]>\(\[\]\);/g, 'const [scopeUnits, setScopeUnits] = useState<ManagerScopeOrgUnit[]>([]);');
content = content.replace(/const \[orgUnitsLoading, setOrgUnitsLoading\] = useState<boolean>\(true\);/g, 'const [scopeLoading, setScopeLoading] = useState<boolean>(true);');

// Replace initializeScope
content = content.replace(/const initializeScope = useCallback\(async \(\) => {[\s\S]*?}, \[\]\);/g, 
`const initializeScope = useCallback(async () => {
    setScopeLoading(true);
    try {
      const units = await managerReportService.getManagerScopeUnits();
      setScopeUnits(units);
    } catch (err) {
      console.error('[KpiManagerDashboardView] Error initializing scope:', err);
    } finally {
      setScopeLoading(false);
    }
  }, []);`);

// Fix scopeUnits usage in JSX
content = content.replace(/orgUnitsLoading/g, 'scopeLoading');
content = content.replace(/orgUnits\.map/g, 'scopeUnits.map');
content = content.replace(/unit\.name/g, 'unit.unit_name');

// Remove Portfolio breakdown, add Assignments
content = content.replace(/const \[kpiBreakdown, setKpiBreakdown\] = useState<KpiDashboardKpiBreakdown\[\]>\(\[\]\);\n  const \[kpiBreakdownError, setKpiBreakdownError\] = useState<string \| null>\(null\);/, 
`const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState<boolean>(false);
  const [assignmentPage, setAssignmentPage] = useState<number>(1);
  const [assignmentTotal, setAssignmentTotal] = useState<number>(0);
  const assignmentPageSize = 20;
`);

// Add drilldowns placeholder inside Manager
content = content.replace(/  const \[loading, setLoading\] = useState<boolean>\(false\);/g, 
`  const [loading, setLoading] = useState<boolean>(false);
  const hash = window.location.hash;
  const drilldownAssignmentMatch = hash.match(/\\/dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);
  const drilldownUnitMatch = hash.match(/\\/dashboard\\/unit\\/([a-zA-Z0-9-]+)/);
  const drilldownKpiMatch = hash.match(/\\/dashboard\\/kpi\\/([^&]+)/);
`);

// 5. Dashboard Data Fetch
content = content.replace(/const \[unitBreakdown, setUnitBreakdown\] = useState<KpiDashboardUnitBreakdown\[\]>\(\[\]\);\n  const \[unitBreakdownError, setUnitBreakdownError\] = useState<string \| null>\(null\);/g, 
`const [unitBreakdown, setUnitBreakdown] = useState<KpiDashboardUnitBreakdown[]>([]);
  const [unitBreakdownError, setUnitBreakdownError] = useState<string | null>(null);`);

let fetchReplacement = 
`      setLoading(true);
      setError(null);
      setUnitBreakdownError(null);
      setAssignmentsError(null);
      setAssignmentsLoading(true);
      try {
        const [sumRes, ubRes, assignRes] = await Promise.all([
          kpiDashboardService.getSummary(filters),
          kpiDashboardService.getUnitBreakdown(filters),
          kpiDashboardService.getManagerAssignments(filters, assignmentPage, assignmentPageSize)
        ]);
        
        if (sumRes.error) setError(sumRes.error.message);
        else setSummary(sumRes.data || null);

        if (ubRes.error) setUnitBreakdownError(ubRes.error.message);
        else setUnitBreakdown(ubRes.data || []);
        
        if (assignRes.error) setAssignmentsError(assignRes.error.message);
        else {
          setAssignments(assignRes.data || []);
          setAssignmentTotal(assignRes.count || 0);
        }
      } catch (err) {
        setError('Lỗi không xác định khi tải dữ liệu dashboard.');
      } finally {
        setLoading(false);
        setAssignmentsLoading(false);
      }`;

content = content.replace(/      setLoading\(true\);[\s\S]*?setLoading\(false\);\n      \}/, fetchReplacement);

// Update section 5 and 6
// I will just use sed or string replace for the components.
fs.writeFileSync('src/components/kpis/dashboard/KpiManagerDashboardView.tsx', content);
