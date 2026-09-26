import fs from 'fs';
import path from 'path';
import { 
  extractAvailableMetrics, 
  adaptMetricTrendData, 
  adaptKpiPeriodData 
} from './src/components/dashboard/staffChartAdapters';

async function runB33FinalAcceptanceTest() {
  console.log('Running v0.7-B3.3 Self-Test: Staff Dashboard Charts Final Acceptance...');

  let failures = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      failures++;
    }
  }

  // 1. File existence & documentation checks
  const viewPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'StaffDashboardView.tsx');
  const adapterPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'staffChartAdapters.ts');
  const docPath = path.join(process.cwd(), 'docs', 'v0.7-b3-3-staff-charts-final-acceptance.md');

  assert(fs.existsSync(viewPath), 'StaffDashboardView.tsx exists');
  assert(fs.existsSync(adapterPath), 'staffChartAdapters.ts exists');
  assert(fs.existsSync(docPath), 'v0.7-b3-3-staff-charts-final-acceptance.md exists');

  const viewContent = fs.readFileSync(viewPath, 'utf-8');

  // 2. Data Presentation & Chart Integrity Audit
  assert(viewContent.includes('ResponsiveContainer'), 'ResponsiveContainer used for fluid chart rendering');
  assert(viewContent.includes('LineChart') && viewContent.includes('BarChart'), 'Both LineChart and BarChart used appropriately');
  assert(viewContent.includes('metric-selector'), 'Accessible metric selector present');
  assert(viewContent.includes('Chính thức') && viewContent.includes('Tạm tính'), 'Official and Live KPI states explicitly labeled');

  // 3. Adapter & Data Edge-Case Tests
  const mockData = {
    summary: {
      metrics: {
        definitions: [
          { metric_id: 'm-1', metric_name: 'Giờ giảng dạy', unit: 'giờ', aggregation_method: 'sum' }
        ]
      }
    },
    series: {
      metrics: [
        { date: '2026-03-01', metric_id: 'm-1', value: 10 },
        { date: '2026-03-02', metric_id: 'm-1', value: null }
      ],
      kpis: [
        {
          period_id: 'p-1',
          period_name: 'Học kỳ I',
          start_date: '2025-09-01',
          end_date: '2026-01-31',
          average_score: 95.0,
          assignment_count: 4,
          achieved_count: 4,
          source: 'official'
        }
      ]
    }
  };

  const metrics = extractAvailableMetrics(mockData);
  assert(metrics.length === 1, 'Metrics extracted correctly');

  const trend = adaptMetricTrendData(mockData.series.metrics, 'm-1', metrics[0]);
  assert(trend.points.length === 2, 'Metric trend points preserved');
  assert(trend.points[1].value === null, 'Null values preserved distinctly from zero');

  const kpis = adaptKpiPeriodData(mockData.series.kpis);
  assert(kpis.length === 1, 'KPI periods preserved');
  assert(kpis[0].score === 95.0, 'KPI score preserved without frontend recalculation');
  assert(kpis[0].sourceLabel === 'Chính thức', 'Official KPI source labeled correctly');

  // 4. Scope, Migration & Regression Checks
  const migrations = fs.readdirSync(path.join(process.cwd(), 'migrations'));
  const b33Migrations = migrations.filter(m => m.includes('v0.7-b3-3') || m.includes('v0.7_b3_3'));
  assert(b33Migrations.length === 0, 'No database migration added for v0.7-B3.3');

  const pages = fs.existsSync(path.join(process.cwd(), 'src', 'pages'))
    ? fs.readdirSync(path.join(process.cwd(), 'src', 'pages'))
    : [];
  assert(!pages.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('manager') || p.toLowerCase().includes('bgh')), 'No unauthorized admin/manager dashboards added');

  if (failures > 0) {
    console.error(`\nFAIL: v0.7-B3.3 Self-Test failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\nPASS: v0.7-B3.3 Self-Test completed successfully.');
    process.exit(0);
  }
}

runB33FinalAcceptanceTest();
